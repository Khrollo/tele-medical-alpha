import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/app/_lib/supabase/server";
import { generateTwilioToken, verifyPatientJoinToken } from "@/app/_lib/twilio/video";
import { getVisitById } from "@/app/_lib/db/drizzle/queries/visit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { appointmentId, role, joinToken } = body;

    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId is required" },
        { status: 400 }
      );
    }

    // Get visit to verify and get room name
    const visit = await getVisitById(appointmentId);
    if (!visit) {
      return NextResponse.json(
        { error: "Visit not found" },
        { status: 404 }
      );
    }

    if (!visit.twilioRoomName) {
      return NextResponse.json(
        { error: "Twilio room not set up for this visit" },
        { status: 400 }
      );
    }

    let participantIdentity: string;
    let tokenRole: "doctor" | "patient";

    if (role === "patient" && joinToken) {
      // Verify patient join token
      const tokenData = verifyPatientJoinToken(joinToken);
      if (!tokenData || tokenData.visitId !== appointmentId) {
        return NextResponse.json(
          { error: "Invalid or expired join token" },
          { status: 401 }
        );
      }
      participantIdentity = `patient-${visit.patientId}`;
      tokenRole = "patient";
    } else if (role === "doctor") {
      // Verify doctor/nurse authentication
      const session = await getServerSession();
      if (!session || (session.role !== "doctor" && session.role !== "nurse")) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      
      // Verify access:
      // - Doctors must be assigned to this visit (clinicianId matches)
      // - Nurses can join if visit is virtual, has a clinician assigned, and has a join token
      if (session.role === "doctor") {
        if (visit.clinicianId !== session.id) {
          return NextResponse.json(
            { error: "Not assigned to this visit" },
            { status: 403 }
          );
        }
      } else if (session.role === "nurse") {
        // Nurses can join if visit is virtual, has clinician assigned, and has join token
        if (!visit.clinicianId || !visit.patientJoinToken || visit.appointmentType?.toLowerCase() !== "virtual") {
          return NextResponse.json(
            { error: "Visit not ready for nurse access" },
            { status: 403 }
          );
        }
      }
      
      participantIdentity = `doctor-${session.id}`;
      tokenRole = "doctor";
    } else {
      return NextResponse.json(
        { error: "Invalid role or missing joinToken for patient" },
        { status: 400 }
      );
    }

    // Generate Twilio access token
    const token = generateTwilioToken(visit.twilioRoomName, participantIdentity, tokenRole);

    return NextResponse.json({
      token,
      roomName: visit.twilioRoomName,
    });
  } catch (error) {
    console.error("Error generating video token:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}

