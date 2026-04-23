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
  const [showEmailFallback, setShowEmailFallback] = useState(false);
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

      <Btn
        kind="accent"
        size="lg"
        full
        type="button"
        disabled={isLoading}
        aria-busy={activeMethod === "google"}
        onClick={handleGoogleSignIn}
        icon={
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.997 3.018v2.51h3.232c1.891-1.74 2.983-4.305 2.983-7.351Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.232-2.51c-.895.6-2.04.954-3.386.954-2.605 0-4.81-1.76-5.595-4.122H3.064v2.59A9.997 9.997 0 0 0 12 22Z" />
            <path fill="#FBBC04" d="M6.405 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.064a9.997 9.997 0 0 0 0 8.98l3.341-2.59Z" />
            <path fill="#EA4335" d="M12 5.978c1.468 0 2.785.504 3.823 1.494l2.866-2.866C16.96 2.99 14.696 2 12 2 8.105 2 4.74 4.236 3.064 7.51l3.341 2.59C7.19 7.738 9.395 5.978 12 5.978Z" />
          </svg>
        }
      >
        {activeMethod === "google" ? "Redirecting…" : "Continue with Google"}
      </Btn>

      <div className="flex items-center gap-3" style={{ color: "var(--ink-3)" }}>
        <div className="h-px flex-1" style={{ background: "var(--line)" }} />
        <span className="text-[10.5px] uppercase" style={{ letterSpacing: "0.12em" }}>
          fallback
        </span>
        <div className="h-px flex-1" style={{ background: "var(--line)" }} />
      </div>

      {!showEmailFallback ? (
        <Btn
          kind="ghost"
          size="lg"
          full
          type="button"
          disabled={isLoading}
          onClick={() => setShowEmailFallback(true)}
        >
          Use email and password instead
        </Btn>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="text-center text-[12px]" style={{ color: "var(--ink-3)" }}>
            Use your email credentials if Google sign-in is unavailable.
          </div>

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

          <Btn
            kind="ghost"
            size="lg"
            full
            type="submit"
            disabled={isLoading}
            aria-busy={activeMethod === "email"}
            iconRight={<ArrowRight className="h-4 w-4" />}
          >
            {activeMethod === "email" ? "Signing in…" : "Sign in with email"}
          </Btn>
        </div>
      )}

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
