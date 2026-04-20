"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */

import * as React from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Save, CheckCircle2, ChevronLeft, ChevronRight, ChevronDown, Plus, Pencil, Trash2, CheckCircle, AlertCircle, XCircle, Camera, X, Loader2, User, Clock, FileSignature, Video, Mic, Stethoscope, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionStepper, visitSections, getSectionsForRole } from "./section-stepper";
import { AICapturePanel, type AICaptureLiveState } from "./ai-capture-panel";
import { TranscriptPanel, type TranscriptEntry } from "./transcript-panel";
import { OfflineSyncBadge } from "./offline-sync-badge";
import { MedicalInfoPanel } from "./medical-info-panel";
import { visitNoteSchema, type VisitNote, createEmptyVisitNote, parseVisitNote } from "@/app/_lib/visit-note/schema";
import { preloadLamejs } from "@/app/_lib/utils/audioConverter";
import type { z } from "zod";
import { mergeVisitNote } from "@/app/_lib/visit-note/merge-with-conflicts";
import { loadDraft, saveDraft, getReviewedSections, clearDraft } from "@/app/_lib/offline/draft";
import { createVisitDraftAction, updateVisitDraftAction, updatePatientAssignedAction, saveTranscriptAction } from "@/app/_actions/visits";
import { createDocumentAction } from "@/app/_actions/documents";
import { cn } from "@/app/_lib/utils/cn";
import type { PatientBasics } from "@/app/_lib/db/drizzle/queries/patient";
import {
  Avatar,
  Btn as ClearingBtn,
  ClearingCard as ClearingCardWrap,
  Pill as ClearingPill,
} from "@/components/ui/clearing";
import { FieldGroup, VisitField, VisitSubCard, SectionDivider } from "./visit-field";

interface NewVisitFormProps {
  patientId: string;
  patientBasics: PatientBasics;
  userId: string;
  userRole: string;
  existingVisitId?: string;
  existingVisitData?: unknown;
  isRecording?: boolean;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  hideAICapture?: boolean;
  initialParsedData?: any;
  onParseReadyRef?: React.MutableRefObject<((parsed: any) => void) | null>;
  onSaveReadyRef?: React.MutableRefObject<(() => Promise<void>) | null>;
  isInVideoCall?: boolean; // Flag to indicate if form is in video call context
  visitAppointmentType?: string | null; // Appointment type for virtual visit detection
  visitTwilioRoomName?: string | null; // Twilio room name for joining calls
  visitCreatedByRole?: "doctor" | "nurse" | null;
  previousVisits?: Array<{
    id: string;
    status: string | null;
    createdAt: Date;
    appointmentType: string | null;
    priority: string | null;
    note: unknown;
  }>;
}

type VitalAlertTone = "amber" | "red";

interface VitalAlert {
  tone: VitalAlertTone;
  label: string;
}

function parseBpSystolic(value?: string) {
  if (!value) {
    return null;
  }

  const systolic = Number.parseFloat(value.split("/")[0] || "");
  return Number.isFinite(systolic) ? systolic : null;
}

function parseNumericVital(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getVitalAlert(field: "bp" | "hr" | "temp" | "spo2", value?: string): VitalAlert | null {
  if (field === "bp") {
    const systolic = parseBpSystolic(value);
    if (systolic === null) {
      return null;
    }
    if (systolic > 140) {
      return { tone: "amber", label: "Elevated BP" };
    }
    if (systolic < 90) {
      return { tone: "red", label: "Low BP" };
    }
    return null;
  }

  const numericValue = parseNumericVital(value);
  if (numericValue === null) {
    return null;
  }

  if (field === "hr") {
    if (numericValue > 100) {
      return { tone: "amber", label: "Tachycardia" };
    }
    if (numericValue < 60) {
      return { tone: "amber", label: "Bradycardia" };
    }
  }

  if (field === "temp") {
    const celsius = ((numericValue - 32) * 5) / 9;
    if (celsius > 38.3) {
      return { tone: "amber", label: "Fever" };
    }
  }

  if (field === "spo2" && numericValue < 95) {
    return { tone: "red", label: "Low SpO2" };
  }

  return null;
}

function VitalAlertBadge({ alert }: { alert: VitalAlert }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "ml-2",
        alert.tone === "red"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
      )}
    >
      {alert.label}
    </Badge>
  );
}


