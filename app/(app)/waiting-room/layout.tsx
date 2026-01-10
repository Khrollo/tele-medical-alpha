import { SideNav } from "@/components/side-nav";
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
        <div className="flex min-h-screen w-full">
            <SideNav userRole={userRole} userName={userName} />
            <main className="flex flex-1 flex-col overflow-hidden pl-14 md:pl-0">
                {children}
            </main>
        </div>
    );
}

