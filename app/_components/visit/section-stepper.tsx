"use client";

import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";
import { Check, Circle, MessageSquare, Activity, Heart, Syringe, Users, AlertTriangle, Scissors, Clock, FileText, Pill, ClipboardList, Stethoscope } from "lucide-react";

export interface VisitSection {
  id: string;
  label: string;
}

const allSections: VisitSection[] = [
  { id: "subjective", label: "Subjective" },
  { id: "objective", label: "Objective" },
  { id: "pointOfCare", label: "Point of Care" },
  { id: "vaccines", label: "Vaccines" },
  { id: "familyHistory", label: "Family History" },
  { id: "riskFlags", label: "Risk Flags" },
  { id: "surgicalHistory", label: "Surgical History" },
  { id: "pastMedicalHistory", label: "Past Medical History" },
  { id: "documents", label: "Documents" },
  { id: "medications", label: "Medications" },
  { id: "orders", label: "Orders" },
  { id: "assessmentPlan", label: "Assessment & Plan" },
];

const sectionIcons: Record<string, React.ElementType> = {
  subjective: MessageSquare,
  objective: Activity,
  pointOfCare: Heart,
  vaccines: Syringe,
  familyHistory: Users,
  riskFlags: AlertTriangle,
  surgicalHistory: Scissors,
  pastMedicalHistory: Clock,
  documents: FileText,
  medications: Pill,
  orders: ClipboardList,
  assessmentPlan: Stethoscope,
};

const sectionShortLabels: Record<string, string> = {
  subjective: "Subjective",
  objective: "Objective",
  pointOfCare: "Point of Care",
  vaccines: "Vaccines",
  familyHistory: "Family",
  riskFlags: "Risks",
  surgicalHistory: "Surgical",
  pastMedicalHistory: "Past Med",
  documents: "Docs",
  medications: "Meds",
  orders: "Orders",
  assessmentPlan: "A&P",
};

/**
 * Get sections filtered and ordered based on user role
 */
export function getSectionsForRole(userRole?: string): VisitSection[] {
  if (userRole === "nurse") {
    const otherSections = allSections.filter(
      s => s.id !== "assessmentPlan" && s.id !== "objective" && s.id !== "subjective"
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
  variant?: "vertical" | "horizontal";
}

export function SectionStepper({
  currentSection,
  reviewedSections,
  onSectionClick,
  userRole,
  className,
  variant = "vertical",
}: SectionStepperProps) {
  const sections = getSectionsForRole(userRole);

  if (variant === "horizontal") {
    return (
      <div className={cn("flex items-center overflow-x-auto px-4 py-3 gap-0 min-w-0 scrollbar-none", className)}>
        {sections.map((section, idx) => {
          const isCurrent = currentSection === section.id;
          const isReviewed = reviewedSections.has(section.id);
          const Icon = sectionIcons[section.id] ?? Circle;

          return (
            <React.Fragment key={section.id}>
              <button
                onClick={() => onSectionClick(section.id)}
                className="flex flex-col items-center gap-1.5 shrink-0 group"
                title={section.label}
              >
                <div
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all",
                    isCurrent
                      ? "bg-foreground border-foreground text-background"
                      : isReviewed
                      ? "border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-muted-foreground/30 text-muted-foreground group-hover:border-muted-foreground/60 group-hover:text-foreground"
                  )}
                >
                  {isReviewed && !isCurrent ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wider whitespace-nowrap",
                    isCurrent
                      ? "text-foreground"
                      : isReviewed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {sectionShortLabels[section.id] ?? section.label}
                </span>
              </button>

              {idx < sections.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-[2px] mx-1 min-w-[6px] shrink rounded-full transition-colors",
                    reviewedSections.has(section.id)
                      ? "bg-emerald-400 dark:bg-emerald-600"
                      : "bg-muted-foreground/20"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <h3 className="text-sm font-semibold text-foreground mb-3">
        Visit Note Sections
      </h3>
      <nav className="space-y-1">
        {sections.map((section) => {
          const isCurrent = currentSection === section.id;
          const isReviewed = reviewedSections.has(section.id);

          return (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                isCurrent
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                isReviewed && !isCurrent && "text-foreground/80"
              )}
            >
              {isReviewed ? (
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Circle className="h-4 w-4" />
              )}
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Export all sections for backward compatibility (used in other places)
export { allSections as visitSections };
