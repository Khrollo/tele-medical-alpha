import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { CreatePatientForm } from "./create-patient-form";
import { CreatePatientShell } from "./create-patient-shell";

export default async function NewPatientPage() {
    const session = await getServerSession();

    if (!session) {
        redirect("/sign-in");
    }

    if (session.role !== "doctor" && session.role !== "nurse") {
        redirect("/");
    }

    const userRole = session.role;
    const userName = session.name;

    return (
        <CreatePatientShell userRole={userRole} userName={userName}>
            <div className="container mx-auto max-w-7xl px-4 py-8">
                <div className="mb-6">
                    <div
                        className="text-[11.5px] uppercase"
                        style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
                    >
                        Step 1 of 3 · Demographics
                    </div>
                    <h1
                        className="serif mt-1.5"
                        style={{
                            fontSize: "clamp(32px, 4vw, 44px)",
                            lineHeight: 1,
                            letterSpacing: "-0.02em",
                            color: "var(--ink)",
                            margin: 0,
                        }}
                    >
                        Let&rsquo;s meet the patient.
                    </h1>
                    <p
                        className="mt-2 max-w-[620px] text-[14px]"
                        style={{ color: "var(--ink-2)" }}
                    >
                        Speak the basics out loud — name, DOB, phone, insurance — and the assistant
                        fills in the form. You confirm each field before anything saves.
                    </p>
                </div>
                <CreatePatientForm />
            </div>
        </CreatePatientShell>
    );
}
