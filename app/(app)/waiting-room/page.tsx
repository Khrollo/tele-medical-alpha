import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getUnassignedPatientsWithVisits } from "@/app/_lib/db/drizzle/queries/patients";
import { Card, CardContent } from "@/components/ui/card";
import { WaitingRoomList } from "./waiting-room-list";

export default async function WaitingRoomPage() {
    // Check authentication and role
    const session = await getServerSession();

    if (!session) {
        redirect("/sign-in");
    }

    // Redirect non-doctors and non-nurses to dashboard
    if (session.role !== "doctor" && session.role !== "nurse") {
        redirect("/");
    }

    // Fetch unassigned patients with visit information
    const patients = await getUnassignedPatientsWithVisits();

    return (
        <div className="flex flex-1 flex-col">
            <WaitingRoomList patients={patients} userRole={session.role} />
        </div>
    );
}

