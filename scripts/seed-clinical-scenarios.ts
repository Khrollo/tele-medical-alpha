/**
 * Seed realistic clinical demo scenarios for doctor and nurse workflows.
 *
 * Run:
 *   bun scripts/seed-clinical-scenarios.ts
 *   npm run db:seed-clinical-scenarios
 *
 * This script is idempotent for its own seeded records. It:
 * - ensures demo doctor/nurse accounts exist with credential sign-in
 * - replaces prior scenario patients/visits/notes/transcripts for this script
 * - creates realistic chart, waiting-room, open-note, closed-note, and vitals data
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { generateId } from "@better-auth/core/utils/id";
import { hashPassword } from "better-auth/crypto";
import {
  createEmptyVisitNote,
  type VisitNote,
} from "../app/_lib/visit-note/schema";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function applyEnvFile(path: string, overrideExisting: boolean) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();

    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    if (!overrideExisting && process.env[key] !== undefined) continue;
    process.env[key] = val;
  }
}

applyEnvFile(join(root, ".env"), false);
applyEnvFile(join(root, ".env.local"), true);

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required (set in .env or .env.local)");
  process.exit(1);
}

const demoPassword =
  process.env.DEMO_USER_PASSWORD ??
  process.env.NEW_USER_PWD ??
  "password";

const sql = postgres(DATABASE_URL, { max: 1 });

type SeedUserRole = "doctor" | "nurse";

interface SeedUser {
  id: string;
  email: string;
  name: string;
  role: SeedUserRole;
}

interface ScenarioPatient {
  id: string;
  fullName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  sexAtBirth: string;
  genderIdentity: string;
  primaryLanguage: string;
  preferredCommMethod: string;
  emergencyContact: Record<string, string>;
  allergies: unknown[];
  currentMedications: unknown[];
  pastMedicalHistory: unknown[];
  familyHistory: unknown[];
  socialHistory: unknown[];
  surgicalHistory: unknown[];
  vaccines: unknown[];
  vitals: Array<Record<string, string>>;
  clinicianId: string | null;
  isAssigned: boolean;
  consentSignatureUrl?: string | null;
}

interface ScenarioVisit {
  id: string;
  patientId: string;
  clinicianId: string | null;
  status: string;
  notesStatus: string;
  priority: string;
  appointmentType: string;
  createdAt: string;
  updatedAt: string;
  notesFinalizedBy?: string | null;
  notesFinalizedAt?: string | null;
  twilioRoomName?: string | null;
  patientJoinToken?: string | null;
}

interface ScenarioNote {
  id: string;
  visitId: string;
  authorId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  note: VisitNote;
}

interface ScenarioTranscript {
  id: string;
  visitId: string;
  text: string;
  rawText: string;
  createdAt: string;
}

const DEMO_USERS: SeedUser[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "demodoctor@telehealth.com",
    name: "Dr. Maya Carter",
    role: "doctor",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    email: "demonurse@telehealth.com",
    name: "Nurse Devon Brooks",
    role: "nurse",
  },
];

function isoDaysAgo(days: number, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function isoDaysFromNow(days: number, hour = 9, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function visitDateOnly(daysAgo: number) {
  return isoDaysAgo(daysAgo).split("T")[0];
}

function buildNote(mutator: (note: VisitNote) => VisitNote): VisitNote {
  return mutator(createEmptyVisitNote());
}

const doctorIdPlaceholder = DEMO_USERS[0].id;
const nurseIdPlaceholder = DEMO_USERS[1].id;

const patients: ScenarioPatient[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    fullName: "Aaliyah Bennett",
    dob: "1991-04-14",
    phone: "876-555-0101",
    email: "aaliyah.bennett@demo.telemedical.local",
    address: "12 Waterloo Road, Kingston",
    sexAtBirth: "Female",
    genderIdentity: "Female",
    primaryLanguage: "English",
    preferredCommMethod: "Phone",
    emergencyContact: {
      name: "Renee Bennett",
      relationship: "Sister",
      phone: "876-555-0111",
    },
    allergies: [
      { id: "alg-aa-1", name: "Penicillin", severity: "Severe", status: "Active" },
      { id: "alg-aa-2", name: "Shellfish", severity: "Moderate", status: "Active" },
    ],
    currentMedications: [
      { id: "med-aa-1", brandName: "Albuterol", strength: "90 mcg", dosage: "2 puffs", frequency: "As needed", status: "Active" },
    ],
    pastMedicalHistory: [
      { condition: "Asthma", status: "Active", diagnosedDate: "2012-08-01", icd10: "J45.909", source: "Patient report" },
    ],
    familyHistory: [
      { relationship: "Mother", status: "Alive", conditions: "Asthma, hypertension" },
    ],
    socialHistory: [
      { label: "Occupation", value: "Teacher" },
      { label: "Tobacco", value: "Never" },
    ],
    surgicalHistory: [],
    vaccines: [
      { name: "Influenza", date: "2025-10-12", dose: "Annual", site: "Left deltoid", route: "IM", lotNumber: "FLU254", manufacturer: "GSK" },
    ],
    vitals: [
      { id: "v-aa-1", date: visitDateOnly(120), bp: "118/76", hr: "74", temp: "98.4", weight: "156", height: "165", bmi: "26.0", spo2: "98", rr: "14" },
      { id: "v-aa-2", date: visitDateOnly(45), bp: "122/78", hr: "82", temp: "98.8", weight: "158", height: "165", bmi: "26.3", spo2: "97", rr: "16" },
      { id: "v-aa-3", date: visitDateOnly(0), bp: "148/92", hr: "108", temp: "101.1", weight: "160", height: "165", bmi: "26.6", spo2: "93", rr: "22" },
    ],
    clinicianId: null,
    isAssigned: false,
    consentSignatureUrl: "demo://signed/aaliyah-bennett",
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    fullName: "Marcus Taylor",
    dob: "1983-09-03",
    phone: "876-555-0202",
    email: "marcus.taylor@demo.telemedical.local",
    address: "45 Constant Spring Road, Kingston",
    sexAtBirth: "Male",
    genderIdentity: "Male",
    primaryLanguage: "English",
    preferredCommMethod: "SMS",
    emergencyContact: {
      name: "Lydia Taylor",
      relationship: "Spouse",
      phone: "876-555-0222",
    },
    allergies: [{ id: "alg-mt-1", name: "Ibuprofen", severity: "Moderate", status: "Active" }],
    currentMedications: [
      { id: "med-mt-1", brandName: "Metformin", strength: "500 mg", dosage: "1 tablet", frequency: "Twice daily", status: "Active" },
      { id: "med-mt-2", brandName: "Losartan", strength: "50 mg", dosage: "1 tablet", frequency: "Once daily", status: "Active" },
    ],
    pastMedicalHistory: [
      { condition: "Type 2 diabetes mellitus", status: "Active", diagnosedDate: "2020-06-10", icd10: "E11.9", source: "Previous records" },
      { condition: "Hypertension", status: "Active", diagnosedDate: "2019-01-12", icd10: "I10", source: "Previous records" },
    ],
    familyHistory: [
      { relationship: "Father", status: "Alive", conditions: "Type 2 diabetes" },
      { relationship: "Mother", status: "Alive", conditions: "Hypertension" },
    ],
    socialHistory: [
      { label: "Occupation", value: "Operations manager" },
      { label: "Alcohol", value: "Occasional" },
      { label: "Exercise", value: "Walks 3 times weekly" },
    ],
    surgicalHistory: [],
    vaccines: [],
    vitals: [
      { id: "v-mt-1", date: visitDateOnly(180), bp: "142/86", hr: "78", temp: "98.1", weight: "218", height: "178", bmi: "31.3", spo2: "98", rr: "14" },
      { id: "v-mt-2", date: visitDateOnly(90), bp: "136/82", hr: "76", temp: "98.0", weight: "210", height: "178", bmi: "30.1", spo2: "98", rr: "14" },
      { id: "v-mt-3", date: visitDateOnly(0), bp: "132/80", hr: "74", temp: "98.2", weight: "206", height: "178", bmi: "29.6", spo2: "99", rr: "15" },
    ],
    clinicianId: doctorIdPlaceholder,
    isAssigned: true,
    consentSignatureUrl: "demo://signed/marcus-taylor",
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    fullName: "Elena Rodriguez",
    dob: "1978-01-22",
    phone: "876-555-0303",
    email: "elena.rodriguez@demo.telemedical.local",
    address: "7 Manor Park, Kingston",
    sexAtBirth: "Female",
    genderIdentity: "Female",
    primaryLanguage: "Spanish",
    preferredCommMethod: "Phone",
    emergencyContact: {
      name: "Carlos Rodriguez",
      relationship: "Husband",
      phone: "876-555-0333",
    },
    allergies: [{ id: "alg-er-1", name: "Latex", severity: "Moderate", status: "Active" }],
    currentMedications: [
      { id: "med-er-1", brandName: "Levothyroxine", strength: "75 mcg", dosage: "1 tablet", frequency: "Once daily", status: "Active" },
    ],
    pastMedicalHistory: [
      { condition: "Hypothyroidism", status: "Active", diagnosedDate: "2015-03-03", icd10: "E03.9", source: "Previous records" },
    ],
    familyHistory: [{ relationship: "Mother", status: "Alive", conditions: "Breast cancer survivor" }],
    socialHistory: [{ label: "Occupation", value: "Accountant" }],
    surgicalHistory: [{ procedure: "Cesarean section", date: "2008-05-20", site: "Abdomen", surgeon: "Dr. James", outcome: "Recovered", source: "Patient report" }],
    vaccines: [],
    vitals: [
      { id: "v-er-1", date: visitDateOnly(200), bp: "124/78", hr: "72", temp: "98.4", weight: "164", height: "168", bmi: "26.4", spo2: "99", rr: "14" },
      { id: "v-er-2", date: visitDateOnly(0), bp: "126/80", hr: "70", temp: "98.3", weight: "162", height: "168", bmi: "26.1", spo2: "99", rr: "14" },
    ],
    clinicianId: doctorIdPlaceholder,
    isAssigned: false,
    consentSignatureUrl: "demo://signed/elena-rodriguez",
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    fullName: "Samuel Greene",
    dob: "1964-11-09",
    phone: "876-555-0404",
    email: "samuel.greene@demo.telemedical.local",
    address: "88 Hope Road, Kingston",
    sexAtBirth: "Male",
    genderIdentity: "Male",
    primaryLanguage: "English",
    preferredCommMethod: "Phone",
    emergencyContact: {
      name: "Marcia Greene",
      relationship: "Daughter",
      phone: "876-555-0444",
    },
    allergies: [{ id: "alg-sg-1", name: "Sulfa", severity: "Moderate", status: "Active" }],
    currentMedications: [
      { id: "med-sg-1", brandName: "Amlodipine", strength: "10 mg", dosage: "1 tablet", frequency: "Once daily", status: "Active" },
      { id: "med-sg-2", brandName: "Rosuvastatin", strength: "20 mg", dosage: "1 tablet", frequency: "Nightly", status: "Active" },
    ],
    pastMedicalHistory: [
      { condition: "Hypertension", status: "Active", diagnosedDate: "2014-02-15", icd10: "I10", source: "Previous records" },
      { condition: "Hyperlipidemia", status: "Active", diagnosedDate: "2017-07-09", icd10: "E78.5", source: "Previous records" },
    ],
    familyHistory: [{ relationship: "Brother", status: "Alive", conditions: "Stroke at 59" }],
    socialHistory: [
      { label: "Occupation", value: "Retired electrician" },
      { label: "Tobacco", value: "Former smoker" },
    ],
    surgicalHistory: [],
    vaccines: [],
    vitals: [
      { id: "v-sg-1", date: visitDateOnly(270), bp: "154/90", hr: "88", temp: "98.0", weight: "188", height: "172", bmi: "28.6", spo2: "97", rr: "15" },
      { id: "v-sg-2", date: visitDateOnly(180), bp: "148/88", hr: "84", temp: "98.2", weight: "184", height: "172", bmi: "28.0", spo2: "97", rr: "14" },
      { id: "v-sg-3", date: visitDateOnly(90), bp: "142/84", hr: "80", temp: "98.1", weight: "180", height: "172", bmi: "27.4", spo2: "98", rr: "14" },
      { id: "v-sg-4", date: visitDateOnly(14), bp: "136/80", hr: "78", temp: "98.3", weight: "178", height: "172", bmi: "27.1", spo2: "98", rr: "14" },
    ],
    clinicianId: doctorIdPlaceholder,
    isAssigned: false,
    consentSignatureUrl: "demo://signed/samuel-greene",
  },
];

const visits: ScenarioVisit[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    patientId: patients[0].id,
    clinicianId: null,
    status: "Waiting",
    notesStatus: "draft",
    priority: "Critical",
    appointmentType: "In-Person",
    createdAt: isoDaysAgo(0, 8, 15),
    updatedAt: isoDaysAgo(0, 8, 45),
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    patientId: patients[1].id,
    clinicianId: doctorIdPlaceholder,
    status: "In Progress",
    notesStatus: "draft",
    priority: "Urgent",
    appointmentType: "Virtual",
    createdAt: isoDaysAgo(0, 10, 0),
    updatedAt: isoDaysAgo(0, 11, 10),
    twilioRoomName: "demo-room-marcus-taylor",
    patientJoinToken: "demo-join-marcus-taylor",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    patientId: patients[2].id,
    clinicianId: doctorIdPlaceholder,
    status: "Signed & Complete",
    notesStatus: "finalized",
    priority: "Routine",
    appointmentType: "In-Person",
    createdAt: isoDaysAgo(0, 7, 30),
    updatedAt: isoDaysAgo(0, 8, 30),
    notesFinalizedBy: doctorIdPlaceholder,
    notesFinalizedAt: isoDaysAgo(0, 8, 30),
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    patientId: patients[3].id,
    clinicianId: doctorIdPlaceholder,
    status: "Signed & Complete",
    notesStatus: "finalized",
    priority: "Routine",
    appointmentType: "In-Person",
    createdAt: isoDaysAgo(14, 9, 0),
    updatedAt: isoDaysAgo(14, 9, 45),
    notesFinalizedBy: doctorIdPlaceholder,
    notesFinalizedAt: isoDaysAgo(14, 9, 45),
  },
];

const notes: ScenarioNote[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    visitId: visits[0].id,
    authorId: nurseIdPlaceholder,
    status: "draft",
    createdAt: isoDaysAgo(0, 8, 20),
    updatedAt: isoDaysAgo(0, 8, 45),
    note: buildNote((note) => ({
      ...note,
      subjective: {
        chiefComplaint: "Shortness of breath, wheezing, and fever since last night",
        hpi: "Nurse intake completed. Patient reports worsening wheeze after running out of rescue inhaler. Cough productive of yellow sputum, fever at home, and chest tightness with walking from parking area.",
      },
      objective: {
        ...note.objective,
        bp: "148/92",
        hr: "108",
        temp: "101.1",
        spo2: "93",
        weight: "160",
        height: "165",
        bmi: "26.6",
        examFindings: {
          ...note.objective.examFindings,
          general: "Appears mildly distressed, speaking in short phrases.",
          lungs: "Diffuse expiratory wheeze bilaterally.",
        },
      },
      reviewOfSystems: {
        ...note.reviewOfSystems,
        constitutional: { status: "positive", notes: "Fever and fatigue." },
        respiratory: { status: "positive", notes: "Wheeze, productive cough, dyspnea." },
        cardiovascular: { status: "negative", notes: "No chest pain." },
      },
      medications: [
        {
          id: "visit-med-aa-1",
          brandName: "Albuterol",
          strength: "90 mcg",
          form: "Inhaler",
          dosage: "2 puffs",
          frequency: "As needed",
          status: "Active",
          notes: "Ran out yesterday",
        },
      ],
      riskFlags: {
        tobaccoUse: "Never",
        tobaccoAmount: "",
        alcoholUse: "Occasional",
        alcoholFrequency: "1-2 drinks monthly",
        housingStatus: "Stable",
        occupation: "Teacher",
      },
      visitActions: {
        ...note.visitActions,
        labs: [
          {
            test: "CBC with differential",
            priority: "routine",
            notes: "",
            urgency: "STAT",
            clinicalIndication: "Acute febrile respiratory complaint with tachycardia",
          },
        ],
        imaging: [
          {
            study: "Chest X-ray",
            priority: "routine",
            notes: "",
            bodyRegion: "Chest",
            urgency: "STAT",
            clinicalIndication: "Rule out pneumonia",
          },
        ],
      },
      consents: {
        aiTranscript: false,
        aiTranscriptConfirmedAt: "",
        aiTranscriptConfirmedBy: "",
      },
    })),
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    visitId: visits[1].id,
    authorId: doctorIdPlaceholder,
    status: "draft",
    createdAt: isoDaysAgo(0, 10, 10),
    updatedAt: isoDaysAgo(0, 11, 10),
    note: buildNote((note) => ({
      ...note,
      subjective: {
        chiefComplaint: "Blood sugar review and medication refill",
        hpi: "Video follow-up for diabetes and blood pressure. Home glucose readings mostly 110-145. Denies dizziness or blurred vision. Discussed adherence challenges on late shifts.",
      },
      objective: {
        ...note.objective,
        bp: "132/80",
        hr: "74",
        temp: "98.2",
        spo2: "99",
        weight: "206",
        height: "178",
        bmi: "29.6",
        examFindings: {
          ...note.objective.examFindings,
          general: "Comfortable on video, no acute distress.",
          cardiovascular: "No visible distress; home cuff reviewed during visit.",
        },
      },
      reviewOfSystems: {
        ...note.reviewOfSystems,
        constitutional: { status: "negative", notes: "No fever or fatigue." },
        cardiovascular: { status: "negative", notes: "No chest pain or palpitations." },
        neurologic: { status: "negative", notes: "No neuropathic symptoms today." },
      },
      assessmentPlan: [
        {
          assessment: "Type 2 diabetes mellitus, improved control (E11.9)",
          plan: "Continue metformin, reinforce diet counseling, and repeat A1c in 3 months.",
          medications: [
            {
              brandName: "Metformin",
              strength: "500 mg",
              form: "Tablet",
              dosage: "1 tablet",
              frequency: "Twice daily",
            },
          ],
          orders: [
            {
              type: "Lab",
              priority: "Routine",
              details: "Hemoglobin A1c",
              status: "Pending",
              dateOrdered: isoDaysAgo(0, 11, 0),
            },
          ],
          followUp: "Telehealth follow-up in 12 weeks.",
          education: "Reviewed meal planning and logging fasting sugars.",
          coordination: "No referral needed at this time.",
        },
      ],
      orders: [
        {
          type: "Lab",
          priority: "Routine",
          details: "Hemoglobin A1c",
          status: "Pending",
          dateOrdered: isoDaysAgo(0, 11, 0),
        },
      ],
      visitActions: {
        ...note.visitActions,
        prescriptions: [
          {
            medication: "Metformin",
            dosage: "500 mg",
            instructions: "Take with meals",
            pharmacy: "Hope Plaza Pharmacy",
            frequency: "Twice daily",
            durationValue: "90",
            durationUnit: "days",
            notes: "Refill authorized",
          },
        ],
        labs: [
          {
            test: "Hemoglobin A1c",
            priority: "routine",
            notes: "",
            urgency: "Routine",
            clinicalIndication: "Quarterly diabetes monitoring",
          },
        ],
        nextSteps: [
          { task: "Upload home glucose log", owner: "Patient", dueBy: isoDaysFromNow(2, 17, 0) },
          { task: "Review A1c result", owner: "Care team", dueBy: isoDaysFromNow(5, 10, 0) },
        ],
      },
      coding: {
        ...note.coding,
        suggestedIcd10Codes: ["E11.9", "I10"],
        icd10Codes: ["E11.9", "I10"],
        suggestedCptCodes: ["99214"],
        cptCodes: ["99214"],
        mdmComplexity: "moderate",
        visitDurationMinutes: "28",
      },
      consents: {
        aiTranscript: true,
        aiTranscriptConfirmedAt: isoDaysAgo(0, 10, 5),
        aiTranscriptConfirmedBy: doctorIdPlaceholder,
      },
      transcript: "Patient reports improved fasting sugars, taking medications regularly, and no acute symptoms.",
      aiGeneratedAt: isoDaysAgo(0, 10, 55),
    })),
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    visitId: visits[2].id,
    authorId: doctorIdPlaceholder,
    status: "finalized",
    createdAt: isoDaysAgo(0, 7, 45),
    updatedAt: isoDaysAgo(0, 8, 30),
    finalizedBy: doctorIdPlaceholder,
    finalizedAt: isoDaysAgo(0, 8, 30),
    note: buildNote((note) => ({
      ...note,
      subjective: {
        chiefComplaint: "Persistent RUQ pain after fatty meals",
        hpi: "Seen for intermittent right upper quadrant pain and nausea after meals. Ultrasound ordered and discussed with patient; symptoms improved today but continue to recur weekly.",
      },
      objective: {
        ...note.objective,
        bp: "126/80",
        hr: "70",
        temp: "98.3",
        spo2: "99",
        weight: "162",
        height: "168",
        bmi: "26.1",
        examFindings: {
          ...note.objective.examFindings,
          abdomen: "Mild RUQ tenderness without guarding.",
          general: "Well appearing, no acute distress.",
        },
      },
      reviewOfSystems: {
        ...note.reviewOfSystems,
        gastrointestinal: { status: "positive", notes: "RUQ pain and nausea after meals." },
        constitutional: { status: "negative", notes: "No fever or chills." },
      },
      assessmentPlan: [
        {
          assessment: "Biliary colic, probable cholelithiasis (K80.20)",
          plan: "Diet modification, review ultrasound, and surgical referral if symptoms persist.",
          medications: [],
          orders: [
            {
              type: "Imaging",
              priority: "Routine",
              details: "Abdominal ultrasound - gallbladder",
              status: "Completed",
              dateOrdered: isoDaysAgo(0, 8, 0),
            },
            {
              type: "Lab",
              priority: "Routine",
              details: "CMP and CBC",
              status: "Completed",
              dateOrdered: isoDaysAgo(0, 8, 0),
            },
          ],
          followUp: "Return in 2 weeks or sooner for worsening pain or fever.",
          education: "Reviewed low-fat diet and ER precautions.",
          coordination: "General surgery referral placed if ultrasound confirms stones.",
        },
      ],
      orders: [
        {
          type: "Imaging",
          priority: "Routine",
          details: "Abdominal ultrasound - gallbladder",
          status: "Completed",
          dateOrdered: isoDaysAgo(0, 8, 0),
        },
        {
          type: "Lab",
          priority: "Routine",
          details: "CMP and CBC",
          status: "Completed",
          dateOrdered: isoDaysAgo(0, 8, 0),
        },
      ],
      visitActions: {
        ...note.visitActions,
        imaging: [
          {
            study: "Abdominal ultrasound",
            priority: "routine",
            notes: "Gallbladder focus",
            bodyRegion: "RUQ",
            urgency: "Routine",
            clinicalIndication: "Post-prandial RUQ pain",
          },
        ],
        labs: [
          {
            test: "CMP and CBC",
            priority: "routine",
            notes: "",
            urgency: "Routine",
            clinicalIndication: "Evaluate biliary pain and infection markers",
          },
        ],
        referrals: [
          {
            specialty: "General Surgery",
            reason: "Possible cholelithiasis with recurrent symptoms",
            urgency: "routine",
            providerName: "Pending review",
          },
        ],
      },
      coding: {
        ...note.coding,
        suggestedIcd10Codes: ["K80.20", "R10.11"],
        icd10Codes: ["K80.20", "R10.11"],
        suggestedCptCodes: ["99214"],
        cptCodes: ["99214"],
        mdmComplexity: "moderate",
        visitDurationMinutes: "32",
      },
      signOff: {
        attestationAccepted: true,
        signedBy: doctorIdPlaceholder,
        signedAt: isoDaysAgo(0, 8, 30),
        amendmentReason: "",
      },
    })),
  },
  {
    id: "50000000-0000-4000-8000-000000000004",
    visitId: visits[3].id,
    authorId: doctorIdPlaceholder,
    status: "finalized",
    createdAt: isoDaysAgo(14, 9, 10),
    updatedAt: isoDaysAgo(14, 9, 45),
    finalizedBy: doctorIdPlaceholder,
    finalizedAt: isoDaysAgo(14, 9, 45),
    note: buildNote((note) => ({
      ...note,
      subjective: {
        chiefComplaint: "Blood pressure review",
        hpi: "Routine follow-up for hypertension and lipid management. Home BP trend improved after medication adherence and salt reduction.",
      },
      objective: {
        ...note.objective,
        bp: "136/80",
        hr: "78",
        temp: "98.3",
        spo2: "98",
        weight: "178",
        height: "172",
        bmi: "27.1",
      },
      assessmentPlan: [
        {
          assessment: "Essential hypertension, improving (I10)",
          plan: "Continue amlodipine and continue lifestyle changes.",
          medications: [
            {
              brandName: "Amlodipine",
              strength: "10 mg",
              form: "Tablet",
              dosage: "1 tablet",
              frequency: "Once daily",
            },
          ],
          orders: [],
          followUp: "Follow-up in 3 months.",
          education: "Reviewed sodium restriction and medication adherence.",
          coordination: "",
        },
      ],
      coding: {
        ...note.coding,
        suggestedIcd10Codes: ["I10", "E78.5"],
        icd10Codes: ["I10", "E78.5"],
        suggestedCptCodes: ["99213"],
        cptCodes: ["99213"],
        mdmComplexity: "low",
        visitDurationMinutes: "20",
      },
      signOff: {
        attestationAccepted: true,
        signedBy: doctorIdPlaceholder,
        signedAt: isoDaysAgo(14, 9, 45),
        amendmentReason: "",
      },
    })),
  },
];

const transcripts: ScenarioTranscript[] = [
  {
    id: "60000000-0000-4000-8000-000000000001",
    visitId: visits[1].id,
    text: "Patient states glucose readings are better controlled this month and requests refill of metformin.",
    rawText: "Patient states glucose readings are better controlled this month and requests refill of metformin.",
    createdAt: isoDaysAgo(0, 10, 55),
  },
];

function applyResolvedUserIds(resolvedDoctorId: string, resolvedNurseId: string) {
  for (const patient of patients) {
    if (patient.clinicianId === doctorIdPlaceholder) {
      patient.clinicianId = resolvedDoctorId;
    }
    if (patient.clinicianId === nurseIdPlaceholder) {
      patient.clinicianId = resolvedNurseId;
    }
  }

  for (const visit of visits) {
    if (visit.clinicianId === doctorIdPlaceholder) {
      visit.clinicianId = resolvedDoctorId;
    }
    if (visit.clinicianId === nurseIdPlaceholder) {
      visit.clinicianId = resolvedNurseId;
    }
    if (visit.notesFinalizedBy === doctorIdPlaceholder) {
      visit.notesFinalizedBy = resolvedDoctorId;
    }
    if (visit.notesFinalizedBy === nurseIdPlaceholder) {
      visit.notesFinalizedBy = resolvedNurseId;
    }
  }

  for (const note of notes) {
    if (note.authorId === doctorIdPlaceholder) {
      note.authorId = resolvedDoctorId;
    }
    if (note.authorId === nurseIdPlaceholder) {
      note.authorId = resolvedNurseId;
    }
    if (note.finalizedBy === doctorIdPlaceholder) {
      note.finalizedBy = resolvedDoctorId;
    }
    if (note.finalizedBy === nurseIdPlaceholder) {
      note.finalizedBy = resolvedNurseId;
    }

    if (note.note.consents.aiTranscriptConfirmedBy === doctorIdPlaceholder) {
      note.note.consents.aiTranscriptConfirmedBy = resolvedDoctorId;
    }
    if (note.note.consents.aiTranscriptConfirmedBy === nurseIdPlaceholder) {
      note.note.consents.aiTranscriptConfirmedBy = resolvedNurseId;
    }
    if (note.note.signOff.signedBy === doctorIdPlaceholder) {
      note.note.signOff.signedBy = resolvedDoctorId;
    }
    if (note.note.signOff.signedBy === nurseIdPlaceholder) {
      note.note.signOff.signedBy = resolvedNurseId;
    }
  }
}

async function upsertUser(user: SeedUser) {
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE lower(trim(email)) = ${user.email.toLowerCase()} LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE users
      SET name = ${user.name},
          role = ${user.role},
          updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  await sql`
    INSERT INTO users (id, email, name, role, email_verified, created_at, updated_at)
    VALUES (${user.id}, ${user.email.toLowerCase()}, ${user.name}, ${user.role}, true, now(), now())
  `;
  return user.id;
}

async function ensureCredentialAccount(userId: string, email: string) {
  const hashed = await hashPassword(demoPassword);
  const existing = await sql<{ id: string }[]>`
    SELECT id FROM accounts
    WHERE user_id = ${userId} AND provider_id = 'credential'
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE accounts
      SET password = ${hashed}, updated_at = now()
      WHERE id = ${existing[0].id}
    `;
    return;
  }

  await sql`
    INSERT INTO accounts (id, user_id, account_id, provider_id, password, created_at, updated_at)
    VALUES (${generateId()}, ${userId}, ${userId}, 'credential', ${hashed}, now(), now())
  `;

  console.log(`  [ok] credential account ensured for ${email}`);
}

async function resetScenarioData() {
  const patientIds = patients.map((patient) => patient.id);
  const visitIds = visits.map((visit) => visit.id);

  await sql`DELETE FROM transcripts WHERE visit_id IN ${sql(visitIds)}`;
  await sql`DELETE FROM notes WHERE visit_id IN ${sql(visitIds)}`;
  await sql`DELETE FROM visits WHERE id IN ${sql(visitIds)}`;
  await sql`DELETE FROM patients WHERE id IN ${sql(patientIds)}`;
}

async function insertPatients() {
  for (const patient of patients) {
    const allergiesJson = JSON.stringify(patient.allergies);
    const medicationsJson = JSON.stringify(patient.currentMedications);
    const pmhJson = JSON.stringify(patient.pastMedicalHistory);
    const vaccinesJson = JSON.stringify(patient.vaccines);
    const familyHistoryJson = JSON.stringify(patient.familyHistory);
    const vitalsJson = JSON.stringify(patient.vitals);
    const socialHistoryJson = JSON.stringify(patient.socialHistory);
    const surgicalHistoryJson = JSON.stringify(patient.surgicalHistory);
    const emergencyContactJson = JSON.stringify(patient.emergencyContact);

    await sql`
      INSERT INTO patients (
        id, full_name, dob, sex_at_birth, gender_identity, phone, email, address,
        primary_language, preferred_comm_method, allergies, current_medications,
        past_medical_history, clinician_id, created_at, updated_at, vaccines,
        family_history, vitals, social_history, surgical_history, emergency_contact,
        is_assigned, consent_signature_url
      )
      VALUES (
        ${patient.id},
        ${patient.fullName},
        ${patient.dob},
        ${patient.sexAtBirth},
        ${patient.genderIdentity},
        ${patient.phone},
        ${patient.email},
        ${patient.address},
        ${patient.primaryLanguage},
        ${patient.preferredCommMethod},
        CAST(${allergiesJson} AS jsonb),
        CAST(${medicationsJson} AS jsonb),
        CAST(${pmhJson} AS jsonb),
        ${patient.clinicianId},
        now(),
        now(),
        CAST(${vaccinesJson} AS jsonb),
        CAST(${familyHistoryJson} AS jsonb),
        CAST(${vitalsJson} AS jsonb),
        CAST(${socialHistoryJson} AS jsonb),
        CAST(${surgicalHistoryJson} AS jsonb),
        CAST(${emergencyContactJson} AS jsonb),
        ${patient.isAssigned},
        ${patient.consentSignatureUrl ?? null}
      )
    `;
  }
}

async function insertVisits() {
  for (const visit of visits) {
    await sql`
      INSERT INTO visits (
        id, patient_id, clinician_id, status, created_at, notes_status,
        notes_finalized_by, notes_finalized_at, priority, appointment_type,
        twilio_room_name, patient_join_token
      )
      VALUES (
        ${visit.id},
        ${visit.patientId},
        ${visit.clinicianId},
        ${visit.status},
        ${visit.createdAt},
        ${visit.notesStatus},
        ${visit.notesFinalizedBy ?? null},
        ${visit.notesFinalizedAt ?? null},
        ${visit.priority},
        ${visit.appointmentType},
        ${visit.twilioRoomName ?? null},
        ${visit.patientJoinToken ?? null}
      )
    `;
  }
}

async function insertNotes() {
  for (const note of notes) {
    const noteJson = JSON.stringify(note.note);
    const auditJson = JSON.stringify({
      entries: [
        {
          timestamp: note.updatedAt,
          userId: note.authorId,
          userName:
            note.authorId === doctorIdPlaceholder
              ? DEMO_USERS[0].name
              : note.authorId === nurseIdPlaceholder
                ? DEMO_USERS[1].name
                : null,
          action: note.status === "finalized" ? "finalized" : "saved",
          fromStatus: note.status === "finalized" ? "In Progress" : null,
          toStatus:
            note.status === "finalized" ? "Signed & Complete" : "In Progress",
        },
      ],
    });

    await sql`
      INSERT INTO notes (
        id, visit_id, note, content, status, finalized_by, finalized_at,
        created_at, updated_at, author_id, audit
      )
      VALUES (
        ${note.id},
        ${note.visitId},
        CAST(${noteJson} AS jsonb),
        ${noteJson},
        ${note.status},
        ${note.finalizedBy ?? null},
        ${note.finalizedAt ?? null},
        ${note.createdAt},
        ${note.updatedAt},
        ${note.authorId},
        CAST(${auditJson} AS jsonb)
      )
    `;
  }
}

async function insertTranscripts() {
  for (const transcript of transcripts) {
    await sql`
      INSERT INTO transcripts (id, visit_id, raw_text, text, status, created_at)
      VALUES (
        ${transcript.id},
        ${transcript.visitId},
        ${transcript.rawText},
        ${transcript.text},
        'completed',
        ${transcript.createdAt}
      )
    `;
  }
}

async function summarizeSeed() {
  const seededPatients = await sql<{ full_name: string; email: string }[]>`
    SELECT full_name, email
    FROM patients
    WHERE id IN ${sql(patients.map((patient) => patient.id))}
    ORDER BY full_name
  `;

  console.log("\nSeeded clinical scenarios:");
  for (const patient of seededPatients) {
    console.log(`  - ${patient.full_name} <${patient.email}>`);
  }

  console.log("\nDemo clinicians:");
  for (const user of DEMO_USERS) {
    console.log(`  - ${user.role}: ${user.email} / ${demoPassword}`);
  }
}

async function main() {
  console.log("Seeding clinical scenario data...\n");

  let resolvedDoctorId = doctorIdPlaceholder;
  let resolvedNurseId = nurseIdPlaceholder;

  for (const user of DEMO_USERS) {
    const userId = await upsertUser(user);
    await ensureCredentialAccount(userId, user.email);
    if (user.role === "doctor") {
      resolvedDoctorId = userId;
    }
    if (user.role === "nurse") {
      resolvedNurseId = userId;
    }
    console.log(`  [ok] user ${user.email} -> ${user.role}`);
  }

  applyResolvedUserIds(resolvedDoctorId, resolvedNurseId);

  await resetScenarioData();
  await insertPatients();
  await insertVisits();
  await insertNotes();
  await insertTranscripts();
  await summarizeSeed();

  await sql.end();
  console.log("\nDone.");
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await sql.end();
  process.exit(1);
});
