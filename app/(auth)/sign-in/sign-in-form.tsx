"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/app/_lib/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeMethod, setActiveMethod] = useState<"google" | "email" | null>(
    null
  );

  const isLoading = activeMethod !== null;
  const requestedRedirect = searchParams.get("redirect");
  const safeRedirect =
    requestedRedirect && requestedRedirect.startsWith("/")
      ? requestedRedirect
      : "/";

  const handleGoogleSignIn = async () => {
    setError(null);
    setActiveMethod("google");

    try {
      const { error: signInError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: safeRedirect,
        errorCallbackURL: "/sign-in",
      });

      if (signInError) {
        setError(
          signInError.message || "Failed to sign in with Google. Please try again."
        );
        setActiveMethod(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setActiveMethod(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setActiveMethod("email");

    // Basic validation
    if (!email.trim()) {
      setError("Email is required");
      setActiveMethod(null);
      return;
    }

    if (!password) {
      setError("Password is required");
      setActiveMethod(null);
      return;
    }

    try {
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(signInError.message || "Failed to sign in. Please check your credentials.");
        setActiveMethod(null);
        return;
      }

      // Full navigation so the server reads the real session after Better Auth sets cookies.
      window.location.assign(safeRedirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setActiveMethod(null);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Sign In</CardTitle>
        <CardDescription className="text-center">
          Continue with Google to access your account. Email and password are
          available as a fallback.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div
              className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
              role="alert"
            >
              {error}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            aria-busy={activeMethod === "google"}
          >
            {activeMethod === "google" ? "Redirecting to Google..." : "Continue with Google"}
          </Button>

          <div className="space-y-2">
            <Separator />
            <p className="text-center text-sm text-muted-foreground">
              Use email and password only if needed
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/reset-password"
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              className="w-full"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
            aria-busy={activeMethod === "email"}
          >
            {activeMethod === "email" ? "Signing in..." : "Sign in with email"}
          </Button>

          <div className="w-full">
            <Separator className="my-4" />
            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="font-medium text-foreground hover:underline underline-offset-4"
              >
                Create account
              </Link>
            </p>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
