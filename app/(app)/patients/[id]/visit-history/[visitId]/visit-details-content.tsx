"use client";

import * as React from "react";
import NextImage from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Edit,
  FileText,
  AudioWaveform,
  File,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  Eye,
  Download,
  ImageIcon,
  Video,
  ClipboardList,
  Stethoscope,
  Activity,
  Pill as PillIcon,
  Syringe,
  Users as UsersIcon,
  AlertTriangle,
  Scissors,
  History,
  FlaskConical,
  ClipboardCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  markVisitInProgressAction,
  finalizeVisitAction,
} from "@/app/_actions/visits";
import { getDocumentSignedUrlAction } from "@/app/_actions/documents";
import { formatVisitStatusLabel } from "@/app/_lib/utils/visit-status-label";
import type { VisitNote } from "@/app/_lib/visit-note/schema";
import {
  Btn,
  ClearingCard,
  Pill,
  SubTabHeader,
  Divider,
  type PillTone,
} from "@/components/ui/clearing";
import Link from "next/link";

interface VisitDetailsContentProps {
  visitId: string;
  patientId: string;
  visit: {
    id: string;
    status: string | null;
    createdAt: Date;
    notesFinalizedBy: string | null;
    notesFinalizedAt: Date | null;
    priority: string | null;
    appointmentType: string | null;
    clinicianId: string | null;
    twilioRoomName: string | null;
  };
  currentUserId: string;
  patient: {
    id: string;
    fullName: string;
    clinicianId: string | null;
  };
  notes: Array<{
    id: string;
    note: unknown;
    content: string | null;
    status: string | null;
    finalizedBy: string | null;
    finalizedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  transcripts: Array<{
    id: string;
    text: string | null;
    rawText: string | null;
    createdAt: Date;
  }>;
  documents: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: string;
    uploadedAt: Date;
    storageUrl: string;
  }>;
  finalizedByName: string | null;
  auditLogs: Array<{
    timestamp: Date;
    userId: string | null;
    userName: string | null;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    reason?: string;
  }>;
}

type LegacyAssessmentPlan = {
  assessment?: string;
  plan?: string;
};

type NoteMedication = VisitNote["medications"][number] & {
  name?: string;
  takingAsPrescribed?: boolean;
  missedDoses?: boolean;
  sideEffects?: boolean;
  sideEffectsNotes?: string;
};

type AssessmentMedication =
  VisitNote["assessmentPlan"][number]["medications"][number];
type NoteOrder = VisitNote["orders"][number];
type VaccineEntry = VisitNote["vaccines"][number];
type FamilyHistoryEntry = VisitNote["familyHistory"][number];
type SurgicalHistoryEntry = VisitNote["surgicalHistory"][number];
type PastMedicalHistoryEntry = VisitNote["pastMedicalHistory"][number];

type VisitDetailsNote = Partial<
  Omit<VisitNote, "assessmentPlan" | "objective">
> & {
  assessmentPlan?: VisitNote["assessmentPlan"] | LegacyAssessmentPlan;
  objective?:
    | (Partial<VisitNote["objective"]> & {
        examFindings?: VisitNote["objective"]["examFindings"] | string;
      })
    | string;
};

function isLegacyAssessmentPlan(
  value: VisitDetailsNote["assessmentPlan"]
): value is LegacyAssessmentPlan {
  return !!value && !Array.isArray(value);
}

