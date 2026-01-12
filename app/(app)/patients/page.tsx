import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getAllPatients } from "@/app/_lib/db/drizzle/queries/patients";
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

  // Fetch all patients
  const patients = await getAllPatients();

  const userRole = session.role;
  const userName = session.name;

  return (
    <PatientsShell userRole={userRole} userName={userName}>
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">All Patients</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            View and manage all patients in the system
          </p>
        </div>

        {patients.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No patients found</p>
            </CardContent>
          </Card>
        ) : (
          <PatientsList patients={patients} userRole={session.role} />
        )}
      </div>
    </PatientsShell>
  );
}

