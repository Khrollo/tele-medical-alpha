import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { SignOutButton } from "@/app/_components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role === "doctor") {
    redirect("/waiting-room");
  }

  if (session.role === "nurse") {
    redirect("/patients");
  }

  if (session.role === "admin") {
    redirect("/admin/users/new");
  }

  // Authenticated but no clinical role assigned. Render a static page so we
  // don't bounce back to /sign-in (which would loop with middleware).
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          Account pending access
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          You&apos;re signed in as{" "}
          <span className="font-medium text-foreground">{session.email}</span>,
          but your account is not provisioned with a clinical role. Please ask
          an administrator to grant you access.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Current role:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-foreground">
            {session.role}
          </code>
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