function isObjectiveRecord(
  value: VisitDetailsNote["objective"]
): value is Partial<VisitNote["objective"]> & {
  examFindings?: VisitNote["objective"]["examFindings"] | string;
} {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function visitStatusTone(status: string | null): PillTone {
  if (!status) return "neutral";
  const s = status.toLowerCase();
  if (
    status === "Signed & Complete" ||
    s === "signed" ||
    s === "completed" ||
    s === "signed & complete" ||
    s === "finalized"
  ) {
    return "ok";
  }
  if (status === "Waiting" || s === "waiting") return "info";
  if (status === "In Progress" || s === "in_progress" || s === "in progress")
    return "accent";
  if (s === "draft") return "neutral";
  return "neutral";
}

type SectionHeadingProps = {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor?: string;
  title: string;
  count?: number;
};

function SectionHeading({
  icon: Icon,
  iconColor = "var(--ink-3)",
  title,
  count,
}: SectionHeadingProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4" style={{ color: iconColor }} />
      <div
        className="serif"
        style={{ fontSize: 17, color: "var(--ink)" }}
      >
        {title}
      </div>
      {typeof count === "number" && (
        <span
          className="mono ml-1 text-[11.5px]"
          style={{ color: "var(--ink-3)" }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span
        className="text-[11px] uppercase"
        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
      >
        {label}
      </span>
      <div
        className="mt-0.5 text-[13px]"
        style={{ color: "var(--ink)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function VisitDetailsContent({
  visitId,
  patientId,
  visit,
  patient,
  notes,
  transcripts,
  documents,
  finalizedByName,
  auditLogs,
  currentUserId,
}: VisitDetailsContentProps) {
  const router = useRouter();
  const [isMarkingInProgress, setIsMarkingInProgress] = React.useState(false);
  const [isSigning, setIsSigning] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<
    "notes" | "transcripts" | "documents" | "audit"
  >("notes");
  const [previewDocument, setPreviewDocument] = React.useState<
    typeof documents[0] | null
  >(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState<string | null>(null);

  const isSigned = visit.status === "Signed & Complete";
  const isInProgress = visit.status === "In Progress";
  const canEdit = isSigned || isInProgress;
  const canSignNote =
    patient.clinicianId === currentUserId ||
    visit.clinicianId === currentUserId;

  const handleEdit = async () => {
    if (!canEdit) return;

    if (isInProgress) {
      router.push(`/patients/${patientId}/new-visit?visitId=${visitId}`);
      return;
    }

    if (isSigned) {
      const reason = window.prompt(
        "Provide an amendment reason before reopening this signed note."
      );

      if (!reason?.trim()) {
        toast.error("An amendment reason is required to reopen a signed note");
        return;
      }

      setIsMarkingInProgress(true);
      try {
        await markVisitInProgressAction(
          visitId,
          "User initiated edit of signed note"
        );
        toast.success(
          "Visit marked as in progress. You can now edit the note."
        );
        router.push(`/patients/${patientId}/new-visit?visitId=${visitId}`);
      } catch (error) {
        console.error("Error marking visit in progress:", error);
        toast.error("Failed to mark visit as in progress");
      } finally {
        setIsMarkingInProgress(false);
      }
    }
  };

  const handleSign = async () => {
    if (isSigned) return;

    setIsSigning(true);
    try {
      await finalizeVisitAction(visitId, "signed");
      toast.success("Note signed successfully");
      router.refresh();
    } catch (error) {
      console.error("Error signing note:", error);
      toast.error("Failed to sign note");
    } finally {
      setIsSigning(false);
    }
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "finalized":
      case "signed":
        return (
          <CheckCircle2 className="h-4 w-4" style={{ color: "var(--ok)" }} />
        );
      case "edited_after_signing":
        return (
          <AlertCircle
            className="h-4 w-4"
            style={{ color: "oklch(0.5 0.12 70)" }}
          />
        );
      case "sent_to_waiting_room":
        return <Clock className="h-4 w-4" style={{ color: "var(--info)" }} />;
      case "assigned_to_me":
        return (
          <User className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
        );
      default:
        return <Clock className="h-4 w-4" style={{ color: "var(--ink-3)" }} />;
    }
  };

  const formatActionName = (action: string) => {
    switch (action) {
      case "finalized":
        return "Signed & Complete";
      case "edited_after_signing":
        return "Edited";
      case "created":
        return "Created";
      case "sent_to_waiting_room":
        return "Sent to Waiting Room";
      case "assigned_to_me":
        return "Assigned";
      default:
        return action.replace(/_/g, " ");
    }
  };

  const formatStatus = (status: string | null) => {
    if (!status) return "—";
    const statusLower = status.toLowerCase();
    if (
      statusLower === "finalized" ||
      statusLower === "signed" ||
      statusLower === "completed"
    ) {
      return "Signed & Complete";
    }
    if (
      statusLower === "draft" ||
      statusLower === "in_progress" ||
      statusLower === "in progress"
    ) {
      return "In Progress";
    }
    return status;
  };

  // Parse note content
  const noteData =
    (notes[0]?.note as VisitDetailsNote | null | undefined) ?? null;
  const objectiveData = isObjectiveRecord(noteData?.objective)
    ? noteData.objective
    : null;

  // Deduplicate documents
  const uniqueDocuments = React.useMemo(() => {
    const seen = new Map<string, boolean>();

    return documents.filter((doc) => {
      const idKey = `id:${doc.id}`;
      const storageKey = doc.storageUrl ? `storage:${doc.storageUrl}` : null;
      const fileKey = `file:${doc.filename}:${doc.size}`;

      if (
        seen.has(idKey) ||
        (storageKey && seen.has(storageKey)) ||
        seen.has(fileKey)
      ) {
        return false;
      }

      seen.set(idKey, true);
      if (storageKey) {
        seen.set(storageKey, true);
      }
      seen.set(fileKey, true);

      return true;
    });
  }, [documents]);

  const handlePreview = async (doc: typeof documents[0]) => {
    setIsLoadingPreview(true);
    setPreviewDocument(doc);
    try {
      const result = await getDocumentSignedUrlAction(doc.storageUrl);
      if (!result.success || !result.signedUrl) {
        throw new Error(result.error || "Failed to get preview URL");
      }
      setPreviewUrl(result.signedUrl);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load preview"
      );
      setPreviewDocument(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async (doc: typeof documents[0]) => {
    setIsDownloading(doc.id);
    try {
      const result = await getDocumentSignedUrlAction(doc.storageUrl);
      if (!result.success || !result.signedUrl) {
        throw new Error(result.error || "Failed to get download URL");
      }

      window.open(result.signedUrl, "_blank");
      toast.success("Opening document...");
    } catch (error) {
      console.error("Error downloading document:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to download document"
      );
    } finally {
      setIsDownloading(null);
    }
  };

  const handleClosePreview = () => {
    setPreviewDocument(null);
    setPreviewUrl(null);
  };

  const canPreview = (mimeType: string) => {
    return mimeType.startsWith("image/") || mimeType === "application/pdf";
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <ImageIcon className="h-5 w-5" />;
    }
    if (mimeType === "application/pdf") {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (size: string | number) => {
    const bytes = typeof size === "string" ? parseInt(size, 10) : size;
    if (isNaN(bytes)) return "Unknown size";

    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const objectiveExamFindingCategories = [
    { key: "general", label: "General" },
    { key: "heent", label: "HEENT" },
    { key: "neck", label: "Neck" },
    { key: "cardiovascular", label: "Cardiovascular" },
    { key: "lungs", label: "Lungs" },
    { key: "abdomen", label: "Abdomen" },
    { key: "musculoskeletal", label: "Musculoskeletal" },
    { key: "neurologic", label: "Neurologic" },
    { key: "skin", label: "Skin" },
    { key: "psychological", label: "Psychological" },
  ] as const;

  const hasValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim() !== "";
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "object") {
      return Object.values(value).some((nestedValue) => hasValue(nestedValue));
    }

    return true;
  };

  const tabs = [
    { k: "notes" as const, label: "Notes", icon: FileText, n: null as number | null },
    {
      k: "transcripts" as const,
      label: "Transcripts",
      icon: AudioWaveform,
      n: transcripts.length,
    },
    {
      k: "documents" as const,
      label: "Documents",
      icon: File,
      n: uniqueDocuments.length,
    },
    {
      k: "audit" as const,
      label: "Audit log",
      icon: Clock,
      n: auditLogs.length,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/patients/${patientId}/visit-history`}>
          <button
            type="button"
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
        </Link>
        <div className="flex-1">
          <SubTabHeader
            eyebrow="Chart · Visit details"
            title="Visit details"
            subtitle={`${patient.fullName} · ${formatDateTime(visit.createdAt)}`}
            actions={
              <>
                {visit.appointmentType?.toLowerCase() === "virtual" &&
                  visit.twilioRoomName && (
                    <Btn
                      kind="accent"
                      icon={<Video className="h-4 w-4" />}
                      onClick={() => router.push(`/visit/${visitId}/call`)}
                    >
                      Join call
                    </Btn>
                  )}
                {canEdit && (
                  <Btn
                    kind="soft"
                    icon={<Edit className="h-4 w-4" />}
                    onClick={handleEdit}
                    disabled={isMarkingInProgress}
                  >
                    {isMarkingInProgress ? "Processing…" : "Edit note"}
                  </Btn>
                )}
                {isInProgress && !isSigned && canSignNote && (
                  <Btn
                    kind="accent"
                    icon={<FileSignature className="h-4 w-4" />}
                    onClick={handleSign}
                    disabled={isSigning}
                  >
                    {isSigning ? "Signing…" : "Sign note"}
                  </Btn>
                )}
              </>
            }
          />
        </div>
      </div>

      {/* Patient context + status strip */}
      <div
        className="grid overflow-hidden rounded-2xl"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        <div
          className="flex flex-col gap-1.5 px-5 py-4"
          style={{ borderRight: "1px solid var(--line)" }}
        >
          <div
            className="text-[11px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
          >
            Patient
          </div>
          <div
            className="serif"
            style={{
              fontSize: 22,
              lineHeight: 1.1,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
            }}
          >
            {patient.fullName}
          </div>
          <div
            className="mono text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            {patient.id.slice(0, 8)}
          </div>
        </div>
        <div
          className="flex flex-col gap-1.5 px-5 py-4"
          style={{ borderRight: "1px solid var(--line)" }}
        >
          <div
            className="text-[11px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
          >
            Status
          </div>
          <div className="mt-1 flex items-center">
            <Pill tone={visitStatusTone(visit.status)} dot>
              {formatVisitStatusLabel(visit.status)}
            </Pill>
          </div>
          {finalizedByName && visit.notesFinalizedAt && (
            <div
              className="mt-1 text-[11.5px]"
              style={{ color: "var(--ink-3)" }}
            >
              Finalized by {finalizedByName}
              <div className="mono" style={{ color: "var(--ink-2)" }}>
                {formatDateTime(visit.notesFinalizedAt)}
              </div>
            </div>
          )}
        </div>
        <div
          className="flex flex-col gap-1.5 px-5 py-4"
          style={{ borderRight: "1px solid var(--line)" }}
        >
          <div
            className="text-[11px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
          >
            Appointment
          </div>
          <div
            className="text-[13.5px] font-medium"
            style={{ color: "var(--ink)" }}
          >
            {visit.appointmentType === "in-person"
              ? "In-person"
              : visit.appointmentType === "virtual"
              ? "Virtual"
              : visit.appointmentType || "—"}
          </div>
          {visit.priority && (
            <div>
              <Pill tone="info">{visit.priority}</Pill>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-4">
          <div
            className="text-[11px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
          >
            Created
          </div>
          <div
            className="mono text-[13px]"
            style={{ color: "var(--ink)" }}
          >
            {formatDateTime(visit.createdAt)}
          </div>
          <div
            className="mono text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            Visit {visit.id.slice(0, 8)}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-full p-1 self-start"
        style={{
          border: "1px solid var(--line)",
          background: "var(--paper-2)",
        }}
      >
        {tabs.map((t) => {
          const active = activeTab === t.k;
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setActiveTab(t.k)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium tracking-tight transition-colors"
              style={{
                background: active ? "var(--ink)" : "transparent",
                color: active ? "var(--paper)" : "var(--ink-2)",
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {typeof t.n === "number" && (
                <span className="mono ml-1 opacity-70">{t.n}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notes Tab */}
      {activeTab === "notes" && (
        <div className="flex flex-col gap-5">
          {!noteData ? (
            <ClearingCard>
              <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                No notes available
              </p>
            </ClearingCard>
          ) : (
            <>
              {/* Subjective */}
              {noteData.subjective &&
                (noteData.subjective.chiefComplaint ||
                  noteData.subjective.hpi) && (
                  <ClearingCard>
                    <SectionHeading
                      icon={ClipboardList}
                      iconColor="var(--info)"
                      title="Subjective"
                    />
                    <div className="flex flex-col gap-3">
                      {noteData.subjective.chiefComplaint && (
                        <Field label="Chief complaint">
                          {noteData.subjective.chiefComplaint}
                        </Field>
                      )}
                      {noteData.subjective.hpi && (
                        <Field label="HPI">
                          <span className="whitespace-pre-wrap">
                            {noteData.subjective.hpi}
                          </span>
                        </Field>
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Objective */}
              {objectiveData &&
                Object.values(objectiveData).some((value) =>
                  hasValue(value)
                ) && (
                  <ClearingCard>
                    <SectionHeading
                      icon={Stethoscope}
                      iconColor="var(--brand-ink)"
                      title="Objective"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      {objectiveData.bp && (
                        <Field label="Blood pressure">
                          <span className="mono">{objectiveData.bp}</span>
                        </Field>
                      )}
                      {objectiveData.hr && (
                        <Field label="Heart rate">
                          <span className="mono">{objectiveData.hr}</span>
                        </Field>
                      )}
                      {objectiveData.temp && (
                        <Field label="Temperature">
                          <span className="mono">{objectiveData.temp}</span>
                        </Field>
                      )}
                      {objectiveData.weight && (
                        <Field label="Weight">
                          <span className="mono">
                            {objectiveData.weight} lbs
                          </span>
                        </Field>
                      )}
                      {objectiveData.height && (
                        <Field label="Height">
                          <span className="mono">
                            {objectiveData.height} cm
                          </span>
                        </Field>
                      )}
                    </div>
                    {objectiveData.examFindings && (
                      <div className="mt-4">
                        <Divider />
                        <div
                          className="mt-3 text-[11px] uppercase"
                          style={{
                            color: "var(--ink-3)",
                            letterSpacing: "0.1em",
                          }}
                        >
                          Physical examination
                        </div>
                        {typeof objectiveData.examFindings === "string" ? (
                          <div
                            className="mt-2 whitespace-pre-wrap text-[13px]"
                            style={{ color: "var(--ink)" }}
                          >
                            {objectiveData.examFindings}
                          </div>
                        ) : (
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            {(() => {
                              const examFindings = objectiveData.examFindings;
                              if (!examFindings || typeof examFindings === "string") {
                                return null;
                              }
                              return objectiveExamFindingCategories.map(
                                (category) => {
                                  const value =
                                    examFindings[
                                      category.key as keyof typeof examFindings
                                    ];
                                  return value && value !== "" ? (
                                    <Field
                                      key={category.key}
                                      label={category.label}
                                    >
                                      <span className="whitespace-pre-wrap">
                                        {String(value)}
                                      </span>
                                    </Field>
                                  ) : null;
                                }
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                    {(objectiveData.visionOd ||
                      objectiveData.visionOs ||
                      objectiveData.visionOu) && (
                      <div className="mt-4">
                        <Divider />
                        <div
                          className="mt-3 text-[11px] uppercase"
                          style={{
                            color: "var(--ink-3)",
                            letterSpacing: "0.1em",
                          }}
                        >
                          Vision
                        </div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {objectiveData.visionOd && (
                            <Field label="OD">
                              <span className="mono">
                                {objectiveData.visionOd}
                              </span>
                            </Field>
                          )}
                          {objectiveData.visionOs && (
                            <Field label="OS">
                              <span className="mono">
                                {objectiveData.visionOs}
                              </span>
                            </Field>
                          )}
                          {objectiveData.visionOu && (
                            <Field label="OU">
                              <span className="mono">
                                {objectiveData.visionOu}
                              </span>
                            </Field>
                          )}
                          {objectiveData.visionCorrection && (
                            <Field label="Correction">
                              {objectiveData.visionCorrection}
                            </Field>
                          )}
                          {objectiveData.visionBlurry && (
                            <Field label="Blurry">
                              {objectiveData.visionBlurry}
                            </Field>
                          )}
                          {objectiveData.visionFloaters && (
                            <Field label="Floaters">
                              {objectiveData.visionFloaters}
                            </Field>
                          )}
                          {objectiveData.visionPain && (
                            <Field label="Pain">
                              {objectiveData.visionPain}
                            </Field>
                          )}
                          {objectiveData.visionLastExamDate && (
                            <Field label="Last exam date">
                              <span className="mono">
                                {objectiveData.visionLastExamDate}
                              </span>
                            </Field>
                          )}
                        </div>
                      </div>
                    )}
                  </ClearingCard>
                )}

              {/* Point of Care */}
              {noteData.pointOfCare &&
                ((noteData.pointOfCare.diabetes &&
                  Object.values(noteData.pointOfCare.diabetes).some((value) =>
                    hasValue(value)
                  )) ||
                  (noteData.pointOfCare.hiv &&
                    noteData.pointOfCare.hiv !== "") ||
                  (noteData.pointOfCare.syphilis &&
                    (noteData.pointOfCare.syphilis.result ||
                      noteData.pointOfCare.syphilis.reactivity))) && (
                  <ClearingCard>
                    <SectionHeading
                      icon={FlaskConical}
                      iconColor="var(--info)"
                      title="Point of care"
                    />
                    <div className="flex flex-col gap-4">
                      {noteData.pointOfCare.diabetes &&
                        Object.values(noteData.pointOfCare.diabetes).some(
                          (value) => hasValue(value)
                        ) && (
                          <div>
                            <div
                              className="mb-2 text-[11px] uppercase"
                              style={{
                                color: "var(--ink-3)",
                                letterSpacing: "0.1em",
                              }}
                            >
                              Diabetes
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {noteData.pointOfCare.diabetes
                                .fastingGlucose && (
                                <Field label="Fasting glucose">
                                  <span className="mono">
                                    {
                                      noteData.pointOfCare.diabetes
                                        .fastingGlucose
                                    }
                                  </span>
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes
                                .randomGlucose && (
                                <Field label="Random glucose">
                                  <span className="mono">
                                    {
                                      noteData.pointOfCare.diabetes
                                        .randomGlucose
                                    }
                                  </span>
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes.hbA1cValue && (
                                <Field label="HbA1c">
                                  <span className="mono">
                                    {
                                      noteData.pointOfCare.diabetes
                                        .hbA1cValue
                                    }
                                  </span>
                                  {noteData.pointOfCare.diabetes
                                    .hbA1cDate && (
                                    <span
                                      className="mono ml-2"
                                      style={{ color: "var(--ink-3)" }}
                                    >
                                      (
                                      {
                                        noteData.pointOfCare.diabetes
                                          .hbA1cDate
                                      }
                                      )
                                    </span>
                                  )}
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes
                                .homeMonitoring && (
                                <Field label="Home monitoring">
                                  {
                                    noteData.pointOfCare.diabetes
                                      .homeMonitoring
                                  }
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes
                                .averageReadings && (
                                <Field label="Average readings">
                                  <span className="mono">
                                    {
                                      noteData.pointOfCare.diabetes
                                        .averageReadings
                                    }
                                  </span>
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes
                                .hypoglycemiaEpisodes && (
                                <Field label="Hypoglycemia episodes">
                                  {
                                    noteData.pointOfCare.diabetes
                                      .hypoglycemiaEpisodes
                                  }
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes
                                .hyperglycemiaSymptoms && (
                                <Field label="Hyperglycemia symptoms">
                                  {
                                    noteData.pointOfCare.diabetes
                                      .hyperglycemiaSymptoms
                                  }
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes.footExam && (
                                <Field label="Foot exam">
                                  {noteData.pointOfCare.diabetes.footExam}
                                </Field>
                              )}
                              {noteData.pointOfCare.diabetes.eyeExamDue && (
                                <Field label="Eye exam due">
                                  {noteData.pointOfCare.diabetes.eyeExamDue}
                                </Field>
                              )}
                            </div>
                          </div>
                        )}

                      {noteData.pointOfCare.hiv &&
                        noteData.pointOfCare.hiv !== "" && (
                          <div>
                            <div
                              className="mb-2 text-[11px] uppercase"
                              style={{
                                color: "var(--ink-3)",
                                letterSpacing: "0.1em",
                              }}
                            >
                              HIV
                            </div>
                            <Field label="Result">
                              {noteData.pointOfCare.hiv}
                            </Field>
                          </div>
                        )}

                      {noteData.pointOfCare.syphilis &&
                        (noteData.pointOfCare.syphilis.result ||
                          noteData.pointOfCare.syphilis.reactivity) && (
                          <div>
                            <div
                              className="mb-2 text-[11px] uppercase"
                              style={{
                                color: "var(--ink-3)",
                                letterSpacing: "0.1em",
                              }}
                            >
                              Syphilis
                            </div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {noteData.pointOfCare.syphilis.result && (
                                <Field label="Result">
                                  {noteData.pointOfCare.syphilis.result}
                                </Field>
                              )}
                              {noteData.pointOfCare.syphilis.reactivity && (
                                <Field label="Reactivity">
                                  {noteData.pointOfCare.syphilis.reactivity}
                                </Field>
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </ClearingCard>
                )}

              {/* Medications */}
              {noteData.medications &&
                Array.isArray(noteData.medications) &&
                noteData.medications.length > 0 && (
                  <ClearingCard>
                    <SectionHeading
                      icon={PillIcon}
                      iconColor="var(--brand-ink)"
                      title="Medications"
                      count={noteData.medications.length}
                    />
                    <div className="flex flex-col gap-3">
                      {noteData.medications.map(
                        (med: NoteMedication, index: number) => (
                          <div
                            key={index}
                            className="rounded-[10px] px-3 py-2.5"
                            style={{
                              background: "var(--paper-2)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {med.name && (
                              <div
                                className="text-[13px] font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {med.name}
                              </div>
                            )}
                            {med.dosage && (
                              <div
                                className="mono mt-0.5 text-[11.5px]"
                                style={{ color: "var(--ink-3)" }}
                              >
                                {med.dosage}
                              </div>
                            )}
                            <div
                              className="mt-2 flex flex-wrap gap-1.5"
                            >
                              <Pill
                                tone={med.takingAsPrescribed ? "ok" : "warn"}
                              >
                                {med.takingAsPrescribed
                                  ? "Taking as prescribed"
                                  : "Not as prescribed"}
                              </Pill>
                              <Pill
                                tone={med.missedDoses ? "warn" : "neutral"}
                              >
                                {med.missedDoses
                                  ? "Missed doses"
                                  : "No missed doses"}
                              </Pill>
                              <Pill
                                tone={
                                  med.sideEffects ? "critical" : "neutral"
                                }
                              >
                                {med.sideEffects
                                  ? "Side effects"
                                  : "No side effects"}
                              </Pill>
                            </div>
                            {med.sideEffectsNotes && (
                              <div
                                className="mt-2 text-[12.5px]"
                                style={{ color: "var(--ink-2)" }}
                              >
                                {med.sideEffectsNotes}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Assessment & Plan */}
              {noteData.assessmentPlan &&
                ((Array.isArray(noteData.assessmentPlan) &&
                  noteData.assessmentPlan.length > 0) ||
                  (isLegacyAssessmentPlan(noteData.assessmentPlan) &&
                    (!!noteData.assessmentPlan.assessment ||
                      !!noteData.assessmentPlan.plan))) && (
                  <ClearingCard>
                    <SectionHeading
                      icon={ClipboardCheck}
                      iconColor="var(--ok)"
                      title="Assessment & plan"
                    />
                    <div className="flex flex-col gap-4">
                      {Array.isArray(noteData.assessmentPlan) ? (
                        noteData.assessmentPlan.map(
                          (
                            item: VisitNote["assessmentPlan"][number],
                            index: number
                          ) => (
                            <div
                              key={index}
                              className="flex flex-col gap-2"
                              style={{
                                borderBottom:
                                  index <
                                  (noteData.assessmentPlan as VisitNote["assessmentPlan"])
                                    .length -
                                    1
                                    ? "1px solid var(--line)"
                                    : undefined,
                                paddingBottom:
                                  index <
                                  (noteData.assessmentPlan as VisitNote["assessmentPlan"])
                                    .length -
                                    1
                                    ? 16
                                    : 0,
                              }}
                            >
                              {item.assessment && (
                                <Field label="Assessment">
                                  <span className="whitespace-pre-wrap">
                                    {item.assessment}
                                  </span>
                                </Field>
                              )}
                              {item.plan && (
                                <Field label="Plan">
                                  <span className="whitespace-pre-wrap">
                                    {item.plan}
                                  </span>
                                </Field>
                              )}
                              {item.medications &&
                                Array.isArray(item.medications) &&
                                item.medications.length > 0 && (
                                  <Field label="Medications">
                                    <div className="flex flex-col gap-1">
                                      {item.medications.map(
                                        (
                                          med: AssessmentMedication,
                                          medIndex: number
                                        ) => (
                                          <div
                                            key={medIndex}
                                            className="text-[12.5px]"
                                          >
                                            <span className="font-medium">
                                              {med.brandName}
                                            </span>
                                            {med.dosage && (
                                              <span className="mono ml-2">
                                                {med.dosage}
                                              </span>
                                            )}
                                            {med.frequency && (
                                              <span
                                                className="mono ml-2"
                                                style={{
                                                  color: "var(--ink-3)",
                                                }}
                                              >
                                                {med.frequency}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      )}
                                    </div>
                                  </Field>
                                )}
                              {item.orders &&
                              Array.isArray(item.orders) &&
                              item.orders.length > 0 ? (
                                <Field label="Orders">
                                  <div className="flex flex-col gap-1">
                                    {item.orders.map(
                                      (
                                        order: NoteOrder,
                                        orderIndex: number
                                      ) => (
                                        <div
                                          key={orderIndex}
                                          className="text-[12.5px]"
                                        >
                                          {order.details || "None"}
                                        </div>
                                      )
                                    )}
                                  </div>
                                </Field>
                              ) : (
                                <Field label="Orders">
                                  <span style={{ color: "var(--ink-3)" }}>
                                    None
                                  </span>
                                </Field>
                              )}
                              {item.followUp && (
                                <Field label="Follow-up">
                                  <span className="whitespace-pre-wrap">
                                    {item.followUp}
                                  </span>
                                </Field>
                              )}
                              {item.education && (
                                <Field label="Education">
                                  <span className="whitespace-pre-wrap">
                                    {item.education}
                                  </span>
                                </Field>
                              )}
                              {item.coordination && (
                                <Field label="Coordination">
                                  <span className="whitespace-pre-wrap">
                                    {item.coordination}
                                  </span>
                                </Field>
                              )}
                            </div>
                          )
                        )
                      ) : isLegacyAssessmentPlan(noteData.assessmentPlan) ? (
                        <>
                          {noteData.assessmentPlan.assessment && (
                            <Field label="Assessment">
                              <span className="whitespace-pre-wrap">
                                {noteData.assessmentPlan.assessment}
                              </span>
                            </Field>
                          )}
                          {noteData.assessmentPlan.plan && (
                            <Field label="Plan">
                              <span className="whitespace-pre-wrap">
                                {noteData.assessmentPlan.plan}
                              </span>
                            </Field>
                          )}
                        </>
                      ) : null}
                    </div>
                  </ClearingCard>
                )}

              {/* Vaccines */}
              {noteData.vaccines &&
                Array.isArray(noteData.vaccines) &&
                noteData.vaccines.length > 0 && (
                  <ClearingCard>
                    <SectionHeading
                      icon={Syringe}
                      iconColor="var(--info)"
                      title="Vaccines"
                      count={noteData.vaccines.length}
                    />
                    <div className="flex flex-col gap-3">
                      {noteData.vaccines.map(
                        (vaccine: VaccineEntry, index: number) => (
                          <div
                            key={index}
                            className="rounded-[10px] px-3 py-2.5"
                            style={{
                              background: "var(--paper-2)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {vaccine.name && (
                              <div
                                className="text-[13px] font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {vaccine.name}
                              </div>
                            )}
                            <div className="mt-2 grid gap-1 md:grid-cols-2">
                              {vaccine.date && (
                                <Field label="Date">
                                  <span className="mono">{vaccine.date}</span>
                                </Field>
                              )}
                              {vaccine.dose && (
                                <Field label="Dose">{vaccine.dose}</Field>
                              )}
                              {vaccine.site && (
                                <Field label="Site">{vaccine.site}</Field>
                              )}
                              {vaccine.route && (
                                <Field label="Route">{vaccine.route}</Field>
                              )}
                              {vaccine.lotNumber && (
                                <Field label="Lot number">
                                  <span className="mono">
                                    {vaccine.lotNumber}
                                  </span>
                                </Field>
                              )}
                              {vaccine.manufacturer && (
                                <Field label="Manufacturer">
                                  {vaccine.manufacturer}
                                </Field>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Family History */}
              {noteData.familyHistory &&
                Array.isArray(noteData.familyHistory) &&
                noteData.familyHistory.length > 0 && (
                  <ClearingCard>
                    <SectionHeading
                      icon={UsersIcon}
                      iconColor="var(--ink-3)"
                      title="Family history"
                      count={noteData.familyHistory.length}
                    />
                    <div className="flex flex-col gap-2">
                      {noteData.familyHistory.map(
                        (fh: FamilyHistoryEntry, index: number) => (
                          <div
                            key={index}
                            className="rounded-[10px] px-3 py-2.5"
                            style={{
                              background: "var(--paper-2)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {fh.relationship && (
                              <div
                                className="text-[13px] font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {fh.relationship}
                              </div>
                            )}
                            <div
                              className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]"
                              style={{ color: "var(--ink-2)" }}
                            >
                              {fh.status && <span>Status: {fh.status}</span>}
                              {fh.conditions && (
                                <span>Conditions: {fh.conditions}</span>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Risk Flags */}
              {noteData.riskFlags &&
                Object.values(noteData.riskFlags).some((value) =>
                  hasValue(value)
                ) && (
                  <ClearingCard>
                    <SectionHeading
                      icon={AlertTriangle}
                      iconColor="var(--critical)"
                      title="Risk flags"
                    />
                    <div className="grid gap-3 md:grid-cols-2">
                      {noteData.riskFlags.tobaccoUse && (
                        <Field label="Tobacco use">
                          {noteData.riskFlags.tobaccoUse}
                        </Field>
                      )}
                      {noteData.riskFlags.tobaccoAmount && (
                        <Field label="Tobacco amount">
                          {noteData.riskFlags.tobaccoAmount}
                        </Field>
                      )}
                      {noteData.riskFlags.alcoholUse && (
                        <Field label="Alcohol use">
                          {noteData.riskFlags.alcoholUse}
                        </Field>
                      )}
                      {noteData.riskFlags.alcoholFrequency && (
                        <Field label="Alcohol frequency">
                          {noteData.riskFlags.alcoholFrequency}
                        </Field>
                      )}
                      {noteData.riskFlags.housingStatus && (
                        <Field label="Housing status">
                          {noteData.riskFlags.housingStatus}
                        </Field>
                      )}
                      {noteData.riskFlags.occupation && (
                        <Field label="Occupation">
                          {noteData.riskFlags.occupation}
                        </Field>
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Surgical History */}
              {noteData.surgicalHistory &&
                Array.isArray(noteData.surgicalHistory) &&
                noteData.surgicalHistory.length > 0 && (
                  <ClearingCard>
                    <SectionHeading
                      icon={Scissors}
                      iconColor="var(--ink-3)"
                      title="Surgical history"
                      count={noteData.surgicalHistory.length}
                    />
                    <div className="flex flex-col gap-2">
                      {noteData.surgicalHistory.map(
                        (surg: SurgicalHistoryEntry, index: number) => (
                          <div
                            key={index}
                            className="rounded-[10px] px-3 py-2.5"
                            style={{
                              background: "var(--paper-2)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {surg.procedure && (
                              <div
                                className="text-[13px] font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {surg.procedure}
                              </div>
                            )}
                            <div className="mt-1 grid gap-1 md:grid-cols-2 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                              {surg.date && (
                                <div>
                                  Date:{" "}
                                  <span className="mono">{surg.date}</span>
                                </div>
                              )}
                              {surg.site && <div>Site: {surg.site}</div>}
                              {surg.surgeon && (
                                <div>Surgeon: {surg.surgeon}</div>
                              )}
                              {surg.outcome && (
                                <div>Outcome: {surg.outcome}</div>
                              )}
                              {surg.source && (
                                <div className="md:col-span-2">
                                  Source: {surg.source}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Past Medical History */}
              {noteData.pastMedicalHistory &&
                Array.isArray(noteData.pastMedicalHistory) &&
                noteData.pastMedicalHistory.length > 0 && (
                  <ClearingCard>
                    <SectionHeading
                      icon={History}
                      iconColor="var(--ink-3)"
                      title="Past medical history"
                      count={noteData.pastMedicalHistory.length}
                    />
                    <div className="flex flex-col gap-2">
                      {noteData.pastMedicalHistory.map(
                        (pmh: PastMedicalHistoryEntry, index: number) => (
                          <div
                            key={index}
                            className="rounded-[10px] px-3 py-2.5"
                            style={{
                              background: "var(--paper-2)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {pmh.condition && (
                              <div
                                className="text-[13px] font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {pmh.condition}
                              </div>
                            )}
                            <div className="mt-1 grid gap-1 md:grid-cols-2 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                              {pmh.status && <div>Status: {pmh.status}</div>}
                              {pmh.diagnosedDate && (
                                <div>
                                  Diagnosed:{" "}
                                  <span className="mono">
                                    {pmh.diagnosedDate}
                                  </span>
                                </div>
                              )}
                              {pmh.impact && <div>Impact: {pmh.impact}</div>}
                              {pmh.icd10 && (
                                <div>
                                  ICD-10:{" "}
                                  <span className="mono">{pmh.icd10}</span>
                                </div>
                              )}
                              {pmh.source && (
                                <div className="md:col-span-2">
                                  Source: {pmh.source}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ClearingCard>
                )}

              {/* Orders */}
              {noteData.orders &&
                Array.isArray(noteData.orders) &&
                noteData.orders.length > 0 && (
                  <ClearingCard>
                    <SectionHeading
                      icon={Activity}
                      iconColor="var(--warn)"
                      title="Orders"
                      count={noteData.orders.length}
                    />
                    <div className="flex flex-col gap-2">
                      {noteData.orders.map(
                        (order: NoteOrder, index: number) => (
                          <div
                            key={index}
                            className="rounded-[10px] px-3 py-2.5"
                            style={{
                              background: "var(--paper-2)",
                              border: "1px solid var(--line)",
                            }}
                          >
                            {order.type && (
                              <div
                                className="text-[13px] font-medium"
                                style={{ color: "var(--ink)" }}
                              >
                                {order.type}
                              </div>
                            )}
                            <div className="mt-1 grid gap-1 md:grid-cols-2 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                              {order.priority && (
                                <div>Priority: {order.priority}</div>
                              )}
                              {order.status && (
                                <div>Status: {order.status}</div>
                              )}
                              {order.dateOrdered && (
                                <div>
                                  Date ordered:{" "}
                                  <span className="mono">
                                    {order.dateOrdered}
                                  </span>
                                </div>
                              )}
                              {order.details && (
                                <div className="md:col-span-2">
                                  Details: {order.details}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </ClearingCard>
                )}
            </>
          )}
        </div>
      )}

      {/* Transcripts Tab */}
      {activeTab === "transcripts" && (
        <ClearingCard>
          <SectionHeading
            icon={AudioWaveform}
            iconColor="var(--info)"
            title="Transcripts"
            count={transcripts.length}
          />
          {transcripts.length > 0 ? (
            <div className="flex flex-col gap-3">
              {transcripts.map((transcript, index) => (
                <div
                  key={transcript.id}
                  className="rounded-[10px] px-3.5 py-3"
                  style={{
                    background: "var(--paper-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      Transcript {index + 1}
                    </span>
                    <span
                      className="mono text-[11px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {formatDateTime(transcript.createdAt)}
                    </span>
                  </div>
                  <p
                    className="whitespace-pre-wrap text-[12.5px] leading-5"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {transcript.text ||
                      transcript.rawText ||
                      "No transcript text"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No transcripts available
            </p>
          )}
        </ClearingCard>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <ClearingCard pad={0}>
          <div
            className="flex items-center gap-2 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <File className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
            <div
              className="serif"
              style={{ fontSize: 17, color: "var(--ink)" }}
            >
              Documents
            </div>
            <span
              className="mono ml-1 text-[11.5px]"
              style={{ color: "var(--ink-3)" }}
            >
              {uniqueDocuments.length}
            </span>
          </div>
          {uniqueDocuments.length > 0 ? (
            <div>
              {uniqueDocuments.map((doc, i, arr) => {
                const previewable = canPreview(doc.mimeType);
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 px-5 py-3"
                    style={{
                      borderBottom:
                        i < arr.length - 1
                          ? "1px solid var(--line)"
                          : undefined,
                      cursor: previewable ? "pointer" : undefined,
                    }}
                    onClick={() => previewable && handlePreview(doc)}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "var(--paper-2)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.background =
                        "transparent";
                    }}
                  >
                    <div style={{ color: "var(--ink-3)" }}>
                      {getFileIcon(doc.mimeType)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[13.5px] font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {doc.filename}
                      </div>
                      <div
                        className="mono text-[11px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {doc.mimeType} · {formatFileSize(doc.size)}
                      </div>
                    </div>
                    <div
                      className="mono hidden text-[11px] sm:block"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {formatDateTime(doc.uploadedAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      {previewable && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(doc);
                          }}
                          disabled={
                            isLoadingPreview && previewDocument?.id === doc.id
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
                          style={{ color: "var(--ink-2)" }}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "var(--paper-3)";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.background = "transparent";
                          }}
                          title="Preview"
                          aria-label="Preview"
                        >
                          {isLoadingPreview &&
                          previewDocument?.id === doc.id ? (
                            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(doc);
                        }}
                        disabled={isDownloading === doc.id}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
                        style={{ color: "var(--ink-2)" }}
                        onMouseEnter={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "var(--paper-3)";
                        }}
                        onMouseLeave={(e) => {
                          (
                            e.currentTarget as HTMLButtonElement
                          ).style.background = "transparent";
                        }}
                        title="Download"
                        aria-label="Download"
                      >
                        {isDownloading === doc.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p
              className="px-5 py-6 text-[13px]"
              style={{ color: "var(--ink-3)" }}
            >
              No documents available
            </p>
          )}
        </ClearingCard>
      )}

      {/* Audit Log Tab */}
      {activeTab === "audit" && (
        <ClearingCard pad={0}>
          <div
            className="flex items-center gap-2 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <Clock className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
            <div
              className="serif"
              style={{ fontSize: 17, color: "var(--ink)" }}
            >
              Audit log
            </div>
            <span
              className="mono ml-1 text-[11.5px]"
              style={{ color: "var(--ink-3)" }}
            >
              {auditLogs.length}
            </span>
          </div>
          {auditLogs.length > 0 ? (
            <div>
              {auditLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex gap-3 px-5 py-3.5"
                  style={{
                    borderBottom:
                      index < auditLogs.length - 1
                        ? "1px solid var(--line)"
                        : undefined,
                  }}
                >
                  <div
                    className="mono w-[160px] shrink-0 text-[11.5px] leading-5"
                    style={{ color: "var(--ink-3)" }}
                  >
                    <div style={{ color: "var(--ink)" }}>
                      {formatDateTime(log.timestamp)}
                    </div>
                  </div>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: "var(--paper-2)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {getActionIcon(log.action)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[13px] font-medium"
                        style={{ color: "var(--ink)" }}
                      >
                        {formatActionName(log.action)}
                      </span>
                      {log.fromStatus && (
                        <>
                          <span
                            className="mono text-[11px]"
                            style={{ color: "var(--ink-3)" }}
                          >
                            →
                          </span>
                          <Pill
                            tone={visitStatusTone(log.fromStatus)}
                          >
                            {formatStatus(log.fromStatus)}
                          </Pill>
                          <span
                            className="mono text-[11px]"
                            style={{ color: "var(--ink-3)" }}
                          >
                            →
                          </span>
                        </>
                      )}
                      <Pill tone={visitStatusTone(log.toStatus)} dot>
                        {formatStatus(log.toStatus)}
                      </Pill>
                    </div>
                    <div
                      className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {log.userName || log.userId || "Unknown"}
                      </div>
                    </div>
                    {log.reason && (
                      <div
                        className="mt-1 text-[12px] italic"
                        style={{ color: "var(--ink-3)" }}
                      >
                        Reason: {log.reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p
              className="px-5 py-6 text-[13px]"
              style={{ color: "var(--ink-3)" }}
            >
              No audit log entries
            </p>
          )}
        </ClearingCard>
      )}

      {/* Document Preview Dialog */}
      {previewDocument && (
        <Dialog open={!!previewDocument} onOpenChange={handleClosePreview}>
          <DialogContent className="max-h-[90vh] sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewDocument.filename}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {previewUrl ? (
                previewDocument.mimeType.startsWith("image/") ? (
                  <div className="flex w-full items-center justify-center">
                    <NextImage
                      src={previewUrl}
                      alt={previewDocument.filename}
                      width={1600}
                      height={1200}
                      unoptimized
                      className="max-h-[70vh] max-w-full rounded-lg object-contain"
                    />
                  </div>
                ) : previewDocument.mimeType === "application/pdf" ? (
                  <div className="h-full min-h-[600px] w-full">
                    <iframe
                      src={previewUrl}
                      className="h-full min-h-[600px] w-full rounded-lg border-0"
                      title={previewDocument.filename}
                    />
                  </div>
                ) : (
                  <div className="flex h-full min-h-[400px] items-center justify-center">
                    <div className="text-center">
                      <File
                        className="mx-auto mb-4 h-12 w-12"
                        style={{ color: "var(--ink-3)" }}
                      />
                      <p
                        className="mb-4 text-[13px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        Preview not available for this file type
                      </p>
                      <Btn
                        kind="accent"
                        icon={<Download className="h-4 w-4" />}
                        onClick={() => handleDownload(previewDocument)}
                      >
                        Download to view
                      </Btn>
                    </div>
                  </div>
                )
              ) : (
                <div className="flex h-full min-h-[400px] items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-current border-t-transparent" />
                    <p
                      className="text-[13px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      Loading preview…
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
