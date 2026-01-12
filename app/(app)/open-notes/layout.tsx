import { OpenNotesShell } from "./open-notes-shell";
import { getServerSession } from "@/app/_lib/supabase/server";

export default async function OpenNotesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession();
    const userRole = session?.role;
    const userName = session?.name;

    return (
        <OpenNotesShell userRole={userRole} userName={userName}>
            {children}
        </OpenNotesShell>
    );
}

