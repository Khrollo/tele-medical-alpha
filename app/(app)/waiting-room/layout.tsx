import { WaitingRoomShell } from "./waiting-room-shell";
import { getServerSession } from "@/app/_lib/supabase/server";

export default async function WaitingRoomLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession();
    const userRole = session?.role;
    const userName = session?.name;

    return (
        <WaitingRoomShell userRole={userRole} userName={userName}>
            {children}
        </WaitingRoomShell>
    );
}

