"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { createPatient } from "@/app/_lib/db/drizzle/queries/patient-personal-details";
import { findExistingPatients } from "@/app/_lib/db/drizzle/queries/patients";
import { db } from "@/app/_lib/db/drizzle/index";
import { patients } from "@/app/_lib/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { getOpenRouterTextModel } from "@/app/_lib/ai/parse-visit";

export interface CreatePatientPayload {
  patientId?: string; // Optional: if provided, use this ID for the patient
  firstName: string;
  lastName: string;
  preferredName?: string;
  dob?: string;
  sexAtBirth?: string;
  genderIdentity?: string;
  phone?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  primaryLanguage?: string;
  preferredCommMethod?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  primaryCareProvider?: string;
  consentSignatureUrl?: string;
}

export interface PatientVoicePrefill {
  firstName?: string;
  lastName?: string;
  dob?: string;
  sexAtBirth?: string;
  genderIdentity?: string;
  phone?: string;
  email?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  primaryLanguage?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;
  primaryCareProvider?: string;
  chiefComplaint?: string;
}

export async function createPatientAction(payload: CreatePatientPayload) {
  // Check authentication and role
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can create patients"
    );
  }

  try {
    // Check for existing patients with the same phone or email
    const existingPatients = await findExistingPatients(payload.phone, payload.email);
    
    if (existingPatients.length > 0) {
      return {
        success: false,
        error: "DUPLICATE",
        existingPatients: existingPatients.map(p => ({
          id: p.id,
          fullName: p.fullName,
          phone: p.phone,
          email: p.email,
          dob: p.dob,
          createdAt: p.createdAt,
        })),
      };
    }

    // Combine first and last name
    const fullName = `${payload.firstName} ${payload.lastName}`.trim();

    // Create patient in database
    const patient = await createPatient({
      fullName,
      preferredName: payload.preferredName || null,
      dob: payload.dob || null,
      sexAtBirth: payload.sexAtBirth || null,
      genderIdentity: payload.genderIdentity || null,
      phone: payload.phone || null,
      email: payload.email || null,
      streetAddress: payload.streetAddress || null,
      city: payload.city || null,
      state: payload.state || null,
      zip: payload.zip || null,
      primaryLanguage: payload.primaryLanguage || null,
      preferredCommMethod: payload.preferredCommMethod || null,
      emergencyContactName: payload.emergencyContactName || null,
      emergencyContactRelationship:
        payload.emergencyContactRelationship || null,
      emergencyContactPhone: payload.emergencyContactPhone || null,
      primaryCareProvider: payload.primaryCareProvider || null,
      consentSignatureUrl: payload.consentSignatureUrl || null,
    });

    // Revalidate cache tags
    revalidateTag("patients", "max");
    revalidateTag(`patient:${patient.id}`, "max");
    revalidateTag("waiting-room", "max");
    revalidatePath("/patients");

    return { success: true, patientId: patient.id };
  } catch (error) {
    console.error("Error creating patient:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to create patient"
    );
  }
}

export async function extractPatientIntakeFromTranscriptAction(params: {
  transcript: string;
}) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can use AI intake assistance"
    );
  }

  const openRouterApiKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterApiKey) {
    throw new Error("Missing OPENROUTER_API_KEY environment variable");
  }

  const transcript = params.transcript?.trim();
  if (!transcript) {
    throw new Error("Transcript is required");
  }

  const currentDate = new Date().toISOString().split("T")[0];
  const systemPrompt = `You extract patient intake information from staff or patient speech.
Return ONLY valid JSON and never include markdown.
Only return values that are explicitly stated.
If a field is not clearly stated, omit it or leave it as an empty string.
Convert relative dates using CURRENT_DATE.
Normalize sexAtBirth to one of: male, female, other, prefer_not_to_say.`;

  const userPrompt = `CURRENT_DATE: ${currentDate}

Extract the patient registration fields from this transcript. Return JSON with only these keys when present:
firstName, lastName, dob, sexAtBirth, genderIdentity, phone, email, streetAddress, city, state, primaryLanguage, emergencyContactName, emergencyContactRelationship, emergencyContactPhone, primaryCareProvider, chiefComplaint.

Transcript:
${transcript}`;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterApiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Tele-Medical",
    },
    body: JSON.stringify({
      model: getOpenRouterTextModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenRouter API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new Error("OpenRouter returned empty response");
  }

  const normalizedContent = content.trim();
  const jsonMatch = normalizedContent.match(/\{[\s\S]*\}/);
  const prefill = JSON.parse(jsonMatch ? jsonMatch[0] : normalizedContent) as PatientVoicePrefill;

  return {
    success: true,
    prefill,
  };
}

/**
 * Update patient assignment after creation
 */
export async function updatePatientAssignmentAction(
  patientId: string,
  action: "close" | "start-visit" | "send-to-waiting-room"
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update patient assignment"
    );
  }

  try {
    let updateData: { isAssigned: boolean | null; clinicianId: string | null } =
      {
        isAssigned: null,
        clinicianId: null,
      };

    if (action === "close") {
      // Close: is_assigned = null, clinician_id = null
      updateData = { isAssigned: null, clinicianId: null };
    } else if (action === "start-visit") {
      // Start Visit: is_assigned = true, clinician_id = current user
      updateData = { isAssigned: true, clinicianId: session.id };
    } else if (action === "send-to-waiting-room") {
      // Send to Waiting Room: is_assigned = false, clinician_id = null
      updateData = { isAssigned: false, clinicianId: null };
    }

    await db.update(patients).set(updateData).where(eq(patients.id, patientId));

    // Revalidate cache tags
    revalidateTag(`patient:${patientId}`, "max");
    revalidateTag("patients", "max");
    revalidateTag("waiting-room", "max");
    revalidatePath("/patients");
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating patient assignment:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update patient assignment"
    );
  }
}

/**
 * Update patient consent signature URL
 */
export async function updatePatientConsentSignatureAction(
  patientId: string,
  consentSignatureUrl: string
) {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    throw new Error(
      "Unauthorized: Only doctors and nurses can update patient consent signature"
    );
  }

  try {
    await db
      .update(patients)
      .set({ consentSignatureUrl, updatedAt: new Date() })
      .where(eq(patients.id, patientId));

    // Revalidate cache tags
    revalidateTag(`patient:${patientId}`, "max");
    revalidateTag("patients", "max");
    revalidatePath("/patients");
    revalidatePath(`/patients/${patientId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating patient consent signature:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to update patient consent signature"
    );
  }
}
