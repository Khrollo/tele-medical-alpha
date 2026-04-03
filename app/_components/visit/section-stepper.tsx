"use client";

import * as React from "react";
import { cn } from "@/app/_lib/utils/cn";
import { 
  MessageSquare, 
  Activity, 
  Target, 
  Syringe, 
  Users, 
  AlertTriangle, 
  Stethoscope, 
  History, 
  FileText, 
  Pill, 
  ClipboardList, 
  CheckSquare,
  CheckCircle2
} from "lucide-react";

export interface VisitSection {
  id: string;
  label: string;
  icon: React.ElementType;
}

const allSections: VisitSection[] = [
  { id: "subjective", label: "Subjective", icon: MessageSquare },
  { id: "objective", label: "Objective", icon: Activity },
  { id: "pointOfCare", label: "Point of Care", icon: Target },
  { id: "vaccines", label: "Vaccines", icon: Syringe },
  { id: "familyHistory", label: "Family", icon: Users },
  { id: "riskFlags", label: "Risks", icon: AlertTriangle },
  { id: "surgicalHistory", label: "Surgical", icon: Stethoscope },
  { id: "pastMedicalHistory", label: "Past Med", icon: History },
  { id: "documents", label: "Docs", icon: FileText },
  { id: "medications", label: "Meds", icon: Pill },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "assessmentPlan", label: "A&P", icon: CheckSquare },
];

/**
 * Get sections filtered and ordered based on user role
 */
export function getSectionsForRole(userRole?: string): VisitSection[] {
  if (userRole === "nurse") {
    const otherSections = allSections.filter(
      s => s.id !== "assessmentPlan" && s.id !== "objective" && s.id !== "subjective"
    );
    const result = [...otherSections];
    result.push({ id: "objective", label: "Objective", icon: Activity });
    result.push({ id: "subjective", label: "Subjective", icon: MessageSquare });
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
}

export function SectionStepper({
  currentSection,
  reviewedSections,
  onSectionClick,
  userRole,
  className,
}: SectionStepperProps) {
  const sections = getSectionsForRole(userRole);
  const currentIndex = sections.findIndex(s => s.id === currentSection);

  return (
    <div className={cn("w-full overflow-x-auto thin-scrollbar", className)}>
      <nav className="flex items-center justify-center min-w-max px-4 relative">
        {/* Progress track background */}
        <div className="flex items-center gap-0">
          {sections.map((section, idx) => {
            const isCurrent = currentSection === section.id;
            const isReviewed = reviewedSections.has(section.id);
            const isPast = idx < currentIndex;
            const Icon = section.icon;

            return (
              <div key={section.id} className="flex items-center">
                {/* Step dot/indicator */}
                <button
                  onClick={() => onSectionClick(section.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 px-1 transition-all group",
                    isCurrent ? "scale-105" : "hover:scale-105"
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 border-2",
                      isCurrent
                        ? "bg-slate-900 border-slate-900 text-white shadow-lg dark:bg-white dark:border-white dark:text-slate-900"
                        : isReviewed
                          ? "bg-green-50 border-green-500 text-green-600 dark:bg-green-950 dark:border-green-500"
                          : "bg-slate-50 border-slate-200 text-slate-300 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-600"
                    )}
                  >
                    {isReviewed && !isCurrent ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>

                  <span className={cn(
                    "text-[9px] font-semibold whitespace-nowrap uppercase tracking-wide transition-colors text-center",
                    isCurrent
                      ? "text-slate-900 dark:text-white"
                      : isReviewed
                        ? "text-green-600 dark:text-green-400"
                        : "text-slate-400 group-hover:text-slate-600"
                  )}>
                    {section.label}
                  </span>
                </button>

                {/* Connector line */}
                {idx < sections.length - 1 && (
                  <div className={cn(
                    "w-4 h-0.5 -mt-4 mx-0.5 rounded-full transition-colors",
                    isReviewed && (isPast || isCurrent)
                      ? "bg-green-400 dark:bg-green-500"
                      : "bg-slate-200 dark:bg-slate-700"
                  )} />
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export { allSections as visitSections };
