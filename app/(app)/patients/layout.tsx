import { getServerSession } from "@/app/_lib/supabase/server";
import { RouteWrapper } from "./route-wrapper";

export default async function PatientsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession();
    const userRole = session?.role;
    const userName = session?.name;

    return (
        <RouteWrapper userRole={userRole} userName={userName}>
            {children}
        </RouteWrapper>
    );
}

