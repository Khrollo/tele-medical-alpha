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
  
  return (
    <div className={cn("w-full overflow-x-auto thin-scrollbar pb-2 pt-2", className)}>
      <nav className="flex items-center min-w-max gap-2 sm:gap-6 px-4">
        {sections.map((section) => {
          const isCurrent = currentSection === section.id;
          const isReviewed = reviewedSections.has(section.id);
          const Icon = section.icon;
          
          return (
            <button
              key={section.id}
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[70px] gap-2 pb-3 pt-2 relative transition-all group",
                isCurrent
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "h-6 w-6 transition-transform duration-200", 
                  isCurrent ? "scale-110 drop-shadow-sm" : "group-hover:scale-105"
                )} />
                {isReviewed && !isCurrent && (
                  <div className="absolute -top-1 -right-1 bg-background rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  </div>
                )}
              </div>
              <span className={cn(
                "text-xs whitespace-nowrap",
                isCurrent ? "font-semibold" : "font-medium"
              )}>
                {section.label}
              </span>
              
              {/* Active Indicator Line */}
              {isCurrent && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary rounded-t-sm layout-fill" />
              )}
              {/* Inactive line filler */}
              {!isCurrent && (
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-border/50" />
              )}
            </button>
          );
        })}
      </nav>
      {/* Track base line for the entire container */}
      <div className="h-[1px] w-full bg-border/50 -mt-[1px]" />
    </div>
  );
}

export { allSections as visitSections };

