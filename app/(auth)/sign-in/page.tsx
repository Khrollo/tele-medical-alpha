import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

function SignInFormFallback() {
  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
      Loading sign-in form...
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Suspense fallback={<SignInFormFallback />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}