export function NewVisitForm({
  patientId,
  patientBasics,
  userId,
  userRole,
  existingVisitId,
  existingVisitData,
  isRecording = false,
  onStartRecording,
  onStopRecording,
  hideAICapture = false,
  initialParsedData,
  onParseReadyRef,
  onSaveReadyRef,
  isInVideoCall = false,
  visitAppointmentType,
  visitTwilioRoomName,
  visitCreatedByRole = null,
  previousVisits = [],
}: NewVisitFormProps) {
  const router = useRouter();
  const postSaveSessionKey = React.useMemo(
    () => `visit-post-save:${patientId}`,
    [patientId]
  );
  const shouldBypassDoctorPostSaveModal =
    userRole === "doctor" && visitCreatedByRole === "nurse";
  // Get sections based on role
  const roleSections = React.useMemo(() => getSectionsForRole(userRole), [userRole]);
  const [currentSection, setCurrentSection] = React.useState(roleSections[0].id);
  const [reviewedSections, setReviewedSections] = React.useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(new Set());
  const [medicalPanelOpen, setMedicalPanelOpen] = React.useState(false);
  const [medicalPanelSection, setMedicalPanelSection] = React.useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [visitIdRemote, setVisitIdRemote] = React.useState<string | null>(existingVisitId || null);
  const [draftLoaded, setDraftLoaded] = React.useState(false);
  const [hasAiDraftSuggestions, setHasAiDraftSuggestions] = React.useState(false);
  const [showPreviousVisitsDialog, setShowPreviousVisitsDialog] = React.useState(false);
  const [transcriptHistory, setTranscriptHistory] = React.useState<TranscriptEntry[]>([]);
  const [liveCaptureState, setLiveCaptureState] = React.useState<AICaptureLiveState | null>(null);

  // Listen for medical panel open events from PatientChartShell
  React.useEffect(() => {
    const handleOpenMedicalPanel = (event: Event) => {
      const customEvent = event as CustomEvent<{ sectionId: string }>;
      const sectionId = customEvent.detail?.sectionId;
      if (sectionId) {
        setMedicalPanelSection(sectionId);
        setMedicalPanelOpen(true);
      }
    };

    window.addEventListener('openMedicalPanel', handleOpenMedicalPanel);
    return () => {
      window.removeEventListener('openMedicalPanel', handleOpenMedicalPanel);
    };
  }, []);

  // Also check URL searchParams on mount and when they change
  React.useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const medicalSection = searchParams.get('medicalSection');
    if (medicalSection) {
      setMedicalPanelSection(medicalSection);
      setMedicalPanelOpen(true);
      // Clear the param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('medicalSection');
      window.history.replaceState({}, '', url);
    }

    // Check if visit was just saved (from call page)
    const saved = searchParams.get('saved');
    if (saved === 'true') {
      if (!shouldBypassDoctorPostSaveModal) {
        setShowPostSaveModal(true);
      }
      // Clear the param from URL without reload
      const url = new URL(window.location.href);
      url.searchParams.delete('saved');
      window.history.replaceState({}, '', url);
    }
  }, [shouldBypassDoctorPostSaveModal]);

  const [showPostSaveModal, setShowPostSaveModal] = React.useState(false);
  const [isProcessingAction, setIsProcessingAction] = React.useState(false);
  const appliedParsedDataRef = React.useRef<any>(null);
  const lockedPathsRef = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const rawState = window.sessionStorage.getItem(postSaveSessionKey);
    if (!rawState) return;

    window.sessionStorage.removeItem(postSaveSessionKey);

    try {
      const savedState = JSON.parse(rawState) as {
        patientId?: string;
        visitId?: string;
      };

      if (savedState.patientId !== patientId) {
        return;
      }

      if (savedState.visitId) {
        setVisitIdRemote(savedState.visitId);
      }

      if (!shouldBypassDoctorPostSaveModal) {
        setShowPostSaveModal(true);
      }
    } catch (error) {
      console.warn("Failed to restore post-save state:", error);
    }
  }, [patientId, postSaveSessionKey, shouldBypassDoctorPostSaveModal]);

  const form = useForm({
    resolver: zodResolver(visitNoteSchema),
    defaultValues: createEmptyVisitNote(),
  });

  const aiTranscriptConsent = form.watch("consents.aiTranscript");
  const hasConsentOnFile = Boolean(patientBasics.consentSignatureUrl);

  React.useEffect(() => {
    if (!aiTranscriptConsent) {
      form.setValue("consents.aiTranscriptConfirmedAt", "");
      form.setValue("consents.aiTranscriptConfirmedBy", "");
      return;
    }

    if (!form.getValues("consents.aiTranscriptConfirmedAt")) {
      form.setValue("consents.aiTranscriptConfirmedAt", new Date().toISOString());
    }

    if (!form.getValues("consents.aiTranscriptConfirmedBy")) {
      form.setValue("consents.aiTranscriptConfirmedBy", userId);
    }
  }, [aiTranscriptConsent, form, userId]);

  const collectLockedPaths = React.useCallback((dirtyFields: Record<string, unknown>) => {
    const locked = new Set<string>();

    const walk = (value: unknown, prefix = "") => {
      if (!value) return;
      if (value === true && prefix) {
        locked.add(prefix);
        return;
      }
      if (Array.isArray(value)) {
        return;
      }
      if (typeof value === "object") {
        for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
          walk(child, prefix ? `${prefix}.${key}` : key);
        }
      }
    };

    walk(dirtyFields);
    return locked;
  }, []);

  React.useEffect(() => {
    const dirtyFields = form.formState.dirtyFields as Record<string, unknown>;
    const currentLockedPaths = collectLockedPaths(dirtyFields);

    currentLockedPaths.forEach((path) => {
      lockedPathsRef.current.add(path);
    });
  }, [collectLockedPaths, form.formState.dirtyFields]);

  const getLockedPaths = React.useCallback(() => {
    const dirtyFields = form.formState.dirtyFields as Record<string, unknown>;
    const locked = new Set<string>(lockedPathsRef.current);
    const currentLockedPaths = collectLockedPaths(dirtyFields);

    currentLockedPaths.forEach((path) => {
      locked.add(path);
    });

    return locked;
  }, [collectLockedPaths, form.formState.dirtyFields]);

  // Auto-mark section as reviewed when navigated to
  const handleSectionChange = React.useCallback(async (sectionId: string) => {
    // Save current section data before switching
    if (draftLoaded) {
      try {
        const formData = form.getValues() as VisitNote;
        await saveDraft(patientId, userId, {
          formState: formData,
          reviewedSections: reviewedSections,
          expandedSections: expandedSections,
          role: userRole,
          visitIdRemote: visitIdRemote || undefined,
        });
      } catch (error) {
        console.error("Error auto-saving on section change:", error);
      }
    }

    // Regular section navigation (Visit Note Sections)
    setCurrentSection(sectionId);
    setReviewedSections((prev) => {
      const updated = new Set(prev);
      updated.add(sectionId);
      return updated;
    });
    // Close medical panel if open when navigating visit note sections
    setMedicalPanelOpen(false);
    setMedicalPanelSection(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, patientId, userId, userRole, reviewedSections, expandedSections, visitIdRemote]);

  // Watch weight and height for BMI calculation
  const weight = useWatch({ control: form.control, name: "objective.weight" });
  const height = useWatch({ control: form.control, name: "objective.height" });
  const intakeChiefComplaint = useWatch({
    control: form.control,
    name: "subjective.chiefComplaint",
  });
  const intakeBp = useWatch({ control: form.control, name: "objective.bp" });
  const intakeHr = useWatch({ control: form.control, name: "objective.hr" });
  const intakeTemp = useWatch({ control: form.control, name: "objective.temp" });
  const intakeSpo2 = useWatch({ control: form.control, name: "objective.spo2" });
  const intakeWeight = useWatch({
    control: form.control,
    name: "objective.weight",
  });
  const intakeTriageNotes = useWatch({
    control: form.control,
    name: "subjective.hpi",
  });
  const [nurseIntakeExpanded, setNurseIntakeExpanded] = React.useState(false);
  const [blurredVitals, setBlurredVitals] = React.useState<
    Partial<Record<"bp" | "hr" | "temp" | "spo2", boolean>>
  >({});

  // Calculate BMI when weight or height changes
  React.useEffect(() => {
    const calculateBMI = () => {
      const weightNum = parseFloat(weight || "");
      const heightNum = parseFloat(height || "");

      if (weightNum > 0 && heightNum > 0) {
        // Convert weight from lbs to kg: lbs * 0.453592
        const weightKg = weightNum * 0.453592;
        // Convert height from cm to m: cm / 100
        const heightM = heightNum / 100;
        // Calculate BMI: kg / (m^2)
        const bmi = weightKg / (heightM * heightM);
        // Round to 1 decimal place
        const bmiRounded = bmi.toFixed(1);
        form.setValue("objective.bmi", bmiRounded);
      } else {
        // Clear BMI if weight or height is invalid
        form.setValue("objective.bmi", "");
      }
    };

    calculateBMI();
  }, [weight, height, form]);

  // Pre-load lamejs when component mounts (if online)
  React.useEffect(() => {
    if (navigator.onLine) {
      preloadLamejs().catch((error) => {
        console.warn("Failed to preload lamejs:", error);
      });
    }
  }, []);

  // Listen for draft updates from sync engine
  React.useEffect(() => {
    const handleDraftUpdate = async (event: Event) => {
      const customEvent = event as CustomEvent<{ patientId?: string; hasParsedData?: boolean }>;
      const { patientId: updatedPatientId, hasParsedData } = customEvent.detail || {};

      // Only reload if this draft is for the current patient
      if (updatedPatientId === patientId && draftLoaded) {
        try {
          const { getDraftFormState } = await import("@/app/_lib/offline/draft");
          const updatedFormState = await getDraftFormState(patientId, userId);

          if (updatedFormState) {
            const currentData = form.getValues() as VisitNote;
            // Merge with most recent (AI) values taking precedence
            const merged = mergeVisitNote(currentData, updatedFormState);
            form.reset(merged);

            if (hasParsedData) {
              toast.success("Visit note updated with AI-parsed data");
            } else {
              toast.info("Draft updated");
            }
          }
        } catch (error) {
          console.error("Error reloading draft after sync:", error);
        }
      }
    };

    window.addEventListener("draftUpdated", handleDraftUpdate);

    return () => {
      window.removeEventListener("draftUpdated", handleDraftUpdate);
    };
  }, [patientId, userId, draftLoaded, form]);

  // Load draft on mount
  React.useEffect(() => {
    const loadDraftData = async () => {
      try {
        // Always check for draft first (even when editing existing visit)
        // This ensures unsaved changes persist across page refreshes
        const draft = await loadDraft(patientId, userId, userRole);
        const formState = await getDraftFormState(patientId, userId);
        const reviewed = await getReviewedSections(patientId, userId);

        // If we have a draft with meaningful form state, use it (user's unsaved changes)
        // Check if draft has actual data (not just empty defaults)
        const hasDraftData = formState && draft.formStateJson && draft.formStateJson !== "{}" && draft.formStateJson.trim() !== "";
        if (hasDraftData) {
          form.reset(formState);
          setReviewedSections(reviewed);
          if (draft.visitIdRemote) {
            setVisitIdRemote(draft.visitIdRemote);
          }
          setDraftLoaded(true);
          return;
        }

        // If editing existing visit and no draft, load from visit data
        if (existingVisitId && existingVisitData) {
          try {
            // Use parseVisitNote which handles migration
            const parsedData = parseVisitNote(existingVisitData);
            form.reset(parsedData);
            // Continue-note / edit path: do not block Save on section-review gate (audit P0).
            // User can still step through sections; all are treated as reviewed for this visit.
            const sectionsForRole = getSectionsForRole(userRole);
            setReviewedSections(new Set(sectionsForRole.map((s) => s.id)));
            setExpandedSections(new Set(sectionsForRole.map(s => s.id)));
            setVisitIdRemote(existingVisitId);
            setDraftLoaded(true);
            return;
          } catch (error) {
            console.error("Error parsing existing visit data:", error);
          }
        }

        // No draft and not editing - start fresh
        // Mark initial section as reviewed (use role-specific sections)
        const sectionsForRole = getSectionsForRole(userRole);
        if (!reviewed.has(sectionsForRole[0].id)) {
          reviewed.add(sectionsForRole[0].id);
        }

        setReviewedSections(reviewed);
        if (draft.visitIdRemote) {
          setVisitIdRemote(draft.visitIdRemote);
        }
        setDraftLoaded(true);
      } catch (error) {
        console.error("Error loading draft (IndexedDB may be unavailable):", error);
        // Still initialize the form properly — mark first section reviewed
        const sectionsForRole = getSectionsForRole(userRole);
        setReviewedSections(new Set([sectionsForRole[0].id]));

        // If editing existing visit, load from visit data even if draft failed
        if (existingVisitId && existingVisitData) {
          try {
            const parsedData = parseVisitNote(existingVisitData);
            form.reset(parsedData);
            setReviewedSections(new Set(sectionsForRole.map((s) => s.id)));
            setExpandedSections(new Set(sectionsForRole.map(s => s.id)));
            setVisitIdRemote(existingVisitId);
          } catch (parseError) {
            console.error("Error parsing existing visit data:", parseError);
          }
        }

        setDraftLoaded(true);
      }
    };

    loadDraftData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, userId, userRole]);

  // Apply initial parsed data when it becomes available
  React.useEffect(() => {
    if (initialParsedData && draftLoaded) {
      // Use JSON stringify for comparison to detect actual data changes
      const dataKey = JSON.stringify(initialParsedData);
      if (appliedParsedDataRef.current !== dataKey) {
        try {
          console.log("Applying parsed data to form:", initialParsedData);
          const currentData = form.getValues() as VisitNote;
          console.log("Current form data before merge:", currentData);

          // Merge with most recent (AI) values taking precedence
          const merged = mergeVisitNote(
            currentData,
            initialParsedData as Partial<VisitNote>,
            { lockedPaths: getLockedPaths() }
          );

          console.log("Merged data after merge:", merged);

          form.reset(merged);
          appliedParsedDataRef.current = dataKey;
          setHasAiDraftSuggestions(true);
          toast.success("AI data applied to form");

          // Verify the form was updated
          const updatedData = form.getValues() as VisitNote;
          console.log("Form data after reset:", updatedData);
        } catch (error) {
          console.error("Error applying initial parsed data:", error);
          toast.error("Failed to apply AI data to form");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialParsedData, draftLoaded, getLockedPaths]);

  // Auto-save draft on form changes (debounced)
  React.useEffect(() => {
    if (!draftLoaded) return;

    const subscription = form.watch(() => {
      const timeoutId = setTimeout(async () => {
        try {
          const formData = form.getValues() as VisitNote;
          const currentReviewed = reviewedSections;
          const currentExpanded = expandedSections;
          const currentVisitId = visitIdRemote;

          await saveDraft(patientId, userId, {
            formState: formData,
            reviewedSections: currentReviewed,
            expandedSections: currentExpanded,
            role: userRole,
            visitIdRemote: currentVisitId || undefined,
          });
        } catch (error) {
          console.error("Error saving draft:", error);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, userId, draftLoaded]);

  // Online/offline detection and sync engine
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Start sync engine when online
      const { getSyncEngine } = require("@/app/_lib/offline/sync-engine");
      const syncEngine = getSyncEngine();
      syncEngine.start();
    };
    const handleOffline = () => setIsOnline(false);

    // Initialize sync engine
    if (navigator.onLine) {
      const { getSyncEngine } = require("@/app/_lib/offline/sync-engine");
      const syncEngine = getSyncEngine();
      syncEngine.start();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      // Stop sync engine on unmount
      const { getSyncEngine } = require("@/app/_lib/offline/sync-engine");
      const syncEngine = getSyncEngine();
      syncEngine.stop();
    };
  }, []);

  const handleTranscriptReady = async (transcript: string) => {
    const timestamp = liveCaptureState?.recordingTime ?? 0;
    setTranscriptHistory((prev) => [
      ...prev,
      {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: transcript,
        speaker: "Clinician",
        timestamp,
        createdAt: new Date(),
      },
    ]);

    // Store transcript in draft (non-critical — IndexedDB may be unavailable)
    try {
      await saveDraft(patientId, userId, { transcript, role: userRole });
    } catch (draftError) {
      console.warn("Failed to save transcript to draft:", draftError);
    }

    // Save transcript to database immediately if visit exists
    if (visitIdRemote) {
      try {
        await saveTranscriptAction({
          visitId: visitIdRemote,
          text: transcript,
          rawText: transcript,
        });
      } catch (error) {
        console.error("Error saving transcript:", error);
        // Don't block the UI if transcript save fails
      }
    }
  };

  const handleParseReady = async (parsed: unknown) => {
    try {
      const currentData = form.getValues() as VisitNote;

      // Merge with most recent (AI) values taking precedence
      const merged = mergeVisitNote(currentData, parsed as Partial<VisitNote>, {
        lockedPaths: getLockedPaths(),
      });

      form.reset(merged);
      setHasAiDraftSuggestions(true);
      toast.success("AI data applied to form");
    } catch (error) {
      console.error("Error merging parsed data:", error);
      toast.error("Failed to apply AI data");
    }
  };

  // Auto-save reviewed sections when they change
  React.useEffect(() => {
    if (!draftLoaded) return;

    // Use a ref to track if we've already saved to avoid loops
    const timeoutId = setTimeout(async () => {
      try {
        await saveDraft(patientId, userId, { reviewedSections, role: userRole });
      } catch (error) {
        console.error("Error saving reviewed sections:", error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewedSections.size, patientId, userId, userRole, draftLoaded]);

  // Check if all visible sections (based on role) are reviewed
  const allSectionsReviewed = roleSections.every((s) => reviewedSections.has(s.id));


  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleFinalize = async () => {
    if (!allSectionsReviewed) {
      toast.error("Please review all sections before finalizing");
      return;
    }

    setIsSaving(true);
    try {
      const formData = form.getValues() as VisitNote;
      let savedVisitId = visitIdRemote;

      if (!savedVisitId) {
        // Load draft to get transcript if available (non-critical — IndexedDB may be unavailable)
        let draft: { transcript?: string } = {};
        try {
          draft = await loadDraft(patientId, userId, userRole);
        } catch (draftError) {
          console.warn("Failed to load draft from IndexedDB, proceeding without it:", draftError);
        }

        // Create visit first
        const result = await createVisitDraftAction({
          patientId,
          notesJson: formData,
          transcript: draft.transcript || undefined,
        });
        savedVisitId = result.visitId;
        setVisitIdRemote(result.visitId);

        // Save any transcripts from draft to database
        if (draft.transcript) {
          try {
            await saveTranscriptAction({
              visitId: result.visitId,
              text: draft.transcript,
              rawText: draft.transcript,
            });
          } catch (error) {
            console.error("Error saving transcript from draft:", error);
          }
        }
      } else {
        // Update visit
        await updateVisitDraftAction(savedVisitId, {
          notesJson: formData,
        });
      }

      // Save documents to database
      const documents = formData.docs?.uploadedDocuments || [];
      if (documents.length > 0 && savedVisitId) {
        const documentPromises = documents.map(async (doc: any) => {
          // Only save if it doesn't already have a DB record (check if it has storageUrl)
          // Documents uploaded during the form already have storageUrl from the upload endpoint
          if (doc.storageUrl) {
            return createDocumentAction({
              patientId,
              visitId: savedVisitId,
              filename: doc.name,
              mimeType: doc.type,
              size: doc.size.toString(),
              storageUrl: doc.storageUrl,
            });
          }
          return null;
        });

        const results = await Promise.allSettled(documentPromises);
        const failures = results.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          console.warn("Some documents failed to save:", failures);
          // Don't block finalization if document save fails
        }
      }

      // Don't finalize yet - keep as "In Progress" unless user clicks "Sign Note"
      // The visit status will remain "In Progress" until explicitly signed
      // Medications will be synced to patient record when the note is signed

      if (typeof window !== "undefined" && savedVisitId) {
        window.sessionStorage.setItem(
          postSaveSessionKey,
          JSON.stringify({
            patientId,
            visitId: savedVisitId,
          })
        );
      }

      // Clear draft (non-critical — IndexedDB may be unavailable)
      try {
        await clearDraft(patientId, userId);
      } catch (clearError) {
        console.warn("Failed to clear draft from IndexedDB:", clearError);
      }

      if (shouldBypassDoctorPostSaveModal) {
        toast.success("Visit saved and returned to physician workflow");
        router.push("/open-notes");
      } else {
        // Show post-save modal instead of redirecting
        setShowPostSaveModal(true);
        toast.success("Visit saved successfully");
      }
    } catch (error) {
      console.error("Error finalizing visit:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to save visit: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Expose save function via ref
  React.useEffect(() => {
    if (onSaveReadyRef) {
      onSaveReadyRef.current = handleFinalize;
    }
    return () => {
      if (onSaveReadyRef) {
        onSaveReadyRef.current = null;
      }
    };
  }, [onSaveReadyRef, handleFinalize]);

  const handlePostSaveAction = async (action: "view" | "waiting" | "sign") => {
    if (!visitIdRemote) return;

    setIsProcessingAction(true);
    try {
      if (action === "view") {
        // Set is_assigned to null
        await updatePatientAssignedAction(patientId, null);
        router.push(`/patients/${patientId}`);
      } else if (action === "waiting") {
        // Navigate to send to waiting room page
        router.push(`/patients/${patientId}/send-to-waiting-room?visitId=${visitIdRemote}`);
      } else if (action === "sign") {
        if (userRole === "nurse") {
          await updatePatientAssignedAction(patientId, false);
          toast.success("Note handed off to physician workflow");
          router.push(`/waiting-room`);
        } else {
          router.push(`/patients/${patientId}/visit-close?visitId=${visitIdRemote}`);
        }
      } else {
        // For "view" and "waiting", keep visit as "In Progress"
        // Visit status remains "In Progress" until explicitly signed
      }
      setShowPostSaveModal(false);
    } catch (error) {
      console.error("Error processing post-save action:", error);
      toast.error("Failed to process action");
    } finally {
      setIsProcessingAction(false);
    }
  };

  const currentSectionIndex = roleSections.findIndex((s) => s.id === currentSection);
  const canGoNext = currentSectionIndex < roleSections.length - 1;
  const canGoPrev = currentSectionIndex > 0;

  const goToNext = () => {
    if (canGoNext) {
      const nextSectionId = roleSections[currentSectionIndex + 1].id;
      handleSectionChange(nextSectionId);
    }
  };

  const goToPrev = () => {
    if (canGoPrev) {
      const prevSectionId = roleSections[currentSectionIndex - 1].id;
      handleSectionChange(prevSectionId);
    }
  };

  // Render form section based on currentSection
  const renderSection = () => {
    const section = roleSections.find((s) => s.id === currentSection);
    if (!section) return null;

    switch (section.id) {
      case "subjective":
        return (
          <div className="flex flex-col gap-7">
            <FieldGroup
              eyebrow="Patient-reported"
              title="Chief complaint"
              description="The primary reason for today's visit, in the patient's own words when possible."
              icon={<Stethoscope className="h-4 w-4" />}
            >
              <Textarea
                {...form.register("subjective.chiefComplaint")}
                placeholder="e.g., Chest pain radiating to the left arm for the past hour."
                className="min-h-[96px]"
              />
              <div className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
                Tip: tap the microphone to dictate — the AI scribe will fill this in for your review.
              </div>
            </FieldGroup>

            <SectionDivider />

            <FieldGroup
              eyebrow="Narrative"
              title="History of present illness"
              description="Onset, character, location, duration, aggravating / relieving factors, associated symptoms."
              icon={<FileSignature className="h-4 w-4" />}
            >
              <Textarea
                {...form.register("subjective.hpi")}
                placeholder="34-year-old presenting with 1 hour of substernal chest pain, onset during exertion…"
                rows={10}
                className="min-h-[220px]"
              />
            </FieldGroup>
          </div>
        );
      case "objective":
        return (
          <div className="flex flex-col gap-7">
            <FieldGroup
              eyebrow="Measurements"
              title="Vitals"
              description="Record the patient's vital signs for this encounter."
              icon={<User className="h-4 w-4" />}
            >
              <VisitSubCard>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  <VisitField label="Blood pressure" trailing={<span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>mmHg</span>}>
                    <Input {...form.register("objective.bp")} placeholder="120/80" />
                  </VisitField>
                  <VisitField label="Heart rate" trailing={<span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>bpm</span>}>
                    <Input {...form.register("objective.hr")} placeholder="72" />
                  </VisitField>
                  <VisitField
                    label="Temperature"
                    trailing={<span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>°F</span>}
                    hint={(() => {
                      const temp = form.watch("objective.temp") || "";
                      const num = parseFloat(temp);
                      if (!isNaN(num) && temp) {
                        const celsius = ((num - 32) * 5) / 9;
                        return `${celsius.toFixed(1)}°C`;
                      }
                      return undefined;
                    })()}
                  >
                    <Input {...form.register("objective.temp")} placeholder="98.6" />
                  </VisitField>
                  <VisitField
                    label="Weight"
                    trailing={<span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>lb</span>}
                    hint={(() => {
                      const weight = form.watch("objective.weight") || "";
                      const num = parseFloat(weight);
                      if (!isNaN(num) && weight) {
                        const kg = num * 0.453592;
                        return `${kg.toFixed(1)} kg`;
                      }
                      return undefined;
                    })()}
                  >
                    <Input {...form.register("objective.weight")} placeholder="170" />
                  </VisitField>
                  <VisitField
                    label="Height"
                    trailing={<span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>cm</span>}
                    hint={(() => {
                      const heightValue = form.watch("objective.height");
                      if (!heightValue) return undefined;
                      const num = parseFloat(heightValue);
                      if (!isNaN(num)) {
                        const inches = num / 2.54;
                        const feet = Math.floor(inches / 12);
                        const remainingInches = Math.round(inches % 12);
                        if (feet > 0) return `${feet}′${remainingInches}″`;
                        return `${inches.toFixed(1)} in`;
                      }
                      return undefined;
                    })()}
                  >
                    <Input {...form.register("objective.height")} placeholder="177.8" />
                  </VisitField>
                  <VisitField
                    label="BMI"
                    trailing={<span className="mono text-[10.5px]" style={{ color: "var(--ink-3)" }}>kg/m²</span>}
                    hint="Calculated from weight and height."
                  >
                    <Input
                      {...form.register("objective.bmi")}
                      placeholder="Auto"
                      readOnly
                      className="cursor-not-allowed"
                      style={{ background: "var(--paper-3)" }}
                    />
                  </VisitField>
                </div>
              </VisitSubCard>
            </FieldGroup>

            <SectionDivider />

            <FieldGroup
              eyebrow="Exam"
              title="Physical examination"
              description="Document findings by system. Leave blank for any system not assessed today."
              icon={<Stethoscope className="h-4 w-4" />}
            >
              <div className="grid gap-3 md:grid-cols-2">
                {[
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
                ].map((category) => (
                  <VisitField key={category.key} label={category.label}>
                    <Textarea
                      {...form.register(`objective.examFindings.${category.key}` as any)}
                      rows={3}
                      className="min-h-[80px] resize-none"
                      placeholder={`${category.label} findings…`}
                    />
                  </VisitField>
                ))}
              </div>
            </FieldGroup>

            <SectionDivider />

            <FieldGroup
              eyebrow="Ophthalmic"
              title="Vision"
              description="Visual acuity and related symptoms. Fill in what's relevant."
            >
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {[
                  { key: "visionOd", label: "OD (right)" },
                  { key: "visionOs", label: "OS (left)" },
                  { key: "visionOu", label: "OU (both)" },
                  { key: "visionCorrection", label: "Correction" },
                  { key: "visionBlurry", label: "Blurry vision" },
                  { key: "visionFloaters", label: "Floaters" },
                  { key: "visionPain", label: "Eye pain" },
                  { key: "visionLastExamDate", label: "Last exam date" },
                ].map((f) => (
                  <VisitField key={f.key} label={f.label}>
                    <Input
                      type={f.key === "visionLastExamDate" ? "date" : "text"}
                      {...form.register(`objective.${f.key}` as any)}
                    />
                  </VisitField>
                ))}
              </div>
            </FieldGroup>
          </div>
        );
      case "reviewOfSystems":
        return <ReviewOfSystemsSection form={form} />;
      case "pointOfCare":
        return (
          <div className="space-y-8">
            {/* Diabetes Subsection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Diabetes</h3>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
                {/* Row 1 */}
                {["fastingGlucose", "randomGlucose"].map((field) => (
                  <div key={field} className="space-y-3 min-w-0">
                    <Label className="text-base">{field === "fastingGlucose" ? "Fasting Blood Glucose" : "Random Blood Glucose"}</Label>
                    <Input
                      {...form.register(`pointOfCare.diabetes.${field}` as any)}
                      placeholder="mg/dL"
                    />
                  </div>
                ))}
                <div className="flex gap-3 min-w-0">
                  <div className="flex-1 space-y-3 min-w-0">
                    <Label className="text-base">HbA1c</Label>
                    <Input
                      {...form.register("pointOfCare.diabetes.hbA1cValue")}
                      placeholder="e.g. 7.1%"
                    />
                  </div>
                  <div className="flex-1 space-y-3 min-w-0">
                    <Label className="text-base">Date</Label>
                    <Input
                      type="date"
                      {...form.register("pointOfCare.diabetes.hbA1cDate")}
                      placeholder="mm/dd/yyyy"
                    />
                  </div>
                </div>

                {/* Row 2 */}
                {["homeMonitoring", "averageReadings", "hypoglycemiaEpisodes"].map((field) => (
                  <div key={field} className="space-y-3 min-w-0">
                    <Label className="text-base">
                      {field === "homeMonitoring" ? "Home Glucose Monitoring" : field === "averageReadings" ? "Average Readings" : "Hypoglycemia Episodes"}
                    </Label>
                    {field === "homeMonitoring" ? (
                      <Select
                        value={form.watch("pointOfCare.diabetes.homeMonitoring") || ""}
                        onValueChange={(value) => form.setValue("pointOfCare.diabetes.homeMonitoring", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                          <SelectItem value="Occasionally">Occasionally</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        {...form.register(`pointOfCare.diabetes.${field}` as any)}
                        placeholder={field === "averageReadings" ? "mg/dL" : "Frequency / notes"}
                      />
                    )}
                  </div>
                ))}

                {/* Row 3 */}
                {["hyperglycemiaSymptoms", "footExam", "eyeExamDue"].map((field) => (
                  <div key={field} className="space-y-3 min-w-0">
                    <Label className="text-base">
                      {field === "hyperglycemiaSymptoms" ? "Hyperglycemia Symptoms" : field === "footExam" ? "Foot Exam Performed" : "Eye Exam Due"}
                    </Label>
                    {field === "footExam" || field === "eyeExamDue" ? (
                      <Select
                        value={form.watch(`pointOfCare.diabetes.${field}`) || ""}
                        onValueChange={(value) => form.setValue(`pointOfCare.diabetes.${field}`, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          {field === "footExam" ? (
                            <>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                              <SelectItem value="Deferred">Deferred</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                              <SelectItem value="Scheduled">Scheduled</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        {...form.register(`pointOfCare.diabetes.${field}` as any)}
                        placeholder="Symptoms noted"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* HIV Subsection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">HIV</h3>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
                <div className="space-y-6">
                  <Label className="text-base">HIV Result</Label>
                  <Select
                    value={form.watch("pointOfCare.hiv") || "Unknown"}
                    onValueChange={(value) => form.setValue("pointOfCare.hiv", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Syphilis Subsection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground border-b pb-2">Syphilis</h3>
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 min-w-0">
                <div className="space-y-6">
                  <Label className="text-base">Result</Label>
                  <Select
                    value={form.watch("pointOfCare.syphilis.result") || "Unknown"}
                    onValueChange={(value) => form.setValue("pointOfCare.syphilis.result", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="positive">Positive</SelectItem>
                      <SelectItem value="negative">Negative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-6">
                  <Label className="text-base">Reactivity</Label>
                  <Select
                    value={form.watch("pointOfCare.syphilis.reactivity") || "Unknown"}
                    onValueChange={(value) => form.setValue("pointOfCare.syphilis.reactivity", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Unknown">Unknown</SelectItem>
                      <SelectItem value="reactive">Reactive</SelectItem>
                      <SelectItem value="non-reactive">Non-Reactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        );
      case "medications":
        return (
          <MedicationsSection form={form} />
        );
      case "vaccines":
        return (
          <VaccinesSection form={form} />
        );
      case "familyHistory":
        return (
          <FamilyHistorySection form={form} />
        );
      case "riskFlags":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              {["tobaccoUse", "alcoholUse", "housingStatus"].map((field) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {field === "tobaccoUse" ? "Tobacco Use" : field === "alcoholUse" ? "Alcohol Use" : "Housing Status"}
                  </Label>
                  <Select
                    value={(form.watch(`riskFlags.${field}` as any) as string) || ""}
                    onValueChange={(value) => form.setValue(`riskFlags.${field}` as any, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {field === "tobaccoUse" ? (
                        <>
                          <SelectItem value="Never">Never</SelectItem>
                          <SelectItem value="Former">Former</SelectItem>
                          <SelectItem value="Current">Current</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </>
                      ) : field === "alcoholUse" ? (
                        <>
                          <SelectItem value="Never">Never</SelectItem>
                          <SelectItem value="Rarely">Rarely</SelectItem>
                          <SelectItem value="Social">Social</SelectItem>
                          <SelectItem value="Regular">Regular</SelectItem>
                          <SelectItem value="Heavy">Heavy</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="Stable">Stable</SelectItem>
                          <SelectItem value="Unstable">Unstable</SelectItem>
                          <SelectItem value="Homeless">Homeless</SelectItem>
                          <SelectItem value="Temporary">Temporary</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {["tobaccoAmount", "alcoholFrequency", "occupation"].map((field) => (
                <div key={field} className="space-y-2">
                  <Label>
                    {field === "tobaccoAmount" ? "Amount" : field === "alcoholFrequency" ? "Frequency" : "Occupation"}
                  </Label>
                  <Input
                    {...form.register(`riskFlags.${field}` as any)}
                    placeholder={field === "tobaccoAmount" ? "e.g., 10 cigs / day" : field === "alcoholFrequency" ? "e.g., 2-3 drinks / week" : "e.g., Logistics Manager"}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      case "surgicalHistory":
        return (
          <SurgicalHistorySection form={form} />
        );
      case "pastMedicalHistory":
        return (
          <PastMedicalHistorySection form={form} />
        );
      case "orders":
        return (
          <OrdersSection form={form} userRole={userRole} />
        );
      case "visitActions":
        return <VisitActionsSection form={form} patientBasics={patientBasics} />;
      case "documents":
        return (
          <DocumentsSection form={form} patientId={patientId} visitId={visitIdRemote} />
        );
      case "differentialDiagnoses":
        return <DifferentialDiagnosesSection form={form} />;
      case "assessmentPlan":
        // Hide assessment & plan for nurses
        if (userRole === "nurse") {
          return null;
        }
        return (
          <AssessmentPlanSection form={form} />
        );
      case "coding":
        if (userRole === "nurse") {
          return null;
        }
        return <CodingPreparationSection form={form} patientId={patientId} visitId={visitIdRemote} />;
      // Add other sections similarly...
      default:
        return <div>Section: {section.label}</div>;
    }
  };

  if (!draftLoaded) {
    return <div>Loading...</div>;
  }

  // Section descriptions for contextual guidance
  const sectionDescriptions: Record<string, string> = {
    subjective: "Document the patient's reported symptoms and history of present illness.",
    objective: "Record vitals, physical examination findings, and vision assessment.",
    reviewOfSystems:
      "Capture a structured, body-system review before final assessment and coding.",
    pointOfCare: "Capture point-of-care test results for diabetes, HIV, and syphilis.",
    vaccines: "Review and document vaccine administration records.",
    familyHistory: "Record relevant family medical history and conditions.",
    riskFlags: "Assess social determinants, substance use, and risk factors.",
    surgicalHistory: "Document past surgical procedures and outcomes.",
    pastMedicalHistory: "Record known medical conditions and their current status.",
    documents: "Upload and manage visit-related documents and images.",
    medications: "Review, add, or update the patient's medication list.",
    orders: "Place and manage lab, imaging, and procedure orders.",
    visitActions:
      "Stage prescriptions, labs, imaging, referrals, and next-step tasks without closing the visit.",
    differentialDiagnoses:
      "Track AI-supported and manual differentials before finalizing the assessment.",
    assessmentPlan: "Formulate diagnoses, treatment plans, and follow-up instructions.",
    coding:
      "Prepare ICD-10, CPT, co-sign, and sign-off details before the dedicated close-out step.",
  };

  return (
    <div
      className="flex flex-col min-h-full pb-0"
      style={{ background: "var(--paper)" }}
    >
      {hasAiDraftSuggestions && (
        <div
          className="px-4 py-2.5 text-[13px]"
          style={{
            background: "var(--warn-soft)",
            borderBottom: "1px solid var(--line)",
            color: "oklch(0.35 0.1 70)",
          }}
        >
          AI draft suggestions were applied. Manually edited fields stay locked until you change them yourself.
        </div>
      )}

      {/* Visit top bar: back + patient ribbon-lite + status */}
      <div
        className="flex items-center justify-between gap-3 px-4 md:px-6 py-3"
        style={{
          background: "var(--paper)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link href={`/patients/${patientId}`}>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ color: "var(--ink-2)", border: "1px solid var(--line)", background: "var(--card)" }}
              aria-label="Back to patient"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Link>
          <Avatar name={patientBasics.fullName} size={34} />
          <div className="min-w-0 leading-tight">
            <div className="flex flex-wrap items-baseline gap-2">
              <span
                className="serif nowrap"
                style={{ fontSize: 17, letterSpacing: "-0.015em", color: "var(--ink)" }}
              >
                {patientBasics.fullName}
              </span>
              {isRecording && (
                <ClearingPill tone="critical" dot>
                  Recording
                </ClearingPill>
              )}
            </div>
            <div className="mono text-[11px]" style={{ color: "var(--ink-3)" }}>
              DOB {patientBasics.dob || "N/A"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {previousVisits.length > 0 && (
            <ClearingBtn
              kind="ghost"
              size="sm"
              icon={<Clock className="h-3.5 w-3.5" />}
              onClick={() => setShowPreviousVisitsDialog(true)}
              type="button"
            >
              Previous visits
            </ClearingBtn>
          )}
          {visitAppointmentType?.toLowerCase() === "virtual" && visitTwilioRoomName && existingVisitId && (
            <ClearingBtn
              kind="accent"
              size="sm"
              icon={<Video className="h-3.5 w-3.5" />}
              onClick={() => router.push(`/visit/${existingVisitId}/call`)}
            >
              Join call
            </ClearingBtn>
          )}
          <OfflineSyncBadge
            isOnline={isOnline}
            pendingCount={pendingCount}
            isSyncing={isSyncing}
          />
        </div>
      </div>

      {/* Body: left section stepper + main canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left stepper rail */}
        <aside
          className="hidden lg:flex flex-col w-[220px] shrink-0 overflow-y-auto scroll"
          style={{
            background: "var(--paper-2)",
            borderRight: "1px solid var(--line)",
          }}
        >
          {medicalPanelOpen && medicalPanelSection && (
            <MedicalInfoPanel
              patientBasics={patientBasics}
              sectionId={medicalPanelSection}
              onClose={() => {
                setMedicalPanelOpen(false);
                setMedicalPanelSection(null);
              }}
            />
          )}
          {!hideAICapture && (
            <div
              className="px-3 py-3"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              <AICapturePanel
                patientId={patientId}
                onTranscriptReady={handleTranscriptReady}
                onParseReady={handleParseReady}
                onLiveState={setLiveCaptureState}
                hideLiveDraftBubble
              />
            </div>
          )}
          <div className="p-3 flex-1">
            <SectionStepper
              currentSection={currentSection}
              reviewedSections={reviewedSections}
              onSectionClick={handleSectionChange}
              userRole={userRole}
            />
          </div>
        </aside>

        {/* Main canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div
            className="flex-1 overflow-y-auto scroll"
            style={{ background: "var(--paper)" }}
          >
            <div className="mx-auto w-full max-w-3xl px-4 md:px-8 py-8 flex flex-col gap-6">
              {/* Section header */}
              <div>
                <div
                  className="text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
                >
                  Step {currentSectionIndex + 1} of {roleSections.length}
                </div>
                <h1
                  className="serif mt-1.5"
                  style={{
                    margin: 0,
                    fontSize: "clamp(28px, 3vw, 32px)",
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  {roleSections.find((s) => s.id === currentSection)?.label}
                </h1>
                {sectionDescriptions[currentSection] && (
                  <p
                    className="mt-2 max-w-xl text-[13.5px]"
                    style={{ color: "var(--ink-2)" }}
                  >
                    {sectionDescriptions[currentSection]}
                  </p>
                )}
              </div>

              {/* Form canvas */}
              <ClearingCardWrap pad={24}>{renderSection()}</ClearingCardWrap>

              {/* Prev / next navigation */}
              <div className="flex items-center justify-between gap-2">
                <ClearingBtn
                  kind="ghost"
                  icon={<ChevronLeft className="h-4 w-4" />}
                  onClick={goToPrev}
                  disabled={!canGoPrev}
                >
                  {canGoPrev ? roleSections[currentSectionIndex - 1]?.label : "Previous"}
                </ClearingBtn>
                {canGoNext ? (
                  <ClearingBtn
                    kind="accent"
                    iconRight={<ChevronRight className="h-4 w-4" />}
                    onClick={goToNext}
                  >
                    {roleSections[currentSectionIndex + 1]?.label}
                  </ClearingBtn>
                ) : (
                  <ClearingBtn
                    kind="accent"
                    onClick={handleFinalize}
                    disabled={isSaving || !allSectionsReviewed || !isOnline}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Complete visit"
                    )}
                  </ClearingBtn>
                )}
              </div>
            </div>
          </div>

          {/* Mobile stepper strip */}
          <div
            className="lg:hidden overflow-x-auto scroll"
            style={{
              borderTop: "1px solid var(--line)",
              background: "var(--paper-2)",
            }}
          >
            <SectionStepper
              currentSection={currentSection}
              reviewedSections={reviewedSections}
              onSectionClick={handleSectionChange}
              userRole={userRole}
              orientation="horizontal"
              className="px-3 py-2"
            />
          </div>
        </div>

        {/* Right: live transcript (desktop only) */}
        {!hideAICapture && (
          <div className="hidden lg:flex">
            <TranscriptPanel history={transcriptHistory} live={liveCaptureState} />
          </div>
        )}
      </div>

      {/* Mobile: floating toggle for sidebar tools (AI capture + medical info) */}
      {!hideAICapture && (
        <Button
          variant="default"
          size="icon"
          className="fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg lg:hidden"
          onClick={() => setMobileSidebarOpen(true)}
        >
          <Mic className="h-5 w-5" />
          <span className="sr-only">Open tools panel</span>
        </Button>
      )}

      {/* Mobile: sidebar tools dialog */}
      <Dialog open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-y-auto lg:hidden">
          <DialogHeader>
            <DialogTitle>Visit Tools</DialogTitle>
            <DialogDescription>AI capture and medical info panels</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {medicalPanelOpen && medicalPanelSection && (
              <MedicalInfoPanel
                patientBasics={patientBasics}
                sectionId={medicalPanelSection}
                onClose={() => {
                  setMedicalPanelOpen(false);
                  setMedicalPanelSection(null);
                }}
              />
            )}
            {!hideAICapture && (
              <AICapturePanel
                patientId={patientId}
                onTranscriptReady={handleTranscriptReady}
                onParseReady={handleParseReady}
                onLiveState={setLiveCaptureState}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Post-Save Modal */}
      <Dialog open={showPostSaveModal} onOpenChange={setShowPostSaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Visit Saved Successfully</DialogTitle>
            <DialogDescription>
              What would you like to do next?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => handlePostSaveAction("view")}
              disabled={isProcessingAction}
            >
              <User className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">View Patient</div>
                <div className="text-sm text-muted-foreground">
                  Go to patient profile
                </div>
              </div>
            </Button>
            {userRole !== "doctor" && (
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4"
                onClick={() => handlePostSaveAction("waiting")}
                disabled={isProcessingAction}
              >
                <Clock className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Send to Waiting Room</div>
                  <div className="text-sm text-muted-foreground">
                    Send patient to waiting room queue
                  </div>
                </div>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => handlePostSaveAction("sign")}
              disabled={isProcessingAction}
            >
              <FileSignature className="h-5 w-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">{userRole === "nurse" ? "Hand Off Note" : "Sign the Note"}</div>
                <div className="text-sm text-muted-foreground">
                  {userRole === "nurse"
                    ? "Hand this note off for physician completion"
                    : "Mark note as signed and unassign patient"}
                </div>
              </div>
            </Button>
          </div>
          {isProcessingAction && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showPreviousVisitsDialog} onOpenChange={setShowPreviousVisitsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Previous Visit History</DialogTitle>
            <DialogDescription>
              Review recent visits without leaving the active note.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
            {previousVisits.map((visit) => {
              const noteData =
                visit.note && typeof visit.note === "object"
                  ? (visit.note as Record<string, any>)
                  : null;

              return (
                <div key={visit.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {new Date(visit.createdAt).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {visit.status || "Unknown status"}
                        {visit.appointmentType ? ` • ${visit.appointmentType}` : ""}
                        {visit.priority ? ` • ${visit.priority}` : ""}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        window.open(
                          `/patients/${patientId}/visit-history/${visit.id}`,
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                    >
                      Open Full Details
                    </Button>
                  </div>
                  {noteData && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Subjective
                        </div>
                        <p className="text-sm">
                          {noteData.subjective?.chiefComplaint ||
                            noteData.subjective?.hpi ||
                            "No subjective summary"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Assessment / Plan
                        </div>
                        <p className="text-sm">
                          {Array.isArray(noteData.assessmentPlan) &&
                          noteData.assessmentPlan[0]?.assessment
                            ? noteData.assessmentPlan[0].assessment
                            : "No assessment summary"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// Medications Section Component - matches patient medications page structure
function MedicationsSection({ form }: { form: any }) {
  const medicationsValue = form.watch("medications");
  // Handle migration from old format to new format
  const medications = React.useMemo(() => {
    if (Array.isArray(medicationsValue)) {
      // Filter out any old format medications (with 'name' instead of 'brandName'/'genericName')
      return medicationsValue.map((med: any) => {
        // If it's old format (has 'name' field), try to migrate
        if (med.name && !med.brandName) {
          return {
            id: med.id || undefined,
            brandName: med.name || "",
            strength: "",
            form: "",
            dosage: med.dosage || "",
            frequency: "",
            status: "Active" as const,
            notes: med.sideEffectsNotes || "",
            createdAt: med.createdAt || undefined,
          };
        }
        // Already new format, ensure all fields are present
        return {
          id: med.id || undefined,
          brandName: med.brandName || "",
          strength: med.strength || "",
          form: med.form || "",
          dosage: med.dosage || "",
          frequency: med.frequency || "",
          status: med.status || ("Active" as const),
          notes: med.notes || "",
          createdAt: med.createdAt || undefined,
        };
      });
    }
    return [];
  }, [medicationsValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    brandName: "",
    strength: "",
    form: "",
    dosage: "",
    frequency: "",
    status: "Active" as "Active" | "Inactive" | "Discontinued",
    notes: "",
  });

  // Use refs to track latest values for cleanup
  const editingIndexRef = React.useRef<number | null>(null);
  const editDataRef = React.useRef(editData);

  React.useEffect(() => {
    editingIndexRef.current = editingIndex;
    editDataRef.current = editData;
  }, [editingIndex, editData]);

  // Auto-save pending edits when component unmounts (section change)
  React.useEffect(() => {
    return () => {
      // Save any pending edits when leaving the medications section
      if (editingIndexRef.current !== null && editDataRef.current.brandName?.trim()) {
        const current = getMedicationsArray();
        const existingMed = current[editingIndexRef.current];
        if (existingMed) {
          current[editingIndexRef.current] = {
            ...existingMed,
            ...editDataRef.current,
          };
          form.setValue("medications", current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to ensure medications is always an array with proper structure
  const getMedicationsArray = () => {
    const value = form.getValues("medications");
    if (Array.isArray(value)) {
      return value.map((med: any) => ({
        id: med.id || undefined,
        brandName: med.brandName || "",
        strength: med.strength || "",
        form: med.form || "",
        dosage: med.dosage || "",
        frequency: med.frequency || "",
        status: med.status || ("Active" as const),
        notes: med.notes || "",
        createdAt: med.createdAt || undefined,
      }));
    }
    return [];
  };

  const getMedicationDisplayName = (med: any) => {
    return med.brandName || "Unnamed Medication";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return { variant: "default" as const, label: status, className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500" };
      case "Inactive":
        return { variant: "secondary" as const, label: status };
      case "Discontinued":
        return { variant: "destructive" as const, label: status };
      default:
        return { variant: "secondary" as const, label: status };
    }
  };

  const handleAdd = () => {
    const newMedication = {
      brandName: "",
      strength: "",
      form: "",
      dosage: "",
      frequency: "",
      status: "Active" as const,
      notes: "",
    };
    const current = getMedicationsArray();
    form.setValue("medications", [...current, newMedication]);
    setEditingIndex(current.length);
    setEditData(newMedication);
  };

  const handleEdit = (index: number) => {
    const med = medications[index];
    if (med) {
      setEditingIndex(index);
      setEditData({
        brandName: med.brandName || "",
        strength: med.strength || "",
        form: med.form || "",
        dosage: med.dosage || "",
        frequency: med.frequency || "",
        status: med.status || ("Active" as const),
        notes: med.notes || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getMedicationsArray();
    const existingMed = current[index];
    current[index] = {
      ...existingMed,
      ...editData,
    };
    form.setValue("medications", current);
    setEditingIndex(null);
    setEditData({
      brandName: "",
      strength: "",
      form: "",
      dosage: "",
      frequency: "",
      status: "Active",
      notes: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      brandName: "",
      strength: "",
      form: "",
      dosage: "",
      frequency: "",
      status: "Active",
      notes: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getMedicationsArray();
    form.setValue("medications", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {medications.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No medications added yet
        </div>
      ) : (
        <div className="space-y-6">
          {medications.map((med, index) => (
            <div
              key={med.id || index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Medication Name</Label>
                    <Input
                      value={editData.brandName}
                      onChange={(e) => setEditData({ ...editData, brandName: e.target.value })}
                      placeholder="e.g., Amoxicillin 400 mg/5 mL"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Strength</Label>
                      <Input
                        value={editData.strength}
                        onChange={(e) => setEditData({ ...editData, strength: e.target.value })}
                        placeholder="e.g., 500mg"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Form</Label>
                      <Input
                        value={editData.form}
                        onChange={(e) => setEditData({ ...editData, form: e.target.value })}
                        placeholder="e.g., Tablet, Capsule"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Dosage</Label>
                      <Input
                        value={editData.dosage}
                        onChange={(e) => setEditData({ ...editData, dosage: e.target.value })}
                        placeholder="e.g., 1 tablet"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Input
                        value={editData.frequency}
                        onChange={(e) => setEditData({ ...editData, frequency: e.target.value })}
                        placeholder="e.g., Twice daily"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={editData.status}
                      onValueChange={(value) => setEditData({ ...editData, status: value as "Active" | "Inactive" | "Discontinued" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Discontinued">Discontinued</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={editData.notes}
                      onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      placeholder="Additional notes or linked diagnosis..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.brandName?.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{getMedicationDisplayName(med)}</div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge
                          variant={getStatusBadge(med.status || "Active").variant}
                          className={getStatusBadge(med.status || "Active").className || ""}
                        >
                          {getStatusBadge(med.status || "Active").label}
                        </Badge>
                      </div>
                      {(med.strength || med.form) && (
                        <div className="text-sm text-muted-foreground mt-2">
                          <span className="text-xs text-muted-foreground">Strength & Form: </span>
                          {[med.strength, med.form].filter(Boolean).join(" • ") || "—"}
                        </div>
                      )}
                      {(med.dosage || med.frequency) && (
                        <div className="text-sm text-muted-foreground">
                          <span className="text-xs text-muted-foreground">Dosage & Frequency: </span>
                          {[med.dosage, med.frequency].filter(Boolean).join(" • ") || "—"}
                        </div>
                      )}
                      {med.notes && (
                        <div className="text-sm text-muted-foreground mt-2">
                          <span className="text-xs text-muted-foreground">Notes: </span>
                          {med.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Medication
      </Button>
    </div>
  );
}

// Vaccines Section Component
function VaccinesSection({ form }: { form: any }) {
  const vaccinesValue = form.watch("vaccines");
  // Ensure vaccines is always an array
  const vaccines = React.useMemo(() => {
    if (Array.isArray(vaccinesValue)) {
      return vaccinesValue;
    }
    return [];
  }, [vaccinesValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    name: "",
    date: "",
    dose: "",
    site: "",
    route: "",
    lotNumber: "",
    manufacturer: "",
  });

  // Helper to ensure vaccines is always an array
  const getVaccinesArray = () => {
    const value = form.getValues("vaccines");
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  };

  const handleAdd = () => {
    const newVaccine = {
      name: "",
      date: "",
      dose: "",
      site: "",
      route: "",
      lotNumber: "",
      manufacturer: "",
    };
    const current = getVaccinesArray();
    form.setValue("vaccines", [...current, newVaccine]);
    setEditingIndex(current.length);
    setEditData(newVaccine);
  };

  const handleEdit = (index: number) => {
    const vaccine = vaccines[index];
    if (vaccine) {
      setEditingIndex(index);
      setEditData({
        name: vaccine.name || "",
        date: vaccine.date || "",
        dose: vaccine.dose || "",
        site: vaccine.site || "",
        route: vaccine.route || "",
        lotNumber: vaccine.lotNumber || "",
        manufacturer: vaccine.manufacturer || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getVaccinesArray();
    current[index] = {
      ...current[index],
      ...editData,
    };
    form.setValue("vaccines", current);
    setEditingIndex(null);
    setEditData({
      name: "",
      date: "",
      dose: "",
      site: "",
      route: "",
      lotNumber: "",
      manufacturer: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      name: "",
      date: "",
      dose: "",
      site: "",
      route: "",
      lotNumber: "",
      manufacturer: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getVaccinesArray();
    form.setValue("vaccines", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {vaccines.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No vaccines added yet
        </div>
      ) : (
        <div className="space-y-6">
          {vaccines.map((vaccine, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Vaccine</Label>
                    <Input
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      placeholder="Search vaccine (e.g. Tdap)"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={editData.date}
                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        placeholder="mm/dd/yyyy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dose #</Label>
                      <Select
                        value={editData.dose}
                        onValueChange={(value) => setEditData({ ...editData, dose: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select dose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="Booster">Booster</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Select
                      value={editData.site}
                      onValueChange={(value) => setEditData({ ...editData, site: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Left Deltoid">Left Deltoid</SelectItem>
                        <SelectItem value="Right Deltoid">Right Deltoid</SelectItem>
                        <SelectItem value="Left Thigh">Left Thigh</SelectItem>
                        <SelectItem value="Right Thigh">Right Thigh</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Route</Label>
                      <Select
                        value={editData.route}
                        onValueChange={(value) => setEditData({ ...editData, route: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select route" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Intramuscular (IM)">Intramuscular (IM)</SelectItem>
                          <SelectItem value="Subcutaneous (SC)">Subcutaneous (SC)</SelectItem>
                          <SelectItem value="Intranasal">Intranasal</SelectItem>
                          <SelectItem value="Oral">Oral</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Lot Number</Label>
                      <Input
                        value={editData.lotNumber}
                        onChange={(e) => setEditData({ ...editData, lotNumber: e.target.value })}
                        placeholder="Lot #"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Manufacturer</Label>
                      <Select
                        value={editData.manufacturer}
                        onValueChange={(value) => setEditData({ ...editData, manufacturer: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Manufacturer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pfizer">Pfizer</SelectItem>
                          <SelectItem value="Moderna">Moderna</SelectItem>
                          <SelectItem value="Johnson & Johnson">Johnson & Johnson</SelectItem>
                          <SelectItem value="Novavax">Novavax</SelectItem>
                          <SelectItem value="GSK">GSK</SelectItem>
                          <SelectItem value="Sanofi">Sanofi</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.name.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{vaccine.name || "Unnamed Vaccine"}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {vaccine.date && <div>Date: {vaccine.date}</div>}
                        {vaccine.dose && <div>Dose: {vaccine.dose}</div>}
                        {vaccine.site && <div>Site: {vaccine.site}</div>}
                        {vaccine.route && <div>Route: {vaccine.route}</div>}
                        {vaccine.lotNumber && <div>Lot #: {vaccine.lotNumber}</div>}
                        {vaccine.manufacturer && <div>Manufacturer: {vaccine.manufacturer}</div>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Vaccine
      </Button>
    </div>
  );
}

// Family History Section Component
function FamilyHistorySection({ form }: { form: any }) {
  const familyHistoryValue = form.watch("familyHistory");
  // Ensure familyHistory is always an array
  const familyHistory = React.useMemo(() => {
    if (Array.isArray(familyHistoryValue)) {
      return familyHistoryValue;
    }
    return [];
  }, [familyHistoryValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    relationship: "",
    status: "",
    conditions: "",
  });

  // Use refs to track latest values for cleanup
  const editingIndexRef = React.useRef<number | null>(null);
  const editDataRef = React.useRef(editData);

  React.useEffect(() => {
    editingIndexRef.current = editingIndex;
    editDataRef.current = editData;
  }, [editingIndex, editData]);

  // Auto-save pending edits when component unmounts (section change)
  React.useEffect(() => {
    return () => {
      // Save any pending edits when leaving the family history section
      if (editingIndexRef.current !== null && editDataRef.current.relationship?.trim()) {
        const current = getFamilyHistoryArray();
        const existingEntry = current[editingIndexRef.current];
        if (existingEntry) {
          current[editingIndexRef.current] = {
            ...existingEntry,
            ...editDataRef.current,
          };
          form.setValue("familyHistory", current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to ensure familyHistory is always an array
  const getFamilyHistoryArray = () => {
    const value = form.getValues("familyHistory");
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  };

  const handleAdd = () => {
    const newEntry = {
      relationship: "",
      status: "",
      conditions: "",
    };
    const current = getFamilyHistoryArray();
    form.setValue("familyHistory", [...current, newEntry]);
    setEditingIndex(current.length);
    setEditData(newEntry);
  };

  const handleEdit = (index: number) => {
    const entry = familyHistory[index];
    if (entry) {
      setEditingIndex(index);
      setEditData({
        relationship: entry.relationship || "",
        status: entry.status || "",
        conditions: entry.conditions || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getFamilyHistoryArray();
    current[index] = {
      ...current[index],
      ...editData,
    };
    form.setValue("familyHistory", current);
    setEditingIndex(null);
    setEditData({
      relationship: "",
      status: "",
      conditions: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      relationship: "",
      status: "",
      conditions: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getFamilyHistoryArray();
    form.setValue("familyHistory", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {familyHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No family history entries added yet
        </div>
      ) : (
        <div className="space-y-6">
          {familyHistory.map((entry, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Relationship</Label>
                      <Select
                        value={editData.relationship}
                        onValueChange={(value) => setEditData({ ...editData, relationship: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Mother">Mother</SelectItem>
                          <SelectItem value="Father">Father</SelectItem>
                          <SelectItem value="Sister">Sister</SelectItem>
                          <SelectItem value="Brother">Brother</SelectItem>
                          <SelectItem value="Maternal Grandmother">Maternal Grandmother</SelectItem>
                          <SelectItem value="Maternal Grandfather">Maternal Grandfather</SelectItem>
                          <SelectItem value="Paternal Grandmother">Paternal Grandmother</SelectItem>
                          <SelectItem value="Paternal Grandfather">Paternal Grandfather</SelectItem>
                          <SelectItem value="Aunt">Aunt</SelectItem>
                          <SelectItem value="Uncle">Uncle</SelectItem>
                          <SelectItem value="Cousin">Cousin</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData({ ...editData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Living">Living</SelectItem>
                          <SelectItem value="Deceased">Deceased</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Known Conditions</Label>
                    <Input
                      value={editData.conditions}
                      onChange={(e) => setEditData({ ...editData, conditions: e.target.value })}
                      placeholder="Search other conditions..."
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.relationship.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">
                        {entry.relationship || "Unnamed Relationship"}
                        {entry.status && (
                          <span className="text-muted-foreground ml-2">({entry.status})</span>
                        )}
                      </div>
                      {entry.conditions && (
                        <div className="text-sm text-muted-foreground">
                          Conditions: {entry.conditions}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Family History Entry
      </Button>
    </div>
  );
}

// Surgical History Section Component
function SurgicalHistorySection({ form }: { form: any }) {
  const surgicalHistoryValue = form.watch("surgicalHistory");
  // Ensure surgicalHistory is always an array
  const surgicalHistory = React.useMemo(() => {
    if (Array.isArray(surgicalHistoryValue)) {
      return surgicalHistoryValue;
    }
    return [];
  }, [surgicalHistoryValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    procedure: "",
    date: "",
    site: "",
    surgeon: "",
    outcome: "",
    source: "",
  });

  // Use refs to track latest values for cleanup
  const editingIndexRef = React.useRef<number | null>(null);
  const editDataRef = React.useRef(editData);

  React.useEffect(() => {
    editingIndexRef.current = editingIndex;
    editDataRef.current = editData;
  }, [editingIndex, editData]);

  // Auto-save pending edits when component unmounts (section change)
  React.useEffect(() => {
    return () => {
      // Save any pending edits when leaving the surgical history section
      if (editingIndexRef.current !== null && editDataRef.current.procedure?.trim()) {
        const current = getSurgicalHistoryArray();
        const existingEntry = current[editingIndexRef.current];
        if (existingEntry) {
          current[editingIndexRef.current] = {
            ...existingEntry,
            ...editDataRef.current,
          };
          form.setValue("surgicalHistory", current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to ensure surgicalHistory is always an array
  const getSurgicalHistoryArray = () => {
    const value = form.getValues("surgicalHistory");
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  };

  const handleAdd = () => {
    const newEntry = {
      procedure: "",
      date: "",
      site: "",
      surgeon: "",
      outcome: "",
      source: "",
    };
    const current = getSurgicalHistoryArray();
    form.setValue("surgicalHistory", [...current, newEntry]);
    setEditingIndex(current.length);
    setEditData(newEntry);
  };

  const handleEdit = (index: number) => {
    const entry = surgicalHistory[index];
    if (entry) {
      setEditingIndex(index);
      setEditData({
        procedure: entry.procedure || "",
        date: entry.date || "",
        site: entry.site || "",
        surgeon: entry.surgeon || "",
        outcome: entry.outcome || "",
        source: entry.source || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getSurgicalHistoryArray();
    current[index] = {
      ...current[index],
      ...editData,
    };
    form.setValue("surgicalHistory", current);
    setEditingIndex(null);
    setEditData({
      procedure: "",
      date: "",
      site: "",
      surgeon: "",
      outcome: "",
      source: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      procedure: "",
      date: "",
      site: "",
      surgeon: "",
      outcome: "",
      source: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getSurgicalHistoryArray();
    form.setValue("surgicalHistory", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {surgicalHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No surgical history entries added yet
        </div>
      ) : (
        <div className="space-y-6">
          {surgicalHistory.map((entry, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Procedure</Label>
                      <Input
                        value={editData.procedure}
                        onChange={(e) => setEditData({ ...editData, procedure: e.target.value })}
                        placeholder="e.g. Appendectomy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date / Year</Label>
                      <Input
                        value={editData.date}
                        onChange={(e) => setEditData({ ...editData, date: e.target.value })}
                        placeholder="YYYY"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Site</Label>
                      <Input
                        value={editData.site}
                        onChange={(e) => setEditData({ ...editData, site: e.target.value })}
                        placeholder="e.g., Left Knee"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Surgeon</Label>
                      <Input
                        value={editData.surgeon}
                        onChange={(e) => setEditData({ ...editData, surgeon: e.target.value })}
                        placeholder="e.g., Dr. R. Miller"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Outcome</Label>
                      <Select
                        value={editData.outcome}
                        onValueChange={(value) => setEditData({ ...editData, outcome: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="No Issues">No Issues</SelectItem>
                          <SelectItem value="Complications">Complications</SelectItem>
                          <SelectItem value="Recovery Ongoing">Recovery Ongoing</SelectItem>
                          <SelectItem value="Full Recovery">Full Recovery</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select
                        value={editData.source}
                        onValueChange={(value) => setEditData({ ...editData, source: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Patient Reported">Patient Reported</SelectItem>
                          <SelectItem value="Medical Records">Medical Records</SelectItem>
                          <SelectItem value="Provider Verified">Provider Verified</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.procedure.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{entry.procedure || "Unnamed Procedure"}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {entry.date && <div>Date: {entry.date}</div>}
                        {entry.site && <div>Site: {entry.site}</div>}
                        {entry.surgeon && <div>Surgeon: {entry.surgeon}</div>}
                        {entry.outcome && <div>Outcome: {entry.outcome}</div>}
                        {entry.source && <div>Source: {entry.source}</div>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Surgical History Entry
      </Button>
    </div>
  );
}

type Icd10Option = {
  code: string;
  label: string;
};

function normalizeIcd10Options(payload: unknown): Icd10Option[] {
  if (!Array.isArray(payload)) return [];

  const codes = Array.isArray(payload[1]) ? (payload[1] as string[]) : [];
  if (codes.length === 0) return [];

  const displayTuples = Array.isArray(payload[3]) ? (payload[3] as string[][]) : [];

  return codes.map((code, index) => {
    const tuple = displayTuples[index];
    const name = Array.isArray(tuple) && tuple.length > 1 ? tuple[1] : undefined;
    return {
      code,
      label: name ? `${code} — ${name}` : code,
    };
  });
}

// Past Medical History Section Component
function PastMedicalHistorySection({ form }: { form: any }) {
  const pastMedicalHistoryValue = form.watch("pastMedicalHistory");
  // Ensure pastMedicalHistory is always an array
  const pastMedicalHistory = React.useMemo(() => {
    if (Array.isArray(pastMedicalHistoryValue)) {
      return pastMedicalHistoryValue;
    }
    return [];
  }, [pastMedicalHistoryValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    condition: "",
    status: "",
    diagnosedDate: "",
    impact: "",
    icd10: "",
    source: "",
  });
  const [icd10Options, setIcd10Options] = React.useState<Icd10Option[]>([]);
  const [isLoadingIcd10, setIsLoadingIcd10] = React.useState(false);
  const [isIcd10DropdownOpen, setIsIcd10DropdownOpen] = React.useState(false);
  const icd10DropdownRef = React.useRef<HTMLDivElement | null>(null);

  // Use refs to track latest values for cleanup
  const editingIndexRef = React.useRef<number | null>(null);
  const editDataRef = React.useRef(editData);

  React.useEffect(() => {
    editingIndexRef.current = editingIndex;
    editDataRef.current = editData;
  }, [editingIndex, editData]);

  React.useEffect(() => {
    if (editingIndex === null) {
      setIcd10Options([]);
      setIsLoadingIcd10(false);
      return;
    }

    const searchTerm = editData.icd10.trim() || editData.condition.trim();
    if (searchTerm.length < 2) {
      setIcd10Options([]);
      setIsLoadingIcd10(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoadingIcd10(true);
        const response = await fetch(
          `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(searchTerm)}&maxList=12`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(`ICD-10 search failed with status ${response.status}`);
        }

        const payload = (await response.json()) as unknown;
        const normalized = normalizeIcd10Options(payload);
        const currentCode = editData.icd10.trim().toUpperCase();

        const withCurrentCode =
          currentCode && !normalized.some((option) => option.code.toUpperCase() === currentCode)
            ? [{ code: currentCode, label: `${currentCode} - current entry` }, ...normalized]
            : normalized;

        setIcd10Options(withCurrentCode);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("Unable to load ICD-10 options", error);
          setIcd10Options([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingIcd10(false);
        }
      }
    }, 400);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [editData.condition, editData.icd10, editingIndex]);

  React.useEffect(() => {
    if (!isIcd10DropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!icd10DropdownRef.current) return;
      if (!icd10DropdownRef.current.contains(event.target as Node)) {
        setIsIcd10DropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isIcd10DropdownOpen]);

  // Auto-save pending edits when component unmounts (section change)
  React.useEffect(() => {
    return () => {
      // Save any pending edits when leaving the past medical history section
      if (editingIndexRef.current !== null && editDataRef.current.condition?.trim()) {
        const current = getPastMedicalHistoryArray();
        const existingEntry = current[editingIndexRef.current];
        if (existingEntry) {
          current[editingIndexRef.current] = {
            ...existingEntry,
            ...editDataRef.current,
          };
          form.setValue("pastMedicalHistory", current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to ensure pastMedicalHistory is always an array
  const getPastMedicalHistoryArray = () => {
    const value = form.getValues("pastMedicalHistory");
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  };

  const handleAdd = () => {
    const newEntry = {
      condition: "",
      status: "",
      diagnosedDate: "",
      impact: "",
      icd10: "",
      source: "",
    };
    const current = getPastMedicalHistoryArray();
    form.setValue("pastMedicalHistory", [...current, newEntry]);
    setEditingIndex(current.length);
    setEditData(newEntry);
  };

  const handleEdit = (index: number) => {
    const entry = pastMedicalHistory[index];
    if (entry) {
      setEditingIndex(index);
      setEditData({
        condition: entry.condition || "",
        status: entry.status || "",
        diagnosedDate: entry.diagnosedDate || "",
        impact: entry.impact || "",
        icd10: entry.icd10 || "",
        source: entry.source || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getPastMedicalHistoryArray();
    current[index] = {
      ...current[index],
      ...editData,
    };
    form.setValue("pastMedicalHistory", current);
    setEditingIndex(null);
    setEditData({
      condition: "",
      status: "",
      diagnosedDate: "",
      impact: "",
      icd10: "",
      source: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      condition: "",
      status: "",
      diagnosedDate: "",
      impact: "",
      icd10: "",
      source: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getPastMedicalHistoryArray();
    form.setValue("pastMedicalHistory", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {pastMedicalHistory.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No past medical history entries added yet
        </div>
      ) : (
        <div className="space-y-6">
          {pastMedicalHistory.map((entry, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Condition</Label>
                      <Input
                        value={editData.condition}
                        onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                        placeholder="e.g., Type 2 Diabetes Mellitus"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData({ ...editData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Resolved">Resolved</SelectItem>
                          <SelectItem value="Chronic">Chronic</SelectItem>
                          <SelectItem value="Controlled">Controlled</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Date Diagnosed</Label>
                      <Input
                        type="date"
                        value={editData.diagnosedDate}
                        onChange={(e) => setEditData({ ...editData, diagnosedDate: e.target.value })}
                        placeholder="mm/dd/yyyy"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Impact</Label>
                      <Select
                        value={editData.impact}
                        onValueChange={(value) => setEditData({ ...editData, impact: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Low">Low</SelectItem>
                          <SelectItem value="Moderate">Moderate</SelectItem>
                          <SelectItem value="High">High</SelectItem>
                          <SelectItem value="Critical">Critical</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>ICD-10 Code</Label>
                      <div className="relative" ref={icd10DropdownRef}>
                        <Input
                          value={editData.icd10}
                          onFocus={() => setIsIcd10DropdownOpen(true)}
                          onChange={(e) => {
                            setEditData({ ...editData, icd10: e.target.value.toUpperCase() });
                            setIsIcd10DropdownOpen(true);
                          }}
                          placeholder="e.g., E11.9"
                          className="pr-8"
                        />
                        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        {isIcd10DropdownOpen && (isLoadingIcd10 || icd10Options.length > 0) && (
                          <div className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                            {isLoadingIcd10 ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                Loading ICD-10 options...
                              </div>
                            ) : (
                              icd10Options.map((option) => (
                                <button
                                  key={option.code}
                                  type="button"
                                  onClick={() => {
                                    setEditData({ ...editData, icd10: option.code });
                                    setIsIcd10DropdownOpen(false);
                                  }}
                                  className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                                >
                                  {option.label}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {isLoadingIcd10
                          ? "Loading ICD-10 options..."
                          : "Search and select from ICD-10 options."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select
                        value={editData.source}
                        onValueChange={(value) => setEditData({ ...editData, source: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Patient Reported">Patient Reported</SelectItem>
                          <SelectItem value="Medical Records">Medical Records</SelectItem>
                          <SelectItem value="Clinician">Clinician</SelectItem>
                          <SelectItem value="Provider Verified">Provider Verified</SelectItem>
                          <SelectItem value="Unknown">Unknown</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.condition.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{entry.condition || "Unnamed Condition"}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {entry.status && <div>Status: {entry.status}</div>}
                        {entry.diagnosedDate && <div>Diagnosed: {entry.diagnosedDate}</div>}
                        {entry.icd10 && <div>ICD-10: {entry.icd10}</div>}
                        {entry.impact && <div>Impact: {entry.impact}</div>}
                        {entry.source && <div>Source: {entry.source}</div>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Past Medical History Entry
      </Button>
    </div>
  );
}

// Orders Section Component
function OrdersSection({ form, userRole }: { form: any; userRole?: string }) {
  const ordersValue = form.watch("orders");
  // Ensure orders is always an array
  const orders = React.useMemo(() => {
    if (Array.isArray(ordersValue)) {
      return ordersValue;
    }
    return [];
  }, [ordersValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    type: "",
    priority: "",
    details: "",
    status: "",
    dateOrdered: "",
  });

  // Use refs to track latest values for cleanup
  const editingIndexRef = React.useRef<number | null>(null);
  const editDataRef = React.useRef(editData);

  React.useEffect(() => {
    editingIndexRef.current = editingIndex;
    editDataRef.current = editData;
  }, [editingIndex, editData]);

  // Auto-save pending edits when component unmounts (section change)
  React.useEffect(() => {
    return () => {
      // Save any pending edits when leaving the orders section
      if (editingIndexRef.current !== null && (editDataRef.current.type?.trim() || editDataRef.current.details?.trim())) {
        const current = getOrdersArray();
        const existingEntry = current[editingIndexRef.current];
        if (existingEntry) {
          current[editingIndexRef.current] = {
            ...existingEntry,
            ...editDataRef.current,
          };
          form.setValue("orders", current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to ensure orders is always an array
  const getOrdersArray = () => {
    const value = form.getValues("orders");
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  };

  const handleAdd = () => {
    const newEntry = {
      type: "",
      priority: "",
      details: "",
      status: userRole === "nurse" ? "Pending Physician Signature" : "Pending",
      dateOrdered: "",
    };
    const current = getOrdersArray();
    form.setValue("orders", [...current, newEntry]);
    setEditingIndex(current.length);
    setEditData(newEntry);
  };

  const handleEdit = (index: number) => {
    const entry = orders[index];
    if (entry) {
      setEditingIndex(index);
      setEditData({
        type: entry.type || "",
        priority: entry.priority || "",
        details: entry.details || "",
        status: entry.status || "",
        dateOrdered: entry.dateOrdered || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getOrdersArray();
    current[index] = {
      ...current[index],
      ...editData,
    };
    form.setValue("orders", current);
    setEditingIndex(null);
    setEditData({
      type: "",
      priority: "",
      details: "",
      status: "",
      dateOrdered: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      type: "",
      priority: "",
      details: "",
      status: "",
      dateOrdered: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getOrdersArray();
    form.setValue("orders", current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {orders.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No orders added yet
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Order Type</Label>
                      <Select
                        value={editData.type}
                        onValueChange={(value) => setEditData({ ...editData, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Medication">Medication</SelectItem>
                          <SelectItem value="Lab">Lab</SelectItem>
                          <SelectItem value="Imaging">Imaging</SelectItem>
                          <SelectItem value="Procedure">Procedure</SelectItem>
                          <SelectItem value="Referral">Referral</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select
                        value={editData.priority}
                        onValueChange={(value) => setEditData({ ...editData, priority: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Stat">Stat</SelectItem>
                          <SelectItem value="Urgent">Urgent</SelectItem>
                          <SelectItem value="Routine">Routine</SelectItem>
                          <SelectItem value="Elective">Elective</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Order Details</Label>
                    <Input
                      value={editData.details}
                      onChange={(e) => setEditData({ ...editData, details: e.target.value })}
                      placeholder="e.g., CBC with Differential"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editData.status}
                        onValueChange={(value) => setEditData({ ...editData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {userRole === "nurse" && (
                            <SelectItem value="Pending Physician Signature">Pending Physician Signature</SelectItem>
                          )}
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Ordered">Ordered</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                          <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Date Ordered</Label>
                      <Input
                        type="date"
                        value={editData.dateOrdered}
                        onChange={(e) => setEditData({ ...editData, dateOrdered: e.target.value })}
                        placeholder="mm/dd/yyyy"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.type.trim() || !editData.details.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{order.details || "Unnamed Order"}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {order.type && <div>Type: {order.type}</div>}
                        {order.priority && <div>Priority: {order.priority}</div>}
                        {order.status && <div>Status: {order.status}</div>}
                        {order.dateOrdered && <div>Date Ordered: {order.dateOrdered}</div>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        {userRole === "nurse" ? "Add Draft Order" : "Add Order"}
      </Button>
    </div>
  );
}

// Assessment & Plan Section Component
function AssessmentPlanSection({ form }: { form: any }) {
  const assessmentPlanValue = form.watch("assessmentPlan");
  // Ensure assessmentPlan is always an array
  const assessmentPlans = React.useMemo(() => {
    // Handle migration from old format (object with assessment/plan) to new format (array)
    if (!assessmentPlanValue) return [];
    if (Array.isArray(assessmentPlanValue)) {
      return assessmentPlanValue;
    }
    // If it's the old format (object with assessment/plan), convert to array
    if (typeof assessmentPlanValue === "object" && "assessment" in assessmentPlanValue) {
      const old = assessmentPlanValue as { assessment?: string; plan?: string };
      if (old.assessment || old.plan) {
        return [{
          assessment: old.assessment || "",
          plan: old.plan || "",
          medications: [],
          orders: [],
          followUp: "",
          education: "",
          coordination: "",
        }];
      }
    }
    return [];
  }, [assessmentPlanValue]);

  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [editData, setEditData] = React.useState({
    assessment: "",
    plan: "",
    medications: [] as Array<{ brandName: string; strength: string; form: string; dosage: string; frequency: string }>,
    orders: [] as Array<{ type: string; priority: string; details: string; status: string; dateOrdered: string }>,
    followUp: "",
    education: "",
    coordination: "",
  });

  // Helper to ensure assessmentPlan is always an array
  const getAssessmentPlanArray = () => {
    const value = form.getValues("assessmentPlan");
    if (Array.isArray(value)) {
      return value;
    }
    // Handle old format migration
    if (value && typeof value === "object" && "assessment" in value) {
      const old = value as { assessment?: string; plan?: string };
      if (old.assessment || old.plan) {
        return [{
          assessment: old.assessment || "",
          plan: old.plan || "",
          medications: [],
          orders: [],
          followUp: "",
          education: "",
          coordination: "",
        }];
      }
    }
    return [];
  };

  const handleAdd = () => {
    const newEntry = {
      assessment: "",
      plan: "",
      medications: [],
      orders: [],
      followUp: "",
      education: "",
      coordination: "",
    };
    const current = getAssessmentPlanArray();
    form.setValue("assessmentPlan", [...current, newEntry]);
    setEditingIndex(current.length);
    setEditData(newEntry);
  };

  const handleEdit = (index: number) => {
    const entry = assessmentPlans[index];
    if (entry) {
      setEditingIndex(index);
      setEditData({
        assessment: entry.assessment || "",
        plan: entry.plan || "",
        medications: entry.medications || [],
        orders: entry.orders || [],
        followUp: entry.followUp || "",
        education: entry.education || "",
        coordination: entry.coordination || "",
      });
    }
  };

  const handleSave = (index: number) => {
    const current = getAssessmentPlanArray();
    current[index] = {
      ...current[index],
      ...editData,
    };
    form.setValue("assessmentPlan", current);
    setEditingIndex(null);
    setEditData({
      assessment: "",
      plan: "",
      medications: [],
      orders: [],
      followUp: "",
      education: "",
      coordination: "",
    });
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditData({
      assessment: "",
      plan: "",
      medications: [],
      orders: [],
      followUp: "",
      education: "",
      coordination: "",
    });
  };

  const handleRemove = (index: number) => {
    const current = getAssessmentPlanArray();
    current.splice(index, 1);
    form.setValue("assessmentPlan", current);
    if (editingIndex === index) {
      setEditingIndex(null);
      setEditData({
        assessment: "",
        plan: "",
        medications: [],
        orders: [],
        followUp: "",
        education: "",
        coordination: "",
      });
    }
  };

  const handleAddMedication = () => {
    setEditData({
      ...editData,
      medications: [...editData.medications, { brandName: "", strength: "", form: "", dosage: "", frequency: "" }],
    });
  };

  const handleUpdateMedication = (medIndex: number, field: string, value: string) => {
    const updated = [...editData.medications];
    updated[medIndex] = { ...updated[medIndex], [field]: value };
    setEditData({ ...editData, medications: updated });
  };

  const handleRemoveMedication = (medIndex: number) => {
    setEditData({
      ...editData,
      medications: editData.medications.filter((_, i) => i !== medIndex),
    });
  };

  const handleAddOrder = () => {
    setEditData({
      ...editData,
      orders: [...editData.orders, { type: "", priority: "", details: "", status: "", dateOrdered: "" }],
    });
  };

  const handleUpdateOrder = (orderIndex: number, field: string, value: string) => {
    const updated = [...editData.orders];
    updated[orderIndex] = { ...updated[orderIndex], [field]: value };
    setEditData({ ...editData, orders: updated });
  };

  const handleRemoveOrder = (orderIndex: number) => {
    setEditData({
      ...editData,
      orders: editData.orders.filter((_, i) => i !== orderIndex),
    });
  };

  return (
    <div className="space-y-4">
      {assessmentPlans.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No assessment & plan entries yet
        </div>
      ) : (
        <div className="space-y-6">
          {assessmentPlans.map((item: any, index: number) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 bg-card"
            >
              {editingIndex === index ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Assessment</Label>
                    <Textarea
                      value={editData.assessment}
                      onChange={(e) => setEditData({ ...editData, assessment: e.target.value })}
                      placeholder="e.g., Acute Otitis Media – New (H66.90)"
                      rows={2}
                      className="min-h-[60px]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Plan</Label>
                    <Textarea
                      value={editData.plan}
                      onChange={(e) => setEditData({ ...editData, plan: e.target.value })}
                      placeholder="e.g., Start antibiotics."
                      rows={2}
                      className="min-h-[60px]"
                    />
                  </div>

                  {/* Medications */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Medications</Label>
                      <Button type="button" size="sm" variant="outline" onClick={handleAddMedication}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {editData.medications.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">No medications added</div>
                    ) : (
                      <div className="space-y-2">
                        {editData.medications.map((med, medIndex) => (
                          <div key={medIndex} className="border rounded p-3 space-y-2 bg-muted/30">
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={med.brandName}
                                onChange={(e) => handleUpdateMedication(medIndex, "brandName", e.target.value)}
                                placeholder="Medication name (e.g., Amoxicillin 400 mg/5 mL)"
                                className="col-span-2"
                              />
                              <Input
                                value={med.dosage}
                                onChange={(e) => handleUpdateMedication(medIndex, "dosage", e.target.value)}
                                placeholder="Dosage (e.g., 7.5 mL)"
                              />
                              <Input
                                value={med.frequency}
                                onChange={(e) => handleUpdateMedication(medIndex, "frequency", e.target.value)}
                                placeholder="Frequency (e.g., PO BID x 10 days)"
                              />
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveMedication(medIndex)}
                              className="w-full"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Orders */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Orders</Label>
                      <Button type="button" size="sm" variant="outline" onClick={handleAddOrder}>
                        <Plus className="h-3 w-3 mr-1" />
                        Add
                      </Button>
                    </div>
                    {editData.orders.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">No orders added</div>
                    ) : (
                      <div className="space-y-2">
                        {editData.orders.map((order, orderIndex) => (
                          <div key={orderIndex} className="border rounded p-3 space-y-2 bg-muted/30">
                            <Input
                              value={order.details}
                              onChange={(e) => handleUpdateOrder(orderIndex, "details", e.target.value)}
                              placeholder="Order details"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveOrder(orderIndex)}
                              className="w-full"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Follow-up</Label>
                    <Textarea
                      value={editData.followUp}
                      onChange={(e) => setEditData({ ...editData, followUp: e.target.value })}
                      placeholder="e.g., PRN if no improvement in 48 hours"
                      rows={2}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Education</Label>
                    <Textarea
                      value={editData.education}
                      onChange={(e) => setEditData({ ...editData, education: e.target.value })}
                      placeholder="e.g., Discussed expected course and return precautions."
                      rows={2}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Coordination</Label>
                    <Textarea
                      value={editData.coordination}
                      onChange={(e) => setEditData({ ...editData, coordination: e.target.value })}
                      placeholder="e.g., None"
                      rows={2}
                      className="min-h-[60px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSave(index)}
                      disabled={!editData.assessment.trim() && !editData.plan.trim()}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-4">
                      {item.assessment && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Assessment:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.assessment}</div>
                        </div>
                      )}
                      {item.plan && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Plan:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.plan}</div>
                        </div>
                      )}
                      {item.medications && Array.isArray(item.medications) && item.medications.length > 0 && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Medications:</div>
                          <div className="text-sm space-y-1">
                            {item.medications.map((med: any, medIndex: number) => (
                              <div key={medIndex} className="pl-2">
                                {med.brandName} {med.dosage && med.dosage} {med.frequency && med.frequency}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.orders && Array.isArray(item.orders) && item.orders.length > 0 && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Orders:</div>
                          <div className="text-sm space-y-1">
                            {item.orders.map((order: any, orderIndex: number) => (
                              <div key={orderIndex} className="pl-2">
                                {order.details || "None"}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {item.followUp && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Follow-up:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.followUp}</div>
                        </div>
                      )}
                      {item.education && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Education:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.education}</div>
                        </div>
                      )}
                      {item.coordination && (
                        <div>
                          <div className="font-medium text-sm text-muted-foreground mb-1">Coordination:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.coordination}</div>
                        </div>
                      )}
                      {!item.assessment && !item.plan && (
                        <div className="text-sm text-muted-foreground">Empty entry</div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Assessment & Plan
      </Button>
    </div>
  );
}

// Documents Section Component
function DocumentsSection({ form, patientId, visitId }: { form: any; patientId: string; visitId: string | null }) {
  const docsValue = form.watch("docs");
  const uploadedDocuments = docsValue?.uploadedDocuments || [];

  const [isUploading, setIsUploading] = React.useState(false);
  const [isCapturing, setIsCapturing] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [stream, setStream] = React.useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const newDocuments = [...uploadedDocuments];

      for (const file of Array.from(files)) {
        // Validate file type
        const allowedTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ];

        if (!allowedTypes.includes(file.type)) {
          toast.error(`File type not allowed: ${file.name}`);
          continue;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(`File too large: ${file.name} (max 10MB)`);
          continue;
        }

        // Create preview data URL for images
        let dataUrl: string | undefined;
        if (file.type.startsWith("image/")) {
          dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        // Upload file to server
        const formData = new FormData();
        formData.append("file", file);
        formData.append("patientId", patientId);
        if (visitId) {
          formData.append("visitId", visitId);
        }

        const uploadResponse = await fetch("/api/upload/document", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json();
          throw new Error(error.error || "Upload failed");
        }

        const uploadData = await uploadResponse.json();

        // Add to local state with storageUrl for later DB save
        newDocuments.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          dataUrl,
          storageUrl: uploadData.storageUrl, // Store for later DB save
        });

        // Save document metadata to DB if visitId exists
        if (visitId) {
          const result = await createDocumentAction({
            patientId,
            visitId,
            filename: file.name,
            mimeType: file.type,
            size: file.size.toString(),
            storageUrl: uploadData.storageUrl,
          });

          if (!result.success) {
            console.error("Failed to save document metadata:", result.error);
            // Continue anyway - file is uploaded, metadata can be saved later
          }
        }
      }

      // Update form state
      form.setValue("docs", {
        uploadedDocuments: newDocuments,
      });

      toast.success(`Uploaded ${newDocuments.length - uploadedDocuments.length} document(s)`);
    } catch (error) {
      console.error("Error uploading documents:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload documents");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = (index: number) => {
    const newDocuments = uploadedDocuments.filter((_doc: unknown, i: number) => i !== index);
    form.setValue("docs", {
      uploadedDocuments: newDocuments,
    });
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Prefer back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setStream(mediaStream);
      setIsCapturing(true);
      setCapturedImage(null);

      // Use setTimeout to ensure video element is rendered
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch((err) => {
            console.error("Error playing video:", err);
          });
        }
      }, 100);
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Failed to access camera. Please check permissions.");
      setIsCapturing(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
    setCapturedImage(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error("Camera not ready. Please wait a moment.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      toast.error("Failed to initialize canvas.");
      return;
    }

    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      toast.error("Video not ready. Please wait a moment.");
      return;
    }

    // Set processing state
    setIsProcessing(true);

    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9);
      });

      if (!blob) {
        toast.error("Failed to capture photo.");
        setIsProcessing(false);
        return;
      }

      // Convert blob to File
      const file = new File([blob], `photo-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Stop camera
      stopCamera();

      // Upload the captured photo
      await handleFileUpload(file);
    } catch (error) {
      console.error("Error capturing photo:", error);
      toast.error("Failed to capture photo.");
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsProcessing(false);
    setIsUploading(true);

    try {
      const newDocuments = [...uploadedDocuments];

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error(`File type not allowed: ${file.name}`);
        setIsUploading(false);
        setIsProcessing(false);
        return;
      }

      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`File too large: ${file.name} (max 10MB)`);
        setIsUploading(false);
        setIsProcessing(false);
        return;
      }

      // Create preview data URL for images
      let dataUrl: string | undefined;
      if (file.type.startsWith("image/")) {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      // Upload file to server
      const formData = new FormData();
      formData.append("file", file);
      formData.append("patientId", patientId);
      if (visitId) {
        formData.append("visitId", visitId);
      }

      const uploadResponse = await fetch("/api/upload/document", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || "Upload failed");
      }

      const uploadData = await uploadResponse.json();

      // Add to local state with storageUrl for later DB save
      newDocuments.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        dataUrl,
        storageUrl: uploadData.storageUrl, // Store for later DB save
      });

      // Save document metadata to DB if visitId exists
      if (visitId) {
        const result = await createDocumentAction({
          patientId,
          visitId,
          filename: file.name,
          mimeType: file.type,
          size: file.size.toString(),
          storageUrl: uploadData.storageUrl,
        });

        if (!result.success) {
          console.error("Failed to save document metadata:", result.error);
          // Continue anyway - file is uploaded, metadata can be saved later
        }
      }

      // Update form state
      form.setValue("docs", {
        uploadedDocuments: newDocuments,
      });

      toast.success("Photo uploaded successfully");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // Set video stream when it changes
  React.useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch((err) => {
        console.error("Error playing video:", err);
      });
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Upload Documents</Label>
        <div className="flex gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading || isCapturing}
            className="cursor-pointer flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={isCapturing ? stopCamera : startCamera}
            disabled={isUploading}
          >
            {isCapturing ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Camera className="h-4 w-4 mr-2" />
                Take Photo
              </>
            )}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Allowed: Images, PDF, DOC, DOCX (max 10MB per file)
        </p>
      </div>

      {/* Camera Preview */}
      {isCapturing && (
        <div className="space-y-2 border rounded-lg p-4 bg-card">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-w-md mx-auto rounded-lg"
              style={{
                transform: "scaleX(-1)",
                maxHeight: "400px",
                objectFit: "contain",
              }}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.play().catch((err) => {
                    console.error("Error playing video:", err);
                  });
                }
              }}
            />
            <canvas ref={canvasRef} className="hidden" />
            {(isProcessing || isUploading) && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                <div className="text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
                  <p className="text-white text-sm font-medium">
                    {isProcessing ? "Processing photo..." : "Uploading photo..."}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              onClick={capturePhoto}
              disabled={isUploading || isProcessing || !stream}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Capture
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={stopCamera}
              disabled={isUploading || isProcessing}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Upload Status */}
      {isUploading && !isCapturing && (
        <div className="border rounded-lg p-4 bg-card flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium">Uploading photo...</p>
            <p className="text-xs text-muted-foreground">Please wait while we save your photo</p>
          </div>
        </div>
      )}

      {uploadedDocuments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No documents uploaded yet
        </div>
      ) : (
        <div className="space-y-2">
          {uploadedDocuments.map((doc: { id?: string; name: string; type: string; size: number; uploadedAt: string; dataUrl?: string; storageUrl?: string }, index: number) => (
            <div
              key={doc.id || index}
              className="border rounded-lg p-4 bg-card flex items-start justify-between gap-4"
            >
              <div className="flex-1 space-y-1">
                <div className="font-medium">{doc.name}</div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Type: {doc.type}</div>
                  <div>Size: {formatFileSize(doc.size)}</div>
                  <div>Uploaded: {formatDate(doc.uploadedAt)}</div>
                </div>
                {doc.dataUrl && (
                  <div className="mt-2">
                    <img
                      src={doc.dataUrl}
                      alt={doc.name}
                      className="max-w-xs max-h-32 rounded border"
                    />
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(index)}
                disabled={isUploading}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}


    </div>
  );
}

function countCollectionItems(value: unknown) {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).length;
  }

  return 0;
}

function NurseIntakeSummaryCard({
  isExpanded,
  onToggle,
  chiefComplaint,
  bp,
  hr,
  temp,
  weight,
  triageNotes,
  allergies,
  currentMedications,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  chiefComplaint?: string;
  bp?: string;
  hr?: string;
  temp?: string;
  weight?: string;
  triageNotes?: string;
  allergies: unknown;
  currentMedications: unknown;
}) {
  const medicationCount = countCollectionItems(currentMedications);
  const allergyCount = countCollectionItems(allergies);

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Nurse Intake Summary</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Reference-only snapshot of the nurse-entered intake.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Read-only</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
              {isExpanded ? "Collapse" : "Expand"}
              <ChevronDown
                className={cn(
                  "ml-2 h-4 w-4 transition-transform",
                  isExpanded && "rotate-180"
                )}
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Chief Complaint
            </div>
            <div className="mt-2 text-sm font-medium text-foreground">
              {chiefComplaint?.trim() || "Not entered"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Intake Vitals
            </div>
            <div className="mt-2 grid gap-2 text-sm">
              <div>BP: {bp?.trim() || "Not entered"}</div>
              <div>HR: {hr?.trim() || "Not entered"}</div>
              <div>Temp: {temp?.trim() || "Not entered"}</div>
              <div>Weight: {weight?.trim() || "Not entered"}</div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Medication / Allergy Profile
            </div>
            <div className="mt-2 grid gap-2 text-sm">
              <div>Current Medications: {medicationCount}</div>
              <div>Allergies: {allergyCount}</div>
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4 md:col-span-2 xl:col-span-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Triage Notes
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
              {triageNotes?.trim() || "No triage notes documented."}
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function EncounterSummaryCard({
  patientBasics,
  visitAppointmentType,
  visitCreatedByRole,
  consentConfirmed,
}: {
  patientBasics: PatientBasics;
  visitAppointmentType?: string | null;
  visitCreatedByRole?: "doctor" | "nurse" | null;
  consentConfirmed: boolean;
}) {
  const latestVitals =
    patientBasics.vitals && typeof patientBasics.vitals === "object"
      ? (patientBasics.vitals as Record<string, unknown>)
      : null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Encounter Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Visit type
            </div>
            <div className="font-medium">
              {visitAppointmentType || "General encounter"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Intake owner
            </div>
            <div className="font-medium">
              {visitCreatedByRole
                ? `${visitCreatedByRole.charAt(0).toUpperCase()}${visitCreatedByRole.slice(1)} workflow`
                : "Direct charting"}
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Latest BP / HR
            </div>
            <div className="font-medium">
              {(typeof latestVitals?.bp === "string" && latestVitals.bp) || "Not charted"} /{" "}
              {(typeof latestVitals?.hr === "string" && latestVitals.hr) || "Not charted"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              AI transcript
            </div>
            <Badge variant={consentConfirmed ? "default" : "outline"}>
              {consentConfirmed ? "Consent confirmed" : "Consent required"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniScheduleWidget({
  patientId,
  userRole,
  visitAppointmentType,
  visitTwilioRoomName,
  existingVisitId,
}: {
  patientId: string;
  userRole: string;
  visitAppointmentType?: string | null;
  visitTwilioRoomName?: string | null;
  existingVisitId?: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          Mini Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="font-medium">{visitAppointmentType || "Current encounter"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Keep schedule context visible while documenting.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/waiting-room">Open Schedule</Link>
          </Button>
          {userRole === "doctor" && (
            <Button asChild size="sm" variant="outline">
              <Link href="/open-notes">Open Notes</Link>
            </Button>
          )}
          <Button asChild size="sm" variant="outline">
            <Link href={`/patients/${patientId}`}>Chart</Link>
          </Button>
          {visitTwilioRoomName && existingVisitId && (
            <Button asChild size="sm">
              <Link href={`/visit/${existingVisitId}/call`}>Return to Call</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewOfSystemsSection({ form }: { form: any }) {
  const systems = [
    ["constitutional", "Constitutional"],
    ["heent", "HEENT"],
    ["cardiovascular", "Cardiovascular"],
    ["respiratory", "Respiratory"],
    ["gastrointestinal", "Gastrointestinal"],
    ["genitourinary", "Genitourinary"],
    ["musculoskeletal", "Musculoskeletal"],
    ["neurologic", "Neurologic"],
    ["psychiatric", "Psychiatric"],
    ["skin", "Skin"],
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {systems.map(([key, label]) => (
        <div key={key} className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-base font-semibold">{label}</Label>
            <Select
              value={form.watch(`reviewOfSystems.${key}.status`) || "not-reviewed"}
              onValueChange={(value) =>
                form.setValue(`reviewOfSystems.${key}.status`, value)
              }
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not-reviewed">Not reviewed</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            {...form.register(`reviewOfSystems.${key}.notes`)}
            rows={3}
            placeholder={`ROS notes for ${label.toLowerCase()}...`}
          />
        </div>
      ))}
    </div>
  );
}

function DifferentialDiagnosesSection({ form }: { form: any }) {
  const entries = (form.watch("differentialDiagnoses") || []) as Array<{
    diagnosis?: string;
    rationale?: string;
    source?: "ai" | "manual";
  }>;

  const updateEntries = (next: typeof entries) => {
    form.setValue("differentialDiagnoses", next);
  };

  return (
    <div className="space-y-4">
      {entries.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No differential diagnoses added yet.
        </div>
      )}
      {entries.map((entry, index) => (
        <div key={index} className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-base font-semibold">
              Differential #{index + 1}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                updateEntries(entries.filter((_, entryIndex) => entryIndex !== index))
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <Input
            value={entry.diagnosis || ""}
            onChange={(event) => {
              const next = [...entries];
              next[index] = { ...entry, diagnosis: event.target.value };
              updateEntries(next);
            }}
            placeholder="Possible diagnosis"
          />
          <Textarea
            value={entry.rationale || ""}
            onChange={(event) => {
              const next = [...entries];
              next[index] = { ...entry, rationale: event.target.value };
              updateEntries(next);
            }}
            placeholder="Why this remains on the differential"
            rows={3}
          />
          <Select
            value={entry.source || "manual"}
            onValueChange={(value: "ai" | "manual") => {
              const next = [...entries];
              next[index] = { ...entry, source: value };
              updateEntries(next);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="ai">AI suggested</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() =>
          updateEntries([
            ...entries,
            { diagnosis: "", rationale: "", source: "manual" },
          ])
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Differential
      </Button>
    </div>
  );
}

function VisitActionsSection({
  form,
  patientBasics,
}: {
  form: any;
  patientBasics: PatientBasics;
}) {
  type VisitActionGroup =
    | "prescriptions"
    | "labs"
    | "imaging"
    | "referrals"
    | "nextSteps";

  type PrescriptionEntry = {
    medication?: string;
    dosage?: string;
    frequency?: string;
    durationValue?: string;
    durationUnit?: string;
    notes?: string;
  };

  type LabEntry = {
    test?: string;
    urgency?: string;
    clinicalIndication?: string;
  };

  type ImagingEntry = {
    study?: string;
    bodyRegion?: string;
    urgency?: string;
    clinicalIndication?: string;
  };

  type ReferralEntry = {
    specialty?: string;
    providerName?: string;
    reason?: string;
  };

  const visitActions = form.watch("visitActions") || {
    prescriptions: [],
    labs: [],
    imaging: [],
    referrals: [],
    nextSteps: [],
  };

  const frequencyOptions = [
    "Once daily",
    "Twice daily",
    "Three times daily",
    "Four times daily",
    "As needed",
    "Weekly",
    "Other",
  ];
  const durationUnits = ["days", "weeks", "months"];
  const urgencyOptions = ["Routine", "STAT", "ASAP"];

  const allergyNames = React.useMemo(() => {
    if (!Array.isArray(patientBasics.allergies)) {
      return [];
    }

    return patientBasics.allergies
      .map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }
        if (entry && typeof entry === "object" && "name" in entry) {
          return String((entry as { name?: unknown }).name || "");
        }
        return "";
      })
      .map((entry) => entry.trim())
      .filter(Boolean);
  }, [patientBasics.allergies]);

  const updateGroup = (group: VisitActionGroup, next: unknown[]) => {
    form.setValue(`visitActions.${group}`, next);
  };

  const updateItem = <T extends Record<string, string | undefined>>(
    group: VisitActionGroup,
    items: T[],
    index: number,
    key: keyof T,
    value: string
  ) => {
    const next = [...items];
    next[index] = {
      ...items[index],
      [key]: value,
    };
    updateGroup(group, next);
  };

  const removeItem = (group: VisitActionGroup, index: number, items: unknown[]) => {
    updateGroup(
      group,
      items.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const canAddAnother = (
    items: Array<Record<string, string | undefined>>,
    requiredKeys: string[]
  ) =>
    items.every((item) =>
      requiredKeys.every((key) => Boolean(item[key]?.trim()))
    );

  const prescriptions = (visitActions.prescriptions || []) as PrescriptionEntry[];
  const labs = (visitActions.labs || []) as LabEntry[];
  const imaging = (visitActions.imaging || []) as ImagingEntry[];
  const referrals = (visitActions.referrals || []) as ReferralEntry[];
  const nextSteps = (visitActions.nextSteps || []) as Array<Record<string, string>>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Prescriptions</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              updateGroup("prescriptions", [
                ...prescriptions,
                {
                  medication: "",
                  dosage: "",
                  frequency: "",
                  durationValue: "",
                  durationUnit: "days",
                  notes: "",
                },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {prescriptions.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No prescriptions staged yet.
          </div>
        )}
        {prescriptions.map((item, index) => {
          const medicationValue = item.medication?.trim().toLowerCase() || "";
          const allergyMatch = allergyNames.find((allergy) => {
            const allergyValue = allergy.toLowerCase();
            return (
              medicationValue.includes(allergyValue) ||
              allergyValue.includes(medicationValue)
            );
          });

          return (
            <div key={index} className="space-y-4 rounded-lg bg-muted/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">Prescription #{index + 1}</div>
                  {allergyMatch ? (
                    <Badge
                      variant="destructive"
                      className="mt-2 inline-flex items-center gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Possible allergy match - verify before prescribing
                    </Badge>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem("prescriptions", index, prescriptions)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Medication</Label>
                  <Input
                    value={item.medication || ""}
                    onChange={(event) =>
                      updateItem(
                        "prescriptions",
                        prescriptions,
                        index,
                        "medication",
                        event.target.value
                      )
                    }
                    placeholder="Medication"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dose</Label>
                  <Input
                    value={item.dosage || ""}
                    onChange={(event) =>
                      updateItem(
                        "prescriptions",
                        prescriptions,
                        index,
                        "dosage",
                        event.target.value
                      )
                    }
                    placeholder="Dose"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={item.frequency || ""}
                    onValueChange={(value) =>
                      updateItem("prescriptions", prescriptions, index, "frequency", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {frequencyOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input
                      value={item.durationValue || ""}
                      onChange={(event) =>
                        updateItem(
                          "prescriptions",
                          prescriptions,
                          index,
                          "durationValue",
                          event.target.value
                        )
                      }
                      placeholder="Duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit</Label>
                    <Select
                      value={item.durationUnit || "days"}
                      onValueChange={(value) =>
                        updateItem(
                          "prescriptions",
                          prescriptions,
                          index,
                          "durationUnit",
                          value
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Unit" />
                      </SelectTrigger>
                      <SelectContent>
                        {durationUnits.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={item.notes || ""}
                  onChange={(event) =>
                    updateItem("prescriptions", prescriptions, index, "notes", event.target.value)
                  }
                  placeholder="Optional prescribing notes"
                  rows={3}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-base font-semibold">Labs</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Lab orders save independently and do not block sign-off.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAddAnother(labs, ["clinicalIndication"])}
            onClick={() =>
              updateGroup("labs", [
                ...labs,
                { test: "", urgency: "Routine", clinicalIndication: "" },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {labs.length === 0 && (
          <div className="text-sm text-muted-foreground">No labs staged yet.</div>
        )}
        {labs.map((item, index) => (
          <div key={index} className="space-y-4 rounded-lg bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">Lab #{index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeItem("labs", index, labs)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Test</Label>
                <Input
                  value={item.test || ""}
                  onChange={(event) =>
                    updateItem("labs", labs, index, "test", event.target.value)
                  }
                  placeholder="Test"
                />
              </div>
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select
                  value={item.urgency || "Routine"}
                  onValueChange={(value) =>
                    updateItem("labs", labs, index, "urgency", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    {urgencyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Clinical Indication <span className="text-destructive">*</span>
              </Label>
              <Input
                value={item.clinicalIndication || ""}
                onChange={(event) =>
                  updateItem(
                    "labs",
                    labs,
                    index,
                    "clinicalIndication",
                    event.target.value
                  )
                }
                placeholder="Why this lab is being ordered"
              />
              {!item.clinicalIndication?.trim() && (
                <p className="text-xs text-destructive">
                  Clinical indication is required before adding another lab.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-base font-semibold">Imaging</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Imaging orders save independently and do not block sign-off.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAddAnother(imaging, ["clinicalIndication"])}
            onClick={() =>
              updateGroup("imaging", [
                ...imaging,
                {
                  study: "",
                  bodyRegion: "",
                  urgency: "Routine",
                  clinicalIndication: "",
                },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {imaging.length === 0 && (
          <div className="text-sm text-muted-foreground">No imaging studies staged yet.</div>
        )}
        {imaging.map((item, index) => (
          <div key={index} className="space-y-4 rounded-lg bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">Imaging #{index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeItem("imaging", index, imaging)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Study / Modality</Label>
                <Input
                  value={item.study || ""}
                  onChange={(event) =>
                    updateItem("imaging", imaging, index, "study", event.target.value)
                  }
                  placeholder="Study / Modality"
                />
              </div>
              <div className="space-y-2">
                <Label>Body Region / Area</Label>
                <Input
                  value={item.bodyRegion || ""}
                  onChange={(event) =>
                    updateItem("imaging", imaging, index, "bodyRegion", event.target.value)
                  }
                  placeholder="Body Region / Area"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Urgency</Label>
                <Select
                  value={item.urgency || "Routine"}
                  onValueChange={(value) =>
                    updateItem("imaging", imaging, index, "urgency", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    {urgencyOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Clinical Indication <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={item.clinicalIndication || ""}
                  onChange={(event) =>
                    updateItem(
                      "imaging",
                      imaging,
                      index,
                      "clinicalIndication",
                      event.target.value
                    )
                  }
                  placeholder="Why this study is needed"
                />
              </div>
            </div>
            {!item.clinicalIndication?.trim() && (
              <p className="text-xs text-destructive">
                Clinical indication is required before adding another imaging order.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Referrals</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!canAddAnother(referrals, ["reason"])}
            onClick={() =>
              updateGroup("referrals", [
                ...referrals,
                { specialty: "", providerName: "", reason: "" },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {referrals.length === 0 && (
          <div className="text-sm text-muted-foreground">No referrals staged yet.</div>
        )}
        {referrals.map((item, index) => (
          <div key={index} className="space-y-4 rounded-lg bg-muted/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="font-medium">Referral #{index + 1}</div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeItem("referrals", index, referrals)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Specialty</Label>
                <Input
                  value={item.specialty || ""}
                  onChange={(event) =>
                    updateItem("referrals", referrals, index, "specialty", event.target.value)
                  }
                  placeholder="Specialty"
                />
              </div>
              <div className="space-y-2">
                <Label>Provider Name (if known)</Label>
                <Input
                  value={item.providerName || ""}
                  onChange={(event) =>
                    updateItem(
                      "referrals",
                      referrals,
                      index,
                      "providerName",
                      event.target.value
                    )
                  }
                  placeholder="Provider Name (if known)"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Reason for Referral <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={item.reason || ""}
                onChange={(event) =>
                  updateItem("referrals", referrals, index, "reason", event.target.value)
                }
                placeholder="Reason for Referral"
                rows={3}
              />
              {!item.reason?.trim() && (
                <p className="text-xs text-destructive">
                  A reason is required before adding another referral.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4 md:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-base font-semibold">Next Steps</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              updateGroup("nextSteps", [
                ...nextSteps,
                { task: "", owner: "", dueBy: "" },
              ])
            }
          >
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
        {nextSteps.map((step, index) => (
          <div
            key={index}
            className="mb-3 grid gap-2 rounded-lg bg-muted/40 p-3 md:grid-cols-3"
          >
            <Input
              value={step.task || ""}
              onChange={(event) => {
                const next = [...nextSteps];
                next[index] = { ...step, task: event.target.value };
                updateGroup("nextSteps", next);
              }}
              placeholder="Next step"
            />
            <Input
              value={step.owner || ""}
              onChange={(event) => {
                const next = [...nextSteps];
                next[index] = { ...step, owner: event.target.value };
                updateGroup("nextSteps", next);
              }}
              placeholder="Owner"
            />
            <div className="flex gap-2">
              <Input
                value={step.dueBy || ""}
                onChange={(event) => {
                  const next = [...nextSteps];
                  next[index] = { ...step, dueBy: event.target.value };
                  updateGroup("nextSteps", next);
                }}
                placeholder="Due by"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeItem("nextSteps", index, nextSteps)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {!nextSteps.length && (
          <div className="text-sm text-muted-foreground">
            No next steps recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}

function CodingPreparationSection({
  form,
  patientId,
  visitId,
}: {
  form: any;
  patientId: string;
  visitId: string | null;
}) {
  const coding = form.watch("coding");
  const coSign = form.watch("coSign");

  const updateCodeList = (field: "icd10Codes" | "cptCodes", value: string) => {
    const next = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    form.setValue(`coding.${field}`, next);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        Final sign-off happens on the dedicated close-out screen. Prepare codes,
        complexity, and co-sign information here first.
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>ICD-10 Codes</Label>
          <Input
            value={(coding?.icd10Codes || []).join(", ")}
            onChange={(event) => updateCodeList("icd10Codes", event.target.value)}
            placeholder="e.g. K35.80, R10.9"
          />
          {(coding?.suggestedIcd10Codes || []).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Suggested: {(coding.suggestedIcd10Codes || []).join(", ")}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label>CPT Codes</Label>
          <Input
            value={(coding?.cptCodes || []).join(", ")}
            onChange={(event) => updateCodeList("cptCodes", event.target.value)}
            placeholder="e.g. 99214"
          />
          {(coding?.suggestedCptCodes || []).length > 0 && (
            <p className="text-xs text-muted-foreground">
              Suggested: {(coding.suggestedCptCodes || []).join(", ")}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>MDM Complexity</Label>
          <Select
            value={coding?.mdmComplexity || ""}
            onValueChange={(value) => form.setValue("coding.mdmComplexity", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select MDM level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="straightforward">Straightforward</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Visit Duration (minutes)</Label>
          <Input
            value={coding?.visitDurationMinutes || ""}
            onChange={(event) =>
              form.setValue("coding.visitDurationMinutes", event.target.value)
            }
            placeholder="e.g. 35"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Coding Notes</Label>
        <Textarea
          value={coding?.codingNotes || ""}
          onChange={(event) =>
            form.setValue("coding.codingNotes", event.target.value)
          }
          rows={4}
          placeholder="Capture coding rationale, complexity, and documentation notes."
        />
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <Checkbox
            id="co-sign-requested"
            checked={coSign?.requested || false}
            onCheckedChange={(checked) =>
              form.setValue("coSign.requested", checked === true)
            }
          />
          <Label htmlFor="co-sign-requested">Request co-sign at close-out</Label>
        </div>
        {coSign?.requested && (
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              value={coSign?.requestedFrom || ""}
              onChange={(event) =>
                form.setValue("coSign.requestedFrom", event.target.value)
              }
              placeholder="Requested from"
            />
            <Input
              value={coSign?.reason || ""}
              onChange={(event) =>
                form.setValue("coSign.reason", event.target.value)
              }
              placeholder="Reason for co-sign"
            />
          </div>
        )}
      </div>
      {visitId && (
        <Button asChild className="w-full">
          <Link href={`/patients/${patientId}/visit-close?visitId=${visitId}`}>
            Continue to sign-off
          </Link>
        </Button>
      )}
    </div>
  );
}

// Helper function
async function getDraftFormState(patientId: string, userId: string) {
  const { getDraftFormState } = await import("@/app/_lib/offline/draft");
  return getDraftFormState(patientId, userId);
}

