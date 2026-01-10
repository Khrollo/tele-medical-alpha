import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientBasics } from "@/app/_lib/db/drizzle/queries/patient";
import { SendToWaitingRoomContent } from "./send-to-waiting-room-content";

interface SendToWaitingRoomPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ visitId?: string }>;
}

export default async function SendToWaitingRoomPage({
    params,
    searchParams,
}: SendToWaitingRoomPageProps) {
    const session = await getServerSession();
    if (!session) {
        redirect("/sign-in");
    }

    const { id: patientId } = await params;
    const { visitId } = await searchParams;

    if (!visitId) {
        redirect(`/patients/${patientId}`);
    }

    const patient = await getPatientBasics(patientId);
    if (!patient) {
        redirect("/patients");
    }

    return (
        <SendToWaitingRoomContent
            patientId={patientId}
            visitId={visitId}
            patientName={patient.fullName}
        />
    );
}

