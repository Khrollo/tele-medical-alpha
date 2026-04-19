"use client";

import { useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, WifiOff } from "lucide-react";
import { authClient } from "@/app/_lib/auth/auth-client";
import { Btn } from "@/components/ui/clearing";

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

      const requestedRedirect = searchParams.get("redirect");
      const safeRedirect =
        requestedRedirect && requestedRedirect.startsWith("/") ? requestedRedirect : "/";

      window.location.assign(safeRedirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setActiveMethod(null);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 42,
    padding: "0 14px",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--paper)",
    outline: "none",
    fontSize: 14,
    color: "var(--ink)",
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-[380px] flex-col gap-6"
    >
      <div>
        <div
          className="text-[11px] uppercase"
          style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
        >
          Welcome back
        </div>
        <h1
          className="serif mt-1.5"
          style={{ fontSize: 40, lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--ink)", margin: 0 }}
        >
          Sign in to your shift.
        </h1>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[10px] px-3 py-2.5 text-[13px]"
          style={{
            background: "var(--critical-soft)",
            color: "var(--critical)",
            border: "1px solid transparent",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
            Work email
          </span>
          <input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            aria-required="true"
            aria-invalid={error ? "true" : "false"}
            style={inputStyle}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              Password
            </span>
            <Link
              href="/reset-password"
              className="text-[11.5px] hover:underline"
              style={{ color: "var(--brand-ink)", textDecoration: "none" }}
            >
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            required
            aria-required="true"
            aria-invalid={error ? "true" : "false"}
            style={{ ...inputStyle, letterSpacing: "0.2em" }}
          />
        </label>
      </div>

      <Btn
        kind="accent"
        size="lg"
        full
        type="submit"
        disabled={isLoading}
        aria-busy={isLoading}
        iconRight={<ArrowRight className="h-4 w-4" />}
      >
        {isLoading ? "Signing in…" : "Sign in"}
      </Btn>

      <div
        className="flex items-center gap-2 pt-3.5 text-[12px]"
        style={{ color: "var(--ink-3)", borderTop: "1px solid var(--line)" }}
      >
        <WifiOff className="h-4 w-4" style={{ color: "var(--ok)" }} />
        <span>Offline? You can still open recent patients — anything you save syncs later.</span>
      </div>

      <p className="text-center text-[13px]" style={{ color: "var(--ink-3)" }}>
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium hover:underline"
          style={{ color: "var(--ink)" }}
        >
          Create account
        </Link>
      </p>
    </form>
  );
}
