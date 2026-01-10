import { eq, desc, or, isNull, and, inArray } from "drizzle-orm";
import { db } from "../index";
import { patients, visits, users } from "../schema";

/**
 * Get all unassigned patients with their waiting visit information
 * Only shows patients where is_assigned is explicitly false (not null or true)
 * @returns Array of unassigned patients with visit details (priority, appointmentType, waitTime)
 */
export async function getUnassignedPatientsWithVisits() {
  // Get unassigned patients - only where is_assigned is explicitly false
  const unassignedPatients = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(eq(patients.isAssigned, false));

  // Get waiting visits for these patients
  const patientIds = unassignedPatients.map((p) => p.id);

  if (patientIds.length === 0) {
    return [];
  }

  const waitingVisits = await db
    .select({
      id: visits.id,
      patientId: visits.patientId,
      priority: visits.priority,
      appointmentType: visits.appointmentType,
      createdAt: visits.createdAt,
      status: visits.status,
      clinicianId: visits.clinicianId,
      twilioRoomName: visits.twilioRoomName,
      patientJoinToken: visits.patientJoinToken,
    })
    .from(visits)
    .where(
      and(
        inArray(visits.patientId, patientIds),
        or(
          eq(visits.status, "Waiting"),
          eq(visits.status, "waiting"),
          eq(visits.status, "In Progress"),
          eq(visits.status, "in_progress")
        )
      )
    )
    .orderBy(desc(visits.createdAt));

  // Map visits to patients (get most recent visit per patient)
  const visitMap = new Map<string, (typeof waitingVisits)[0]>();
  for (const visit of waitingVisits) {
    if (!visitMap.has(visit.patientId)) {
      visitMap.set(visit.patientId, visit);
    }
  }

  // Combine patient data with visit data
  return unassignedPatients.map((patient) => {
    const visit = visitMap.get(patient.id);
    return {
      id: patient.id,
      fullName: patient.fullName,
      createdAt: patient.createdAt,
      visit: visit
        ? {
            id: visit.id,
            priority: visit.priority,
            appointmentType: visit.appointmentType,
            createdAt: visit.createdAt,
            status: visit.status,
            clinicianId: visit.clinicianId,
            twilioRoomName: visit.twilioRoomName,
            patientJoinToken: visit.patientJoinToken,
          }
        : null,
    };
  });
}

/**
 * Get all unassigned patients (where is_assigned = false or null)
 * @returns Array of unassigned patients with id, fullName, and createdAt
 */
export async function getUnassignedPatients() {
  const result = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(or(eq(patients.isAssigned, false), isNull(patients.isAssigned)))
    .orderBy(patients.createdAt);

  return result;
}

/**
 * Get all patients with additional information
 * @returns Array of all patients with id, fullName, dob, phone, email, clinician info, and visit data
 */
export async function getAllPatients() {
  const result = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dob: patients.dob,
      phone: patients.phone,
      email: patients.email,
      clinicianId: patients.clinicianId,
      allergies: patients.allergies,
      currentMedications: patients.currentMedications,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .orderBy(desc(patients.createdAt));

  // Get clinician information
  const clinicianIds = result
    .map((p) => p.clinicianId)
    .filter((id): id is string => id !== null);
  
  const clinicians = clinicianIds.length > 0
    ? await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(inArray(users.id, clinicianIds))
    : [];

  const clinicianMap = new Map(clinicians.map((c) => [c.id, c]));

  // Get latest visit for each patient
  const patientIds = result.map((p) => p.id);
  if (patientIds.length === 0) {
    return result.map((patient) => {
      const clinician = patient.clinicianId ? clinicianMap.get(patient.clinicianId) : null;
      const allergies = Array.isArray(patient.allergies) ? patient.allergies : [];
      const medications = Array.isArray(patient.currentMedications) ? patient.currentMedications : [];
      
      return {
        ...patient,
        clinicianName: clinician?.name || null,
        clinicianEmail: clinician?.email || null,
        allergiesCount: allergies.length,
        medicationsCount: medications.length,
        visit: null,
      };
    });
  }

  const latestVisits = await db
    .select({
      id: visits.id,
      patientId: visits.patientId,
      status: visits.status,
      appointmentType: visits.appointmentType,
      clinicianId: visits.clinicianId,
      patientJoinToken: visits.patientJoinToken,
      twilioRoomName: visits.twilioRoomName,
      createdAt: visits.createdAt,
    })
    .from(visits)
    .where(inArray(visits.patientId, patientIds))
    .orderBy(desc(visits.createdAt));

  // Map visits to patients (get most recent visit per patient)
  const visitMap = new Map<string, (typeof latestVisits)[0]>();
  for (const visit of latestVisits) {
    if (!visitMap.has(visit.patientId)) {
      visitMap.set(visit.patientId, visit);
    }
  }

  return result.map((patient) => {
    const clinician = patient.clinicianId ? clinicianMap.get(patient.clinicianId) : null;
    const allergies = Array.isArray(patient.allergies) ? patient.allergies : [];
    const medications = Array.isArray(patient.currentMedications) ? patient.currentMedications : [];
    
    return {
      ...patient,
      clinicianName: clinician?.name || null,
      clinicianEmail: clinician?.email || null,
      allergiesCount: allergies.length,
      medicationsCount: medications.length,
      visit: visitMap.get(patient.id) || null,
    };
  });
}

/**
 * Get patient overview data including latest visit
 * @param patientId - UUID of the patient
 * @returns Patient data with latest visit information
 */
export async function getPatientOverview(patientId: string) {
  // Get patient data
  const patient = await db
    .select({
      id: patients.id,
      fullName: patients.fullName,
      dob: patients.dob,
      allergies: patients.allergies,
      vitals: patients.vitals,
      currentMedications: patients.currentMedications,
      vaccines: patients.vaccines,
      familyHistory: patients.familyHistory,
      socialHistory: patients.socialHistory,
      pastMedicalHistory: patients.pastMedicalHistory,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient[0]) {
    return null;
  }

  // Get latest visit for this patient
  const latestVisit = await db
    .select({
      id: visits.id,
      createdAt: visits.createdAt,
      status: visits.status,
      notesStatus: visits.notesStatus,
      appointmentType: visits.appointmentType,
      clinicianId: visits.clinicianId,
      patientJoinToken: visits.patientJoinToken,
      twilioRoomName: visits.twilioRoomName,
    })
    .from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.createdAt))
    .limit(1);

  return {
    patient: patient[0],
    latestVisit: latestVisit[0] || null,
  };
}
