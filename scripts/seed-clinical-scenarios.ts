/**
 * Seed realistic clinical demo scenarios that cover every UI filter state.
 *
 * Run:
 *   bun scripts/seed-clinical-scenarios.ts
 *   npm run db:seed-clinical-scenarios
 *
 * Why this script exists:
 *   The Clearing-redesigned UI has filter chips and workflow chips that were
 *   not all represented in previous demo data. A stakeholder loading the app
 *   after a fresh seed would see empty buckets for "Urgent virtual",
 *   "Routine mild", "Drafts", etc. — making the app look broken even though
 *   the code is fine. This seeder guarantees at least one row per filter
 *   bucket so every visible state in the product has live data behind it.
 *
 * Filter coverage (enforced by the SCENARIOS catalog at the top):
 *   Waiting-room priority:   critical | urgent | routine | mild
 *   Appointment type:        virtual  | in-person
 *   Visit lifecycle:         Waiting  | In Progress | finalized | signed | draft
 *   Assignment state:        unassigned | assigned (to demo doctor)
 *   Workflow chips:          vitals captured, labs pending, labs ready,
 *                            imaging pending, imaging ready
 *
 * Idempotency:
 *   Scenario patients are identified by a `[seed:<scenarioId>]` tag appended
 *   to their full_name. On every run we delete and re-create only the rows
 *   that carry that tag — we never touch hand-created production or fixture
 *   data. This makes the script safe to run repeatedly against any env that
 *   already has its own patient history.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { createEmptyVisitNote } from "../app/_lib/visit-note/schema";

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

const sql = postgres(DATABASE_URL, { max: 1 });

const SEED_TAG = "[seed:clinical]";
const DEMO_DOCTOR_EMAIL = "doctor.demo@telemedical.local";

type Priority = "critical" | "urgent" | "routine" | "mild";
type AppointmentType = "virtual" | "in-person";
type VisitStatus =
  | "Waiting"
  | "In Progress"
  | "finalized"
  | "signed"
  | "draft";

interface OrderSeed {
  type: string; // "CBC", "Chest X-Ray", etc. Free-text — matches UI expectations.
  status: "pending" | "in_progress" | "resulted" | "ready";
}

interface Scenario {
  id: string;
  fullName: string;
  dob: string; // YYYY-MM-DD
  sexAtBirth: "Female" | "Male";
  priority: Priority | null;
  appointmentType: AppointmentType;
  visitStatus: VisitStatus;
  assign: boolean; // assign to demo doctor
  chiefComplaint: string;
  allergies: string[];
  currentMedications: string[];
  // Vitals block — presence alone drives the "Vitals ✓" workflow chip.
  vitals: {
    bp?: string;
    hr?: number;
    temp?: number;
    spo2?: number;
    weight?: number;
  } | null;
  // Orders feed the labs/imaging workflow chips via tallyOrdersForWorkflow.
  orders: OrderSeed[];
  // Minutes since queue entry; wait-time metric on the board.
  waitMinutesAgo: number;
}

// Every row below represents a deliberate UI state a stakeholder needs to
// see during a demo. Comments call out which filter bucket each row unlocks.
const SCENARIOS: Scenario[] = [
  // --- Waiting room: unassigned, actively waiting -------------------------
  {
    id: "wr-critical-inperson",
    fullName: "Amelia Hart",
    dob: "1962-03-14",
    sexAtBirth: "Female",
    priority: "critical",
    appointmentType: "in-person",
    visitStatus: "Waiting",
    assign: false,
    chiefComplaint: "Chest pain radiating to left arm, onset 40m ago",
    allergies: ["Penicillin"],
    currentMedications: ["Atorvastatin 40mg", "Lisinopril 10mg"],
    vitals: { bp: "162/98", hr: 112, temp: 37.1, spo2: 96, weight: 74 },
    orders: [
      { type: "Troponin", status: "pending" },
      { type: "ECG 12-lead", status: "pending" },
    ],
    waitMinutesAgo: 12,
  },
  {
    id: "wr-critical-virtual",
    fullName: "Noah Feld",
    dob: "1978-07-02",
    sexAtBirth: "Male",
    priority: "critical",
    appointmentType: "virtual",
    visitStatus: "Waiting",
    assign: false,
    chiefComplaint: "Severe shortness of breath, SpO2 dropping at home",
    allergies: [],
    currentMedications: ["Albuterol inhaler"],
    vitals: { bp: "128/82", hr: 118, temp: 37.5, spo2: 91 },
    orders: [],
    waitMinutesAgo: 3,
  },
  {
    id: "wr-urgent-inperson",
    fullName: "Riya Patel",
    dob: "1994-11-30",
    sexAtBirth: "Female",
    priority: "urgent",
    appointmentType: "in-person",
    visitStatus: "Waiting",
    assign: false,
    chiefComplaint: "High fever for 3 days, productive cough",
    allergies: ["Sulfa drugs"],
    currentMedications: [],
    vitals: { bp: "118/74", hr: 102, temp: 38.7, spo2: 97 },
    orders: [
      { type: "CBC with differential", status: "in_progress" },
      { type: "Chest X-Ray", status: "pending" },
    ],
    waitMinutesAgo: 22,
  },
  {
    id: "wr-urgent-virtual",
    fullName: "Dominic Webb",
    dob: "1985-05-18",
    sexAtBirth: "Male",
    priority: "urgent",
    appointmentType: "virtual",
    visitStatus: "Waiting",
    assign: false,
    chiefComplaint: "Severe migraine not responding to home meds",
    allergies: [],
    currentMedications: ["Sumatriptan 50mg prn"],
    vitals: { bp: "138/88", hr: 84, temp: 36.8 },
    orders: [],
    waitMinutesAgo: 8,
  },
  {
    id: "wr-routine-inperson",
    fullName: "Grace Oduya",
    dob: "1990-01-22",
    sexAtBirth: "Female",
    priority: "routine",
    appointmentType: "in-person",
    visitStatus: "Waiting",
    assign: false,
    chiefComplaint: "Annual physical — no acute complaints",
    allergies: [],
    currentMedications: [],
    vitals: { bp: "114/72", hr: 68, temp: 36.6, spo2: 99, weight: 61 },
    orders: [
      { type: "Lipid panel", status: "resulted" },
      { type: "HbA1c", status: "resulted" },
    ],
    waitMinutesAgo: 44,
  },
  {
    id: "wr-mild-virtual",
    fullName: "Teresa Lin",
    dob: "1999-09-03",
    sexAtBirth: "Female",
    priority: "mild",
    appointmentType: "virtual",
    visitStatus: "Waiting",
    assign: false,
    chiefComplaint: "Mild rash on forearm after new detergent",
    allergies: [],
    currentMedications: [],
    vitals: null,
    orders: [],
    waitMinutesAgo: 70,
  },
  // --- Waiting room: unassigned but already IN PROGRESS (roomed, unclaimed) --
  // Covers the "Arrival: Roomed" case that the audit flagged as unseeded.
  {
    id: "wr-inprogress-unassigned",
    fullName: "Isaac Blackmon",
    dob: "1971-06-09",
    sexAtBirth: "Male",
    priority: "urgent",
    appointmentType: "in-person",
    visitStatus: "In Progress",
    assign: false,
    chiefComplaint: "Chronic back pain flare, pain 8/10",
    allergies: [],
    currentMedications: ["Ibuprofen 800mg"],
    vitals: { bp: "142/90", hr: 88, temp: 36.9, weight: 82 },
    orders: [{ type: "Lumbar X-Ray", status: "in_progress" }],
    waitMinutesAgo: 18,
  },
  // --- Doctor's panel: actively owned visits --------------------------------
  {
    id: "doc-inprogress-virtual",
    fullName: "Maya Okafor",
    dob: "1988-02-12",
    sexAtBirth: "Female",
    priority: "routine",
    appointmentType: "virtual",
    visitStatus: "In Progress",
    assign: true,
    chiefComplaint: "Follow-up for hypothyroidism medication titration",
    allergies: [],
    currentMedications: ["Levothyroxine 75mcg"],
    vitals: { bp: "110/70", hr: 72, temp: 36.7, weight: 64 },
    orders: [{ type: "TSH, Free T4", status: "resulted" }],
    waitMinutesAgo: 5,
  },
  {
    id: "doc-draft-note",
    fullName: "Jordan Pereira",
    dob: "1955-04-28",
    sexAtBirth: "Male",
    priority: "routine",
    appointmentType: "in-person",
    visitStatus: "draft",
    assign: true,
    chiefComplaint: "New-onset atrial fibrillation follow-up",
    allergies: ["Iodine contrast"],
    currentMedications: ["Metoprolol 50mg", "Apixaban 5mg"],
    vitals: { bp: "128/80", hr: 76, temp: 36.6, spo2: 97 },
    orders: [{ type: "Echocardiogram", status: "resulted" }],
    waitMinutesAgo: 0,
  },
  // --- Finalized + Signed: populates Visit History non-draft filters --------
  {
    id: "doc-finalized",
    fullName: "Helen Jepsen",
    dob: "1967-12-01",
    sexAtBirth: "Female",
    priority: "routine",
    appointmentType: "virtual",
    visitStatus: "finalized",
    assign: true,
    chiefComplaint: "Diabetes check-in, A1c review",
    allergies: [],
    currentMedications: ["Metformin 1000mg", "Empagliflozin 10mg"],
    vitals: { bp: "122/78", hr: 74, temp: 36.5, weight: 79 },
    orders: [{ type: "HbA1c", status: "resulted" }],
    waitMinutesAgo: 0,
  },
  {
    id: "doc-signed",
    fullName: "Marcus Reyes",
    dob: "1980-08-15",
    sexAtBirth: "Male",
    priority: "routine",
    appointmentType: "in-person",
    visitStatus: "signed",
    assign: true,
    chiefComplaint: "Post-op knee evaluation, 4 weeks out",
    allergies: [],
    currentMedications: ["Acetaminophen 500mg prn"],
    vitals: { bp: "118/76", hr: 70, temp: 36.6, weight: 83 },
    orders: [{ type: "Knee MRI", status: "resulted" }],
    waitMinutesAgo: 0,
  },
];

async function findDemoDoctorId(): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM users
    WHERE lower(trim(email)) = ${DEMO_DOCTOR_EMAIL.toLowerCase()}
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

async function deletePriorSeedRows(): Promise<void> {
  // Patients carry the `[seed:clinical]` tag in their full_name. Cascade
  // deletes wipe visits, notes, and transcripts in one shot via the FK
  // ON DELETE CASCADE.
  const { count } = await sql`
    WITH deleted AS (
      DELETE FROM patients WHERE full_name LIKE ${"%" + SEED_TAG + "%"}
      RETURNING id
    )
    SELECT count(*)::int AS count FROM deleted
  `.then((r) => ({ count: (r[0] as { count: number }).count }));
  if (count > 0) {
    console.log(`  [clean] removed ${count} prior seeded patient(s)`);
  }
}

async function seedScenario(
  scenario: Scenario,
  doctorId: string | null,
): Promise<void> {
  const taggedName = `${scenario.fullName} ${SEED_TAG}`;
  const waitBase = new Date(Date.now() - scenario.waitMinutesAgo * 60_000);

  // 1. Patient row. isAssigned flips based on the scenario's intent.
  const patientRows = await sql<{ id: string }[]>`
    INSERT INTO patients (
      full_name, dob, sex_at_birth, allergies, current_medications,
      vitals, is_assigned, clinician_id, created_at, updated_at
    ) VALUES (
      ${taggedName},
      ${scenario.dob},
      ${scenario.sexAtBirth},
      ${sql.json(scenario.allergies)},
      ${sql.json(scenario.currentMedications)},
      ${scenario.vitals ? sql.json(scenario.vitals) : null},
      ${scenario.assign},
      ${scenario.assign ? doctorId : null},
      ${waitBase},
      ${waitBase}
    )
    RETURNING id
  `;
  const patientId = patientRows[0].id;

  // 2. Visit row. Only non-draft clinician-owned rows need assignedAt.
  const clinicianOnVisit =
    scenario.assign || scenario.visitStatus === "In Progress"
      ? doctorId
      : null;
  const assignedAt =
    clinicianOnVisit && scenario.visitStatus !== "Waiting" ? new Date() : null;

  const visitRows = await sql<{ id: string }[]>`
    INSERT INTO visits (
      patient_id, clinician_id, status, notes_status, priority,
      appointment_type, created_at, assigned_at
    ) VALUES (
      ${patientId},
      ${clinicianOnVisit},
      ${scenario.visitStatus},
      ${scenario.visitStatus === "draft"
        ? "draft"
        : scenario.visitStatus === "signed"
          ? "signed"
          : scenario.visitStatus === "finalized"
            ? "finalized"
            : "draft"},
      ${scenario.priority},
      ${scenario.appointmentType},
      ${waitBase},
      ${assignedAt}
    )
    RETURNING id
  `;
  const visitId = visitRows[0].id;

  // 3. Visit note. Orders live inside the note's JSONB `orders` array —
  // that's what tallyOrdersForWorkflow parses to compute labs/imaging chips.
  const note = createEmptyVisitNote();
  note.subjective.chiefComplaint = scenario.chiefComplaint;
  // The note's order shape is a flat object per the Zod schema — no id,
  // `priority` is a string like "routine"/"stat". tallyOrdersForWorkflow
  // keys off `type` + `status` substrings, so those two fields are what
  // actually drive the workflow chips.
  note.orders = scenario.orders.map((order) => ({
    type: order.type,
    priority: scenario.priority === "critical" ? "stat" : "routine",
    details: "Seeded for demo coverage",
    status: order.status,
    dateOrdered: waitBase.toISOString(),
  }));

  // postgres.js's sql.json() expects a JSONValue. VisitNote is a Zod-inferred
  // object tree — safe to round-trip through JSON.stringify to force it into
  // the serializable shape the driver accepts.
  const noteJson = JSON.parse(JSON.stringify(note)) as unknown;
  await sql`
    INSERT INTO notes (visit_id, note, status, created_at, updated_at)
    VALUES (
      ${visitId},
      ${sql.json(noteJson as Parameters<typeof sql.json>[0])},
      ${scenario.visitStatus === "signed" ? "signed" : "draft"},
      ${waitBase},
      ${waitBase}
    )
  `;

  console.log(
    `  [ok]   ${scenario.id.padEnd(28)} ${scenario.priority ?? "none"}/${scenario.appointmentType}/${scenario.visitStatus}`,
  );
}

async function main() {
  console.log(`Seeding clinical scenarios (${SCENARIOS.length} total)...\n`);

  const doctorId = await findDemoDoctorId();
  if (!doctorId) {
    console.warn(
      `  [warn] demo doctor (${DEMO_DOCTOR_EMAIL}) not found — run db:seed-demo-users first.`,
    );
    console.warn(
      `  [warn] scenarios marked assign=true will fall back to unassigned.`,
    );
  }

  await deletePriorSeedRows();

  for (const scenario of SCENARIOS) {
    try {
      await seedScenario(scenario, doctorId);
    } catch (err) {
      console.error(`  [fail] ${scenario.id}:`, err);
      throw err;
    }
  }

  await sql.end();
  console.log(
    `\nDone. Sign in as ${DEMO_DOCTOR_EMAIL} to see every filter bucket populated.`,
  );
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
