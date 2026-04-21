import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ResetPasswordPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-center text-2xl font-bold">
            Password resets require support
          </CardTitle>
          <CardDescription className="text-center">
            Self-service password reset is not enabled yet for this clinical
            environment. Contact your clinic lead or administrator to reset a
            staff password.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Google sign-in remains the recommended primary login method.
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/sign-in">Back to sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
