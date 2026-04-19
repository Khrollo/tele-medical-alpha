import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";
import { Logo } from "@/components/ui/clearing/logo";

function SignInFormFallback() {
  return (
    <div
      className="w-full max-w-md rounded-lg p-6 text-center text-sm"
      style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        color: "var(--ink-3)",
      }}
    >
      Loading sign-in form…
    </div>
  );
}

export default function SignInPage() {
  return (
    <div
      className="flex min-h-screen w-full"
      style={{ background: "var(--paper)" }}
    >
      {/* Left: brand surface (hidden on small screens) */}
      <div
        className="relative hidden flex-1 flex-col gap-8 overflow-hidden px-10 py-10 md:flex md:flex-[1_1_55%] lg:px-14"
        style={{
          background: "var(--paper-2)",
          borderRight: "1px solid var(--line)",
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--ink)" }}>
            <Logo size={32} />
          </span>
          <span
            className="serif text-[22px]"
            style={{ color: "var(--ink)", letterSpacing: "-0.015em" }}
          >
            Tele Medical
          </span>
          <span
            className="ml-2 text-[11px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
          >
            Urgent Care Platform
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center gap-6" style={{ maxWidth: 580 }}>
          <h1
            className="serif"
            style={{
              fontSize: "clamp(44px, 5.5vw, 60px)",
              lineHeight: 1.08,
              letterSpacing: "-0.025em",
              color: "var(--ink)",
              paddingBottom: 4,
            }}
          >
            Quiet tools for the
            <br />
            <span style={{ color: "var(--brand-ink)" }}>loudest</span> part of your day.
          </h1>
          <p
            className="text-base"
            style={{
              color: "var(--ink-2)",
              lineHeight: 1.55,
              maxWidth: 480,
              margin: 0,
            }}
          >
            Patient intake, clinical notes, AI voice capture and telehealth video — all in one
            browser tab. Works offline. Syncs when you&rsquo;re back.
          </p>

          <div className="mt-3 flex flex-wrap gap-6">
            {[
              { k: "Patients today", v: "14" },
              { k: "Avg. visit time", v: "11:22" },
              { k: "Uptime (90d)", v: "99.94%" },
            ].map((s) => (
              <div key={s.k} style={{ borderLeft: "1px solid var(--line)", paddingLeft: 14 }}>
                <div
                  className="serif"
                  style={{
                    fontSize: 34,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  {s.v}
                </div>
                <div
                  className="mt-1 text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                >
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative concentric arcs */}
        <svg
          className="pointer-events-none absolute bottom-[-120px] right-[-120px] opacity-50"
          width="520"
          height="520"
          viewBox="0 0 520 520"
          fill="none"
          aria-hidden
        >
          {[40, 90, 150, 220, 300].map((r, i) => (
            <circle
              key={r}
              cx="260"
              cy="260"
              r={r}
              stroke="var(--line-strong)"
              strokeWidth={i === 2 ? "1.2" : "0.8"}
              strokeDasharray={i % 2 ? "2 6" : ""}
            />
          ))}
          <circle cx="260" cy="260" r="14" fill="var(--brand)" />
        </svg>

        <div className="relative text-[11px]" style={{ color: "var(--ink-3)" }}>
          © {new Date().getFullYear()} Tele Medical · HIPAA compliant · SOC-2 Type II
        </div>
      </div>

      {/* Right: form panel */}
      <div className="flex flex-1 items-center justify-center p-6 md:flex-[1_1_45%] md:p-14">
        <Suspense fallback={<SignInFormFallback />}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}
