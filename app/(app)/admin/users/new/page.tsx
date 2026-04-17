import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { cookies } from "next/headers";
import { CreateUserForm } from "./create-user-form";
import { SideNav } from "@/components/side-nav";
import { PasswordCheckWrapper } from "./password-check-wrapper";

const PASSWORD_COOKIE_NAME = "new_user_access_granted";
export const dynamic = "force-dynamic";

export default async function CreateUserPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Allow clinical leadership and admin staff to create users
  if (
    session.role !== "doctor" &&
    session.role !== "nurse" &&
    session.role !== "admin"
  ) {
    redirect("/");
  }

  // Check if password protection is enabled
  const expectedPassword = process.env.NEW_USER_PWD;
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(PASSWORD_COOKIE_NAME)?.value === "true";

  // If password is configured but access not granted, show password check
  if (expectedPassword && !hasAccess) {
    return <PasswordCheckWrapper />;
  }

  const userRole = session.role;
  const userName = session.name;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* SideNav */}
      <SideNav
        userRole={userRole}
        userName={userName}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out">
        {/* Top Bar */}
        <div className="flex h-16 items-center gap-4 border-b border-border bg-background px-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create User</h1>
            <p className="text-sm text-muted-foreground">
              Create a new doctor, nurse, or admin account
            </p>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto py-8 px-4 max-w-2xl">
            <CreateUserForm />
          </div>
        </div>
      </div>
    </div>
  );
}
