"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Video, User, Gauge } from "lucide-react";
import {
  Btn,
  ClearingCard,
  SubTabHeader,
  type PillTone,
} from "@/components/ui/clearing";
import {
  updatePatientAssignedAction,
  updateVisitWaitingRoomAction,
} from "@/app/_actions/visits";

// Keep the import reference to avoid unused-import churn; it is part of this feature.
void updatePatientAssignedAction;

interface SendToWaitingRoomContentProps {
  patientId: string;
  visitId: string;
  patientName: string;
}

type TriageLevel = "mild" | "urgent" | "critical";
type AppointmentType = "in-person" | "virtual";

const TRIAGE_OPTIONS: Array<{
  level: TriageLevel;
  label: string;
  description: string;
  tone: PillTone;
  activeBg: string;
  activeText: string;
  activeBorder: string;
}> = [
  {
    level: "mild",
    label: "Mild",
    description: "Routine. Can wait comfortably in the pool.",
    tone: "ok",
    activeBg: "var(--ok-soft)",
    activeText: "var(--ok)",
    activeBorder: "var(--ok)",
  },
  {
    level: "urgent",
    label: "Urgent",
    description: "Prioritise ahead of routine visits.",
    tone: "warn",
    activeBg: "var(--warn-soft)",
    activeText: "oklch(0.5 0.12 70)",
    activeBorder: "oklch(0.5 0.12 70)",
  },
  {
    level: "critical",
    label: "Critical",
    description: "See as soon as a clinician is available.",
    tone: "critical",
    activeBg: "var(--critical-soft)",
    activeText: "var(--critical)",
    activeBorder: "var(--critical)",
  },
];

export function SendToWaitingRoomContent({
  patientId,
  visitId,
  patientName,
}: SendToWaitingRoomContentProps) {
  const router = useRouter();
  const [triageLevel, setTriageLevel] = React.useState<TriageLevel>("mild");
  const [appointmentType, setAppointmentType] =
    React.useState<AppointmentType>("in-person");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Save triage level and appointment type to visit
      // This also updates patient is_assigned to false and clinician_id to null
      await updateVisitWaitingRoomAction({
        visitId,
        triageLevel,
        appointmentType,
      });

      toast.success("Patient sent to waiting room");
      router.push(`/patients/${patientId}/visit-history`);
    } catch (error) {
      console.error("Error sending to waiting room:", error);
      toast.error("Failed to send patient to waiting room");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-md"
          style={{ color: "var(--ink-2)" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--paper-3)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
          }}
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <SubTabHeader
            eyebrow="Chart · Waiting room"
            title="Send to waiting room"
            subtitle={`Queue a waiting-room slot for ${patientName}.`}
          />
        </div>
      </div>

      <div className="flex max-w-2xl flex-col gap-5">
        {/* Triage Level */}
        <ClearingCard>
          <div className="mb-3 flex items-center gap-2">
            <Gauge className="h-4 w-4" style={{ color: "var(--warn)" }} />
            <div
              className="serif"
              style={{ fontSize: 17, color: "var(--ink)" }}
            >
              Triage level
            </div>
          </div>
          <p
            className="mb-3 text-[12.5px]"
            style={{ color: "var(--ink-2)" }}
          >
            Set the urgency for the waiting pool.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {TRIAGE_OPTIONS.map((opt) => {
              const isSelected = triageLevel === opt.level;
              return (
                <button
                  key={opt.level}
                  type="button"
                  onClick={() => setTriageLevel(opt.level)}
                  className="flex-1 rounded-xl px-4 py-3 text-left transition-colors"
                  style={{
                    background: isSelected ? opt.activeBg : "var(--paper-2)",
                    border: `1px solid ${
                      isSelected ? opt.activeBorder : "var(--line)"
                    }`,
                    color: isSelected ? opt.activeText : "var(--ink)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        background: isSelected
                          ? opt.activeText
                          : "var(--ink-3)",
                      }}
                    />
                    <span className="text-[13px] font-medium">
                      {opt.label}
                    </span>
                  </div>
                  <div
                    className="mt-1 text-[11.5px]"
                    style={{
                      color: isSelected ? opt.activeText : "var(--ink-3)",
                    }}
                  >
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>
        </ClearingCard>

        {/* Appointment Type */}
        <ClearingCard>
          <div className="mb-3 flex items-center gap-2">
            <User className="h-4 w-4" style={{ color: "var(--info)" }} />
            <div
              className="serif"
              style={{ fontSize: 17, color: "var(--ink)" }}
            >
              Appointment type
            </div>
          </div>
          <p
            className="mb-3 text-[12.5px]"
            style={{ color: "var(--ink-2)" }}
          >
            Choose how the patient will be seen.
          </p>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setAppointmentType("in-person")}
              className="w-full rounded-xl px-4 py-3 text-left transition-colors"
              style={{
                background:
                  appointmentType === "in-person"
                    ? "var(--info-soft)"
                    : "var(--paper-2)",
                border: `1px solid ${
                  appointmentType === "in-person"
                    ? "var(--info)"
                    : "var(--line)"
                }`,
              }}
            >
              <div className="flex items-center gap-2">
                <User
                  className="h-3.5 w-3.5"
                  style={{
                    color:
                      appointmentType === "in-person"
                        ? "var(--info)"
                        : "var(--ink-3)",
                  }}
                />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  In-person
                </span>
              </div>
              <div
                className="mt-1 text-[12px]"
                style={{ color: "var(--ink-2)" }}
              >
                Patient is placed in the in-person waiting area and will be
                seen on site.
              </div>
            </button>

            <button
              type="button"
              onClick={() => setAppointmentType("virtual")}
              className="w-full rounded-xl px-4 py-3 text-left transition-colors"
              style={{
                background:
                  appointmentType === "virtual"
                    ? "var(--brand-soft)"
                    : "var(--paper-2)",
                border: `1px solid ${
                  appointmentType === "virtual"
                    ? "var(--brand-ink)"
                    : "var(--line)"
                }`,
              }}
            >
              <div className="flex items-center gap-2">
                <Video
                  className="h-3.5 w-3.5"
                  style={{
                    color:
                      appointmentType === "virtual"
                        ? "var(--brand-ink)"
                        : "var(--ink-3)",
                  }}
                />
                <span
                  className="text-[13px] font-medium"
                  style={{ color: "var(--ink)" }}
                >
                  Virtual
                </span>
              </div>
              <div
                className="mt-1 text-[12px]"
                style={{ color: "var(--ink-2)" }}
              >
                Patient is placed in the virtual waiting queue and can be seen
                via video.
              </div>
            </button>
          </div>
        </ClearingCard>

        {/* Submit */}
        <div className="flex items-center gap-2">
          <Btn
            kind="ghost"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Btn>
          <div className="flex-1" />
          <Btn
            kind="accent"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Sending…" : "Send to waiting room"}
          </Btn>
        </div>
      </div>
    </div>
  );
}
