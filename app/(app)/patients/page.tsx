import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import {
  getAllPatients,
  getDoctorScopedPatients,
  getNurseFocusedPatients,
} from "@/app/_lib/db/drizzle/queries/patients";
import { Card, CardContent } from "@/components/ui/card";
import { PatientsList } from "./patients-list";
import { PatientsShell } from "./patients-shell";

export default async function PatientsPage() {
  // Check authentication and role
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow doctors and nurses only
  if (session.role !== "doctor" && session.role !== "nurse") {
    redirect("/sign-in");
  }

  const userRole = session.role;
  const userName = session.name;

  const patients =
    userRole === "doctor"
      ? await getDoctorScopedPatients(session.id)
      : await getNurseFocusedPatients();

  const allPatientsForNurse =
    userRole === "nurse" ? await getAllPatients() : null;
  const hasPatientsToRender =
    patients.length > 0 || (allPatientsForNurse?.length ?? 0) > 0;

  return (
    <PatientsShell userRole={userRole} userName={userName}>
      <div className="flex flex-1 flex-col">
        {!hasPatientsToRender ? (
          <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">No patients found</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <PatientsList
            patients={patients}
            allPatients={allPatientsForNurse ?? undefined}
            userRole={session.role}
          />
        )}
      </div>
    </PatientsShell>
  );
}

