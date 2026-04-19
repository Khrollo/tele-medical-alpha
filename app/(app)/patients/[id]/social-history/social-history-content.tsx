"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Pencil,
  Flag,
  Cigarette,
  Wine,
  Home,
  CheckCircle2,
  Beaker,
  Briefcase,
  Users,
  Activity,
  Clipboard,
  Heart,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Btn,
  ClearingCard,
  Pill,
  SubTabHeader,
  type PillTone,
} from "@/components/ui/clearing";
import { updateSocialHistoryAction } from "@/app/_actions/social-history";
import type { SocialHistory } from "@/app/_lib/db/drizzle/queries/social-history";
import { v4 as uuidv4 } from "uuid";

interface SocialHistoryContentProps {
  patientId: string;
  patientName: string;
  socialHistory: SocialHistory | null;
}

const socialHistorySchema = z.object({
  tobacco: z
    .object({
      status: z.enum(["Never", "Former", "Current"]).optional(),
      amount: z.string().optional(),
      years: z.string().optional(),
      quitDate: z.string().optional(),
    })
    .optional(),
  alcohol: z
    .object({
      status: z.enum(["Never", "Occasional", "Regular", "Former"]).optional(),
      frequency: z.string().optional(),
      amount: z.string().optional(),
    })
    .optional(),
  otherSubstances: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        notes: z.string().optional(),
      })
    )
    .optional(),
  occupation: z
    .object({
      title: z.string().optional(),
      description: z.string().optional(),
      hazards: z.string().optional(),
    })
    .optional(),
  livingSituation: z
    .object({
      status: z.enum(["Stable", "Unstable", "Homeless", "Other"]).optional(),
      description: z.string().optional(),
      household: z.string().optional(),
    })
    .optional(),
  lifestyle: z
    .object({
      activityLevel: z
        .enum(["Sedentary", "Light", "Moderate", "Active", "Very Active"])
        .optional(),
      dietQuality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      exerciseHabits: z.string().optional(),
      sleepHours: z.string().optional(),
      sleepQuality: z.enum(["Poor", "Fair", "Good", "Excellent"]).optional(),
      stressLevel: z
        .enum(["Low", "Moderate", "High", "Very High"])
        .optional(),
    })
    .optional(),
  psychosocial: z
    .object({
      socialSupport: z
        .enum(["Strong", "Moderate", "Limited", "None"])
        .optional(),
      financialStrain: z
        .enum(["Stable", "Moderate", "Significant", "Crisis"])
        .optional(),
      transportation: z.enum(["Accessible", "Limited", "None"]).optional(),
      notes: z.string().optional(),
    })
    .optional(),
  sexualHealth: z
    .object({
      status: z.string().optional(),
      partners: z.string().optional(),
      contraception: z.string().optional(),
      stiHistory: z.string().optional(),
    })
    .optional(),
  clinicianNotes: z.string().optional(),
});

type SocialHistoryFormData = z.infer<typeof socialHistorySchema>;
type LifestyleActivityLevel = NonNullable<SocialHistory["lifestyle"]>["activityLevel"];
type LifestyleDietQuality = NonNullable<SocialHistory["lifestyle"]>["dietQuality"];
type LifestyleSleepQuality = NonNullable<SocialHistory["lifestyle"]>["sleepQuality"];
type LifestyleStressLevel = NonNullable<SocialHistory["lifestyle"]>["stressLevel"];
type PsychosocialSocialSupport = NonNullable<SocialHistory["psychosocial"]>["socialSupport"];
type PsychosocialFinancialStrain = NonNullable<SocialHistory["psychosocial"]>["financialStrain"];
type PsychosocialTransportation = NonNullable<SocialHistory["psychosocial"]>["transportation"];

function tobaccoTone(status?: string): PillTone {
  if (status === "Current") return "critical";
  if (status === "Former") return "warn";
  if (status === "Never") return "ok";
  return "neutral";
}

function alcoholTone(status?: string): PillTone {
  if (status === "Regular") return "critical";
  if (status === "Occasional") return "warn";
  if (status === "Never") return "ok";
  if (status === "Former") return "info";
  return "neutral";
}

