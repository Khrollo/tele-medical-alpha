import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { SignInForm } from "./sign-in-form";

function SignInFormFallback() {
  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
      Loading sign-in form...
    </div>
  );
}

export default async function SignInPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={<SignInFormFallback />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}

