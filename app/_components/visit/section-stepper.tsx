"use client";

import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";

export interface VisitSection {
  id: string;
  label: string;
}

const allSections: VisitSection[] = [
  { id: "subjective", label: "Subjective" },
  { id: "objective", label: "Objective" },
  { id: "reviewOfSystems", label: "Review of Systems" },
  { id: "pointOfCare", label: "Point of Care" },
  { id: "vaccines", label: "Vaccines" },
  { id: "familyHistory", label: "Family History" },
  { id: "riskFlags", label: "Risk Flags" },
  { id: "surgicalHistory", label: "Surgical History" },
  { id: "pastMedicalHistory", label: "Past Medical History" },
  { id: "documents", label: "Documents" },
  { id: "medications", label: "Medications" },
  { id: "orders", label: "Orders" },
  { id: "visitActions", label: "Visit Actions" },
  { id: "differentialDiagnoses", label: "Differential" },
  { id: "assessmentPlan", label: "Assessment & Plan" },
  { id: "coding", label: "Coding & Sign-off" },
];

/**
 * Get sections filtered and ordered based on user role
 */
export function getSectionsForRole(userRole?: string): VisitSection[] {
  if (userRole === "nurse") {
    const otherSections = allSections.filter(
      (s) => s.id !== "assessmentPlan" && s.id !== "objective" && s.id !== "subjective"
    );
    const result = [...otherSections];
    result.push({ id: "objective", label: "Objective" });
    result.push({ id: "subjective", label: "Subjective" });
    return result;
  }
  return allSections;
}

interface SectionStepperProps {
  currentSection: string;
  reviewedSections: Set<string>;
  onSectionClick: (sectionId: string) => void;
  userRole?: string;
  className?: string;
  orientation?: "vertical" | "horizontal";
}

export function SectionStepper({
  currentSection,
  reviewedSections,
  onSectionClick,
  userRole,
  className,
  orientation = "vertical",
}: SectionStepperProps) {
  const sections = getSectionsForRole(userRole);

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {sections.map((section, i) => {
          const isCurrent = currentSection === section.id;
          const isReviewed = reviewedSections.has(section.id);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionClick(section.id)}
              className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12.5px] font-medium tracking-tight transition-colors"
              style={{
                background: isCurrent ? "var(--ink)" : "transparent",
                color: isCurrent ? "var(--paper)" : "var(--ink-2)",
                border: `1px solid ${isCurrent ? "var(--ink)" : "var(--line)"}`,
              }}
            >
              <span
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold"
                style={{
                  background: isReviewed
                    ? "var(--ok-soft)"
                    : isCurrent
                      ? "var(--paper)"
                      : "var(--paper-3)",
                  color: isReviewed
                    ? "var(--ok)"
                    : isCurrent
                      ? "var(--ink)"
                      : "var(--ink-3)",
                }}
              >
                {isReviewed ? "✓" : i + 1}
              </span>
              {section.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        className="px-2 text-[10px] uppercase"
        style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
      >
        Note sections
      </div>
      <nav className="flex flex-col gap-0.5">
        {sections.map((section, i) => {
          const isCurrent = currentSection === section.id;
          const isReviewed = reviewedSections.has(section.id);
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionClick(section.id)}
              className="grid items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] tracking-tight transition-colors"
              style={{
                gridTemplateColumns: "22px 1fr auto",
                background: isCurrent ? "var(--paper)" : "transparent",
                border: `1px solid ${isCurrent ? "var(--line)" : "transparent"}`,
                color: "var(--ink)",
                fontWeight: isCurrent ? 500 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) {
                  (e.currentTarget as HTMLButtonElement).style.background = "var(--paper-3)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }
              }}
            >
              <span
                className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: isReviewed
                    ? "var(--ok-soft)"
                    : isCurrent
                      ? "var(--brand-soft)"
                      : "var(--paper-3)",
                  color: isReviewed
                    ? "var(--ok)"
                    : isCurrent
                      ? "var(--brand-ink)"
                      : "var(--ink-3)",
                  border: `1px solid ${isReviewed ? "transparent" : "var(--line)"}`,
                }}
              >
                {isReviewed ? "✓" : i + 1}
              </span>
              <span className="truncate">{section.label}</span>
              {isCurrent && !isReviewed && (
                <span className="text-[10px]" style={{ color: "var(--brand-ink)" }}>
                  •••
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export { allSections as visitSections };
