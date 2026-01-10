import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { CreatePatientForm } from "./create-patient-form";
import { SideNav } from "@/components/side-nav";

export default async function NewPatientPage() {
    const session = await getServerSession();

    if (!session) {
        redirect("/sign-in");
    }

    // Only doctors and nurses can create patients
    if (session.role !== "doctor" && session.role !== "nurse") {
        redirect("/");
    }

    return (
        < div className="flex-1 overflow-y-auto pl-14 md:pl-0" >
            <div className="container mx-auto py-8 px-4 max-w-7xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-foreground">Create New Patient</h1>
                    <p className="text-muted-foreground mt-2">
                        Enter patient information to create a new patient record.
                    </p>
                </div>
                <CreatePatientForm />
            </div>
        </div >
    );
}