function housingTone(status?: string): PillTone {
  if (status === "Homeless" || status === "Unstable") return "critical";
  if (status === "Other") return "warn";
  if (status === "Stable") return "ok";
  return "neutral";
}

function supportTone(support?: string): PillTone {
  if (support === "None") return "critical";
  if (support === "Limited") return "warn";
  if (support === "Strong") return "ok";
  if (support === "Moderate") return "info";
  return "neutral";
}

function strainTone(s?: string): PillTone {
  if (s === "Crisis" || s === "Significant") return "critical";
  if (s === "Moderate") return "warn";
  if (s === "Stable") return "ok";
  return "neutral";
}

function transportTone(t?: string): PillTone {
  if (t === "None") return "critical";
  if (t === "Limited") return "warn";
  if (t === "Accessible") return "ok";
  return "neutral";
}

export function SocialHistoryContent({
  patientId,
  patientName,
  socialHistory: initialSocialHistory,
}: SocialHistoryContentProps) {
  const router = useRouter();
  const [socialHistory, setSocialHistory] = React.useState<SocialHistory | null>(
    initialSocialHistory
  );
  const [showUpdateModal, setShowUpdateModal] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("tobacco");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newSubstance, setNewSubstance] = React.useState({
    name: "",
    status: "",
    notes: "",
  });

  const form = useForm<SocialHistoryFormData>({
    resolver: zodResolver(socialHistorySchema),
    defaultValues: {
      tobacco: initialSocialHistory?.tobacco || { status: "Never" },
      alcohol: initialSocialHistory?.alcohol || { status: "Never" },
      otherSubstances: initialSocialHistory?.otherSubstances || [],
      occupation: initialSocialHistory?.occupation || {},
      livingSituation: initialSocialHistory?.livingSituation || {
        status: "Stable",
      },
      lifestyle: initialSocialHistory?.lifestyle || {},
      psychosocial: initialSocialHistory?.psychosocial || {},
      sexualHealth: initialSocialHistory?.sexualHealth || {},
      clinicianNotes: initialSocialHistory?.clinicianNotes || "",
    },
  });

  React.useEffect(() => {
    setSocialHistory(initialSocialHistory);
  }, [initialSocialHistory]);

  React.useEffect(() => {
    if (showUpdateModal && initialSocialHistory) {
      form.reset({
        tobacco: initialSocialHistory.tobacco || { status: "Never" },
        alcohol: initialSocialHistory.alcohol || { status: "Never" },
        otherSubstances: initialSocialHistory.otherSubstances || [],
        occupation: initialSocialHistory.occupation || {},
        livingSituation: initialSocialHistory.livingSituation || {
          status: "Stable",
        },
        lifestyle: initialSocialHistory.lifestyle || {},
        psychosocial: initialSocialHistory.psychosocial || {},
        sexualHealth: initialSocialHistory.sexualHealth || {},
        clinicianNotes: initialSocialHistory.clinicianNotes || "",
      });
    }
  }, [showUpdateModal, initialSocialHistory, form]);

  const handleSubmit = async (data: SocialHistoryFormData) => {
    setIsSubmitting(true);
    try {
      // Transform form data to match SocialHistory type requirements
      // Only include objects that have required fields
      const updates: Partial<SocialHistory> = {};

      if (data.tobacco?.status) {
        updates.tobacco = {
          status: data.tobacco.status,
          amount: data.tobacco.amount,
          years: data.tobacco.years,
          quitDate: data.tobacco.quitDate,
        };
      }

      if (data.alcohol?.status) {
        updates.alcohol = {
          status: data.alcohol.status,
          frequency: data.alcohol.frequency,
          amount: data.alcohol.amount,
        };
      }

      if (data.otherSubstances) {
        updates.otherSubstances = data.otherSubstances;
      }

      if (data.occupation) {
        updates.occupation = data.occupation;
      }

      if (data.livingSituation?.status) {
        updates.livingSituation = {
          status: data.livingSituation.status,
          description: data.livingSituation.description,
          household: data.livingSituation.household,
        };
      }

      if (data.lifestyle) {
        updates.lifestyle = data.lifestyle;
      }

      if (data.psychosocial) {
        updates.psychosocial = data.psychosocial;
      }

      if (data.sexualHealth) {
        updates.sexualHealth = data.sexualHealth;
      }

      if (data.clinicianNotes !== undefined) {
        updates.clinicianNotes = data.clinicianNotes;
      }

      await updateSocialHistoryAction(patientId, updates);
      setSocialHistory({
        ...(socialHistory || {}),
        ...updates,
        lastUpdated: new Date().toISOString(),
      });
      router.refresh();
      setShowUpdateModal(false);
      toast.success("Social history updated successfully");
    } catch (error) {
      console.error("Error updating social history:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update social history"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSubstance = () => {
    if (!newSubstance.name || !newSubstance.status) {
      toast.error("Name and status are required");
      return;
    }

    const current = form.getValues("otherSubstances") || [];
    form.setValue("otherSubstances", [
      ...current,
      {
        id: uuidv4(),
        name: newSubstance.name,
        status: newSubstance.status,
        notes: newSubstance.notes,
      },
    ]);

    setNewSubstance({ name: "", status: "", notes: "" });
  };

  const handleRemoveSubstance = (id: string) => {
    const current = form.getValues("otherSubstances") || [];
    form.setValue(
      "otherSubstances",
      current.filter((s) => s.id !== id)
    );
  };

  const getRiskFlagsCount = () => {
    let count = 0;
    if (socialHistory?.tobacco?.status === "Current") count++;
    if (socialHistory?.alcohol?.status === "Regular") count++;
    if (
      socialHistory?.livingSituation?.status === "Unstable" ||
      socialHistory?.livingSituation?.status === "Homeless"
    )
      count++;
    if (
      socialHistory?.psychosocial?.financialStrain === "Significant" ||
      socialHistory?.psychosocial?.financialStrain === "Crisis"
    )
      count++;
    return count;
  };

  const formatLastUpdated = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const riskFlags = getRiskFlagsCount();

  const summaryMetrics = [
    {
      k: "Risk flags",
      v: riskFlags,
      icon: Flag,
      tone: riskFlags > 0 ? "var(--critical)" : "var(--ok)",
    },
    {
      k: "Tobacco",
      v: socialHistory?.tobacco?.status || "—",
      icon: Cigarette,
      tone: "var(--ink-3)",
    },
    {
      k: "Alcohol",
      v: socialHistory?.alcohol?.status || "—",
      icon: Wine,
      tone: "var(--ink-3)",
    },
    {
      k: "Housing",
      v: socialHistory?.livingSituation?.status || "—",
      icon: Home,
      tone: "var(--ink-3)",
    },
    {
      k: "Last updated",
      v: formatLastUpdated(socialHistory?.lastUpdated),
      icon: CheckCircle2,
      tone: "var(--ink-3)",
    },
  ];

  // Helper: label / value row inside section cards
  const FieldRow = ({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) => (
    <div className="flex flex-col gap-1">
      <div
        className="text-[10.5px] uppercase"
        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
      >
        {label}
      </div>
      <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
        {children}
      </div>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <SubTabHeader
        eyebrow="Chart · Social history"
        title="Social history"
        subtitle={`Manage social history for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Pencil className="h-4 w-4" />}
            onClick={() => setShowUpdateModal(true)}
          >
            Update history
          </Btn>
        }
      />

      {/* Summary strip */}
      <div
        className="grid overflow-hidden rounded-2xl"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        {summaryMetrics.map((m, i, arr) => {
          const Icon = m.icon;
          return (
            <div
              key={m.k}
              className="flex flex-col gap-1.5 px-5 py-4"
              style={{
                borderRight: i < arr.length - 1 ? "1px solid var(--line)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                >
                  {m.k}
                </div>
                <Icon className="h-3.5 w-3.5" style={{ color: m.tone }} />
              </div>
              <div
                className="serif"
                style={{
                  fontSize: 28,
                  lineHeight: 0.95,
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                }}
              >
                {m.v}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main panels */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Substance use */}
        <ClearingCard>
          <div className="mb-4 flex items-center gap-2">
            <Beaker className="h-4 w-4" style={{ color: "var(--ink-2)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Substance use
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Tobacco / nicotine
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Pill tone={tobaccoTone(socialHistory?.tobacco?.status)} dot>
                  {socialHistory?.tobacco?.status || "Never"}
                </Pill>
                {socialHistory?.tobacco?.amount && (
                  <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                    {socialHistory.tobacco.amount}
                    {socialHistory.tobacco.years
                      ? ` · ${socialHistory.tobacco.years} yrs`
                      : ""}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Alcohol
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Pill tone={alcoholTone(socialHistory?.alcohol?.status)} dot>
                  {socialHistory?.alcohol?.status || "Never"}
                </Pill>
                {socialHistory?.alcohol?.frequency && (
                  <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                    {socialHistory.alcohol.frequency}
                    {socialHistory.alcohol.amount
                      ? ` · ${socialHistory.alcohol.amount}`
                      : ""}
                  </span>
                )}
              </div>
            </div>
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Other substances
              </div>
              {socialHistory?.otherSubstances &&
              socialHistory.otherSubstances.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {socialHistory.otherSubstances.map((s) => (
                    <Pill key={s.id} tone="neutral">
                      {s.name}
                      <span
                        className="mono ml-1 opacity-70"
                        style={{ fontSize: 10 }}
                      >
                        {s.status}
                      </span>
                    </Pill>
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                  None recorded
                </p>
              )}
            </div>
          </div>
        </ClearingCard>

        {/* Lifestyle factors */}
        <ClearingCard>
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" style={{ color: "var(--ink-2)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Lifestyle factors
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FieldRow label="Activity level">
              {socialHistory?.lifestyle?.activityLevel || "—"}
            </FieldRow>
            <FieldRow label="Diet quality">
              {socialHistory?.lifestyle?.dietQuality || "—"}
            </FieldRow>
            <FieldRow label="Sleep">
              {socialHistory?.lifestyle?.sleepQuality || "—"}
              {socialHistory?.lifestyle?.sleepHours
                ? ` · ${socialHistory.lifestyle.sleepHours} hrs`
                : ""}
            </FieldRow>
            <FieldRow label="Stress level">
              {socialHistory?.lifestyle?.stressLevel || "—"}
            </FieldRow>
            {socialHistory?.lifestyle?.exerciseHabits && (
              <div className="col-span-2">
                <FieldRow label="Exercise habits">
                  {socialHistory.lifestyle.exerciseHabits}
                </FieldRow>
              </div>
            )}
          </div>
        </ClearingCard>

        {/* Living & occupation */}
        <ClearingCard>
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4" style={{ color: "var(--ink-2)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Living & occupation
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <FieldRow label="Occupation">
              {socialHistory?.occupation?.title || "—"}
              {socialHistory?.occupation?.description && (
                <div className="mt-0.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
                  {socialHistory.occupation.description}
                </div>
              )}
            </FieldRow>
            {socialHistory?.occupation?.hazards && (
              <FieldRow label="Hazards">{socialHistory.occupation.hazards}</FieldRow>
            )}
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Living situation
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Pill tone={housingTone(socialHistory?.livingSituation?.status)} dot>
                  {socialHistory?.livingSituation?.status || "Stable"}
                </Pill>
                {socialHistory?.livingSituation?.description && (
                  <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                    {socialHistory.livingSituation.description}
                  </span>
                )}
              </div>
              {socialHistory?.livingSituation?.household && (
                <div
                  className="mt-1 text-[12px]"
                  style={{ color: "var(--ink-3)" }}
                >
                  Household: {socialHistory.livingSituation.household}
                </div>
              )}
            </div>
          </div>
        </ClearingCard>

        {/* Psychosocial & support */}
        <ClearingCard>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: "var(--ink-2)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Psychosocial & support
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Social support
              </div>
              <div className="mt-1.5">
                <Pill tone={supportTone(socialHistory?.psychosocial?.socialSupport)}>
                  {socialHistory?.psychosocial?.socialSupport || "—"}
                </Pill>
              </div>
            </div>
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Financial strain
              </div>
              <div className="mt-1.5">
                <Pill tone={strainTone(socialHistory?.psychosocial?.financialStrain)}>
                  {socialHistory?.psychosocial?.financialStrain || "—"}
                </Pill>
              </div>
            </div>
            <div>
              <div
                className="text-[10.5px] uppercase"
                style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
              >
                Transportation
              </div>
              <div className="mt-1.5">
                <Pill tone={transportTone(socialHistory?.psychosocial?.transportation)}>
                  {socialHistory?.psychosocial?.transportation || "—"}
                </Pill>
              </div>
            </div>
          </div>
          {socialHistory?.psychosocial?.notes && (
            <div className="mt-4">
              <FieldRow label="Notes">{socialHistory.psychosocial.notes}</FieldRow>
            </div>
          )}
        </ClearingCard>

        {/* Screening tools */}
        <ClearingCard>
          <div className="mb-4 flex items-center gap-2">
            <Clipboard className="h-4 w-4" style={{ color: "var(--ink-2)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Screening tools
            </div>
          </div>
          <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
            No screening tools recorded
          </p>
        </ClearingCard>

        {/* Sexual health (confidential) */}
        <ClearingCard accent="var(--brand-ink)">
          <div className="mb-1 flex items-center gap-2">
            <Heart className="h-4 w-4" style={{ color: "var(--brand-ink)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Sexual health
            </div>
          </div>
          <p
            className="mb-4 text-[11px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
          >
            Confidential · Provider view only
          </p>
          {socialHistory?.sexualHealth?.status ? (
            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Status">
                {socialHistory.sexualHealth.status}
              </FieldRow>
              {socialHistory.sexualHealth.partners && (
                <FieldRow label="Partners">
                  {socialHistory.sexualHealth.partners}
                </FieldRow>
              )}
              {socialHistory.sexualHealth.contraception && (
                <FieldRow label="Contraception">
                  {socialHistory.sexualHealth.contraception}
                </FieldRow>
              )}
              {socialHistory.sexualHealth.stiHistory && (
                <FieldRow label="STI history">
                  {socialHistory.sexualHealth.stiHistory}
                </FieldRow>
              )}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No sexual health information recorded.
            </p>
          )}
        </ClearingCard>

        {/* Clinician notes */}
        <ClearingCard className="md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: "var(--ink-2)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Clinician notes
            </div>
          </div>
          {socialHistory?.clinicianNotes ? (
            <p
              className="text-[13px] leading-5"
              style={{ color: "var(--ink-2)", whiteSpace: "pre-wrap" }}
            >
              {socialHistory.clinicianNotes}
            </p>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No clinician notes
            </p>
          )}
        </ClearingCard>
      </div>

      {/* Update Social History Modal */}
      <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Update social history</DialogTitle>
            <DialogDescription>
              Enter patient social history information.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="tobacco">Tobacco</TabsTrigger>
                <TabsTrigger value="alcohol">Alcohol</TabsTrigger>
                <TabsTrigger value="occupation">Occupation</TabsTrigger>
                <TabsTrigger value="lifestyle">Lifestyle</TabsTrigger>
                <TabsTrigger value="psychosocial">Psychosocial</TabsTrigger>
                <TabsTrigger value="sexual">Sexual</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
              </TabsList>

              {/* Tobacco Tab */}
              <TabsContent value="tobacco" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>
                    Status <span style={{ color: "var(--critical)" }}>*</span>
                  </Label>
                  <Select
                    value={form.watch("tobacco.status") || "Never"}
                    onValueChange={(value) =>
                      form.setValue("tobacco.status", value as "Never" | "Former" | "Current")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Never">Never</SelectItem>
                      <SelectItem value="Former">Former</SelectItem>
                      <SelectItem value="Current">Current</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.watch("tobacco.status") === "Current" && (
                  <>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        placeholder="e.g., 1 pack/day"
                        {...form.register("tobacco.amount")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Years</Label>
                      <Input
                        placeholder="e.g., 10"
                        {...form.register("tobacco.years")}
                      />
                    </div>
                  </>
                )}
                {form.watch("tobacco.status") === "Former" && (
                  <div className="space-y-2">
                    <Label>Quit date</Label>
                    <Input type="date" {...form.register("tobacco.quitDate")} />
                  </div>
                )}
              </TabsContent>

              {/* Alcohol Tab */}
              <TabsContent value="alcohol" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>
                    Status <span style={{ color: "var(--critical)" }}>*</span>
                  </Label>
                  <Select
                    value={form.watch("alcohol.status") || "Never"}
                    onValueChange={(value) =>
                      form.setValue(
                        "alcohol.status",
                        value as "Never" | "Occasional" | "Regular" | "Former"
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Never">Never</SelectItem>
                      <SelectItem value="Occasional">Occasional</SelectItem>
                      <SelectItem value="Regular">Regular</SelectItem>
                      <SelectItem value="Former">Former</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.watch("alcohol.status") !== "Never" && (
                  <>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Input
                        placeholder="e.g., 2-3 times/week"
                        {...form.register("alcohol.frequency")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        placeholder="e.g., 1-2 drinks"
                        {...form.register("alcohol.amount")}
                      />
                    </div>
                  </>
                )}
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label>Other substances</Label>
                    <div className="space-y-2">
                      {(form.watch("otherSubstances") || []).map((substance) => (
                        <div
                          key={substance.id}
                          className="flex items-center gap-2 rounded-[10px] p-3"
                          style={{
                            border: "1px solid var(--line)",
                            background: "var(--paper-2)",
                          }}
                        >
                          <div className="flex-1">
                            <p
                              className="text-[13px] font-medium"
                              style={{ color: "var(--ink)" }}
                            >
                              {substance.name}
                            </p>
                            <p
                              className="text-[12px]"
                              style={{ color: "var(--ink-3)" }}
                            >
                              {substance.status}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubstance(substance.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                            style={{ color: "var(--critical)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "var(--critical-soft)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "transparent";
                            }}
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    className="space-y-2 rounded-[10px] p-4"
                    style={{ border: "1px solid var(--line)", background: "var(--paper-2)" }}
                  >
                    <Label className="text-sm font-semibold">Add new substance</Label>
                    <div className="space-y-2">
                      <Input
                        placeholder="e.g., Marijuana"
                        value={newSubstance.name}
                        onChange={(e) =>
                          setNewSubstance({ ...newSubstance, name: e.target.value })
                        }
                      />
                      <Input
                        placeholder="e.g., Occasional, Regular, Former"
                        value={newSubstance.status}
                        onChange={(e) =>
                          setNewSubstance({ ...newSubstance, status: e.target.value })
                        }
                      />
                      <Textarea
                        placeholder="Additional notes..."
                        value={newSubstance.notes}
                        onChange={(e) =>
                          setNewSubstance({ ...newSubstance, notes: e.target.value })
                        }
                        rows={2}
                      />
                      <Btn
                        kind="ghost"
                        type="button"
                        icon={<Plus className="h-3.5 w-3.5" />}
                        onClick={handleAddSubstance}
                      >
                        Add substance
                      </Btn>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Occupation Tab */}
              <TabsContent value="occupation" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Occupation title</Label>
                    <Input
                      placeholder="e.g., Logistics Manager"
                      {...form.register("occupation.title")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Shift work, hazards, etc..."
                      {...form.register("occupation.description")}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hazards / risks</Label>
                    <Input
                      placeholder="e.g., Heavy lifting, noise exposure"
                      {...form.register("occupation.hazards")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Living situation status</Label>
                    <Select
                      value={form.watch("livingSituation.status") || "Stable"}
                      onValueChange={(value) =>
                        form.setValue(
                          "livingSituation.status",
                          value as "Stable" | "Unstable" | "Homeless" | "Other"
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Stable">Stable</SelectItem>
                        <SelectItem value="Unstable">Unstable</SelectItem>
                        <SelectItem value="Homeless">Homeless</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="e.g., Apartment"
                      {...form.register("livingSituation.description")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Household</Label>
                    <Input
                      placeholder="e.g., Spouse + 1 Child"
                      {...form.register("livingSituation.household")}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Lifestyle Tab */}
              <TabsContent value="lifestyle" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Activity level</Label>
                    <Select
                      value={form.watch("lifestyle.activityLevel") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "lifestyle.activityLevel",
                          value as LifestyleActivityLevel
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Sedentary">Sedentary</SelectItem>
                        <SelectItem value="Light">Light</SelectItem>
                        <SelectItem value="Moderate">Moderate</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Very Active">Very Active</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Diet quality</Label>
                    <Select
                      value={form.watch("lifestyle.dietQuality") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "lifestyle.dietQuality",
                          value as LifestyleDietQuality
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Poor">Poor</SelectItem>
                        <SelectItem value="Fair">Fair</SelectItem>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Excellent">Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Exercise habits</Label>
                    <Input
                      placeholder="e.g., Gym 1x/week, walks dog occasionally"
                      {...form.register("lifestyle.exerciseHabits")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sleep hours</Label>
                    <Input placeholder="e.g., 7" {...form.register("lifestyle.sleepHours")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sleep quality</Label>
                    <Select
                      value={form.watch("lifestyle.sleepQuality") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "lifestyle.sleepQuality",
                          value as LifestyleSleepQuality
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Poor">Poor</SelectItem>
                        <SelectItem value="Fair">Fair</SelectItem>
                        <SelectItem value="Good">Good</SelectItem>
                        <SelectItem value="Excellent">Excellent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stress level</Label>
                    <Select
                      value={form.watch("lifestyle.stressLevel") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "lifestyle.stressLevel",
                          value as LifestyleStressLevel
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Moderate">Moderate</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Very High">Very High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              {/* Psychosocial Tab */}
              <TabsContent value="psychosocial" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Social support</Label>
                    <Select
                      value={form.watch("psychosocial.socialSupport") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "psychosocial.socialSupport",
                          value as PsychosocialSocialSupport
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Strong">Strong</SelectItem>
                        <SelectItem value="Moderate">Moderate</SelectItem>
                        <SelectItem value="Limited">Limited</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Financial strain</Label>
                    <Select
                      value={form.watch("psychosocial.financialStrain") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "psychosocial.financialStrain",
                          value as PsychosocialFinancialStrain
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Stable">Stable</SelectItem>
                        <SelectItem value="Moderate">Moderate</SelectItem>
                        <SelectItem value="Significant">Significant</SelectItem>
                        <SelectItem value="Crisis">Crisis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transportation</Label>
                    <Select
                      value={form.watch("psychosocial.transportation") || ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "psychosocial.transportation",
                          value as PsychosocialTransportation
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Accessible">Accessible</SelectItem>
                        <SelectItem value="Limited">Limited</SelectItem>
                        <SelectItem value="None">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Notes</Label>
                  <Textarea
                    placeholder="Additional psychosocial notes..."
                    {...form.register("psychosocial.notes")}
                    rows={4}
                  />
                </div>
              </TabsContent>

              {/* Sexual Health Tab */}
              <TabsContent value="sexual" className="space-y-4 mt-4">
                <p
                  className="text-[11px] uppercase"
                  style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                >
                  Confidential · Provider view only
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.watch("sexualHealth.status") || ""}
                      onValueChange={(value) =>
                        form.setValue("sexualHealth.status", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Not Applicable">Not Applicable</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Partners</Label>
                    <Input
                      placeholder="e.g., Male (1 steady)"
                      {...form.register("sexualHealth.partners")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraception</Label>
                    <Input
                      placeholder="e.g., IUD (Mirena)"
                      {...form.register("sexualHealth.contraception")}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>STI history</Label>
                    <Input
                      placeholder="e.g., Negative"
                      {...form.register("sexualHealth.stiHistory")}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Clinician notes</Label>
                  <Textarea
                    placeholder="Enter clinician notes..."
                    {...form.register("clinicianNotes")}
                    rows={8}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Btn
                kind="ghost"
                type="button"
                onClick={() => setShowUpdateModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save changes"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
