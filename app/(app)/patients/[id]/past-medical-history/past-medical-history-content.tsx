"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Shield,
  Brain,
  RefreshCw,
  Check,
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
import { Btn, ClearingCard, Pill, type PillTone } from "@/components/ui/clearing";
import {
  addPastMedicalHistoryEntryAction,
  updatePastMedicalHistoryEntryAction,
  deletePastMedicalHistoryEntryAction,
  setNoSignificantPMHAction,
  verifyPastMedicalHistoryEntryAction,
  verifyAllPastMedicalHistoryEntriesAction,
} from "@/app/_actions/past-medical-history";
import type {
  PastMedicalHistoryEntry,
  PastMedicalHistoryData,
} from "@/app/_lib/db/drizzle/queries/past-medical-history";
import { cn } from "@/app/_lib/utils/cn";

const pmhEntrySchema = z.object({
  condition: z.string().min(1, "Condition is required"),
  status: z.enum(["Active", "Resolved", "Chronic", "Inactive"]),
  diagnosedDate: z.string().optional(),
  impact: z.enum(["High", "Moderate", "Low"]).optional(),
  icd10: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

type PMHEntryFormData = z.infer<typeof pmhEntrySchema>;

interface PastMedicalHistoryContentProps {
  patientId: string;
  patientName: string;
  pastMedicalHistory: PastMedicalHistoryData;
}

type FilterType = "all" | "active" | "resolved";

function statusTone(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case "Active":
      return { tone: "critical", label: "Active" };
    case "Chronic":
      return { tone: "warn", label: "Chronic" };
    case "Resolved":
      return { tone: "ok", label: "Resolved" };
    case "Inactive":
      return { tone: "neutral", label: "Inactive" };
    default:
      return { tone: "neutral", label: status };
  }
}

function impactTone(impact?: string): { tone: PillTone; label: string } | null {
  switch (impact) {
    case "High":
      return { tone: "critical", label: "High" };
    case "Moderate":
      return { tone: "warn", label: "Moderate" };
    case "Low":
      return { tone: "ok", label: "Low" };
    default:
      return null;
  }
}

export function PastMedicalHistoryContent({
  patientId,
  patientName,
  pastMedicalHistory: initialPMH,
}: PastMedicalHistoryContentProps) {
  const [pmh] = React.useState<PastMedicalHistoryData>(initialPMH);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<PastMedicalHistoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterType>("all");
  const [isSettingNoPMH, setIsSettingNoPMH] = React.useState(false);

  const form = useForm<PMHEntryFormData>({
    resolver: zodResolver(pmhEntrySchema),
    defaultValues: {
      condition: "",
      status: "Active",
      diagnosedDate: "",
      impact: "Moderate",
      icd10: "",
      source: "",
      notes: "",
    },
  });

  React.useEffect(() => {
    if (showAddModal && !editingEntry) {
      form.reset({
        condition: "",
        status: "Active",
        diagnosedDate: "",
        impact: "Moderate",
        icd10: "",
        source: "",
        notes: "",
      });
    } else if (editingEntry) {
      form.reset({
        condition: editingEntry.condition || "",
        status: (editingEntry.status as "Active" | "Resolved" | "Chronic" | "Inactive") || "Active",
        diagnosedDate: editingEntry.diagnosedDate || "",
        impact: (editingEntry.impact as "High" | "Moderate" | "Low") || "Moderate",
        icd10: editingEntry.icd10 || "",
        source: editingEntry.source || "",
        notes: editingEntry.notes || "",
      });
    }
  }, [showAddModal, editingEntry, form]);

  const handleSubmit = async (data: PMHEntryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingEntry) {
        await updatePastMedicalHistoryEntryAction(patientId, editingEntry.id, data);
        toast.success("Condition updated successfully");
      } else {
        await addPastMedicalHistoryEntryAction(patientId, data);
        toast.success("Condition added successfully");
      }
      window.location.reload();
    } catch (error) {
      console.error("Error saving condition:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save condition");
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingEntry(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this condition?")) return;
    setDeletingId(entryId);
    try {
      await deletePastMedicalHistoryEntryAction(patientId, entryId);
      toast.success("Condition deleted successfully");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting condition:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete condition");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (entry: PastMedicalHistoryEntry) => {
    setEditingEntry(entry);
    setShowAddModal(true);
  };

  const handleSetNoSignificantPMH = async () => {
    if (pmh.entries.length > 0 && !pmh.noSignificantPMH) {
      if (!confirm("Setting 'No Significant PMH' will mark all existing entries as inactive. Continue?")) return;
    }
    setIsSettingNoPMH(true);
    try {
      await setNoSignificantPMHAction(patientId, !pmh.noSignificantPMH);
      toast.success(pmh.noSignificantPMH ? "No Significant PMH flag removed" : "No Significant PMH flag set");
      window.location.reload();
    } catch (error) {
      console.error("Error setting no significant PMH:", error);
      toast.error("Failed to update flag");
    } finally {
      setIsSettingNoPMH(false);
    }
  };

  const handleVerify = async (entryId: string) => {
    try {
      await verifyPastMedicalHistoryEntryAction(patientId, entryId);
      toast.success("Condition verified");
      window.location.reload();
    } catch (error) {
      console.error("Error verifying condition:", error);
      toast.error("Failed to verify condition");
    }
  };

  const handleVerifyAll = async () => {
    if (!confirm("Verify all conditions?")) return;
    try {
      await verifyAllPastMedicalHistoryEntriesAction(patientId);
      toast.success("All conditions verified");
      window.location.reload();
    } catch (error) {
      console.error("Error verifying all conditions:", error);
      toast.error("Failed to verify conditions");
    }
  };

  const totalConditions = pmh.entries.length;
  const activeChronic = pmh.entries.filter(
    (e) => e.status === "Active" || e.status === "Chronic"
  ).length;
  const highImpact = pmh.entries.filter((e) => e.impact === "High").length;

  const filteredEntries = React.useMemo(() => {
    if (filter === "active") {
      return pmh.entries.filter((e) => e.status === "Active" || e.status === "Chronic");
    }
    if (filter === "resolved") {
      return pmh.entries.filter((e) => e.status === "Resolved");
    }
    return pmh.entries;
  }, [pmh.entries, filter]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getVerificationStatus = (entry: PastMedicalHistoryEntry) => {
    if (!entry.verified) {
      return { status: "Needs verification", icon: Clock, tone: "warn" as const };
    }
    if (entry.verifiedDate) {
      const verifiedDate = new Date(entry.verifiedDate);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return { status: "Verified today", icon: CheckCircle2, tone: "ok" as const };
      return { status: `Verified ${diffDays} day${diffDays > 1 ? "s" : ""} ago`, icon: CheckCircle2, tone: "ok" as const };
    }
    return { status: "Verified", icon: CheckCircle2, tone: "ok" as const };
  };

  const summaryMetrics = [
    { k: "Total conditions", v: totalConditions, icon: FileText, tone: "var(--ink-3)" as const },
    { k: "Active chronic", v: activeChronic, icon: Clock, tone: "var(--ink-3)" as const },
    { k: "High impact", v: highImpact, icon: AlertCircle, tone: "var(--critical)" as const },
    {
      k: "Last updated",
      v: pmh.lastUpdated ? formatDate(pmh.lastUpdated) : "—",
      icon: RefreshCw,
      tone: "var(--ink-3)" as const,
    },
  ];

  const filterTabs: Array<[FilterType, string, number]> = [
    ["all", "All", totalConditions],
    ["active", "Active", activeChronic],
    ["resolved", "Resolved", totalConditions - activeChronic],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div
            className="text-[11.5px] uppercase"
            style={{ color: "var(--ink-3)", letterSpacing: "0.12em" }}
          >
            Chart · Past medical history
          </div>
          <h1
            className="serif mt-1.5"
            style={{
              fontSize: "clamp(28px, 3.5vw, 36px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Past medical history
          </h1>
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            Manage past medical history for {patientName}.
          </p>
        </div>
        <div className="flex-1" />
        <div className="flex gap-2">
          <Btn
            kind={pmh.noSignificantPMH ? "primary" : "ghost"}
            icon={<Check className="h-4 w-4" />}
            onClick={handleSetNoSignificantPMH}
            disabled={isSettingNoPMH}
          >
            {pmh.noSignificantPMH ? "No significant PMH" : "Mark no significant PMH"}
          </Btn>
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddModal(true)}
            disabled={pmh.noSignificantPMH}
          >
            Add condition
          </Btn>
        </div>
      </div>

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
              style={{ borderRight: i < arr.length - 1 ? "1px solid var(--line)" : undefined }}
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
                  fontSize: 32,
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

      {/* No significant PMH notice */}
      {pmh.noSignificantPMH && (
        <div
          className="flex items-center gap-2.5 rounded-xl px-4 py-3"
          style={{
            background: "var(--ok-soft)",
            border: "1px solid transparent",
            color: "var(--ok)",
          }}
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <p className="text-[13px] font-medium">
            No significant past medical history recorded for this patient.
          </p>
        </div>
      )}

      {/* Medical Conditions */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div className="serif" style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}>
            Medical conditions
          </div>
          <div className="flex-1" />
          <div
            className="flex gap-1 rounded-full p-1"
            style={{ border: "1px solid var(--line)", background: "var(--paper-2)" }}
          >
            {filterTabs.map(([k, label, n]) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className="h-7 rounded-full px-3.5 text-[12.5px] font-medium tracking-tight transition-colors"
                  style={{
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--ink-2)",
                  }}
                >
                  {label} <span className="mono ml-1 opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              {filter === "all" ? "No conditions recorded" : `No ${filter} conditions found`}
            </p>
            {filter === "all" && !pmh.noSignificantPMH && (
              <Btn
                kind="soft"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAddModal(true)}
              >
                Add first condition
              </Btn>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Condition", "Status", "Date", "Impact", "Source", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-2.5 text-left text-[10.5px] font-medium uppercase"
                      style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry, i, arr) => {
                  const st = statusTone(entry.status);
                  const imp = impactTone(entry.impact);
                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "var(--paper-2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                      }}
                    >
                      <td className="px-5 py-3">
                        <div className="text-[13.5px] font-medium" style={{ color: "var(--ink)" }}>
                          {entry.condition}
                        </div>
                        {entry.icd10 && (
                          <div className="mono mt-0.5 text-[10.5px]" style={{ color: "var(--ink-3)" }}>
                            ICD-10 · {entry.icd10}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={st.tone} dot>
                          {st.label}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {formatDate(entry.diagnosedDate)}
                      </td>
                      <td className="px-5 py-3">
                        {imp ? (
                          <Pill tone={imp.tone}>{imp.label}</Pill>
                        ) : (
                          <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                        {entry.source || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(entry)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                            style={{ color: "var(--ink-2)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "var(--paper-3)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            }}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-50"
                            style={{ color: "var(--critical)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "var(--critical-soft)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                            }}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ClearingCard>

      {/* Clinical intelligence + Verification */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ClearingCard>
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4" style={{ color: "var(--info)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Clinical intelligence
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {highImpact > 0 && (
              <div
                className="rounded-[10px] p-3"
                style={{
                  background: "var(--info-soft)",
                  border: "1px solid transparent",
                }}
              >
                <p className="text-[12.5px] leading-5" style={{ color: "var(--ink-2)" }}>
                  Patient has multiple cardiovascular risk factors. Consider comprehensive risk
                  assessment.
                </p>
                <button
                  type="button"
                  className="mt-2 text-[12px] font-medium"
                  style={{ color: "var(--info)" }}
                >
                  View risk calculator →
                </button>
              </div>
            )}
            {activeChronic > 0 && (
              <div
                className="rounded-[10px] p-3"
                style={{
                  background: "var(--ok-soft)",
                  border: "1px solid transparent",
                }}
              >
                <p className="text-[12.5px] leading-5" style={{ color: "var(--ink-2)" }}>
                  Chronic conditions management appears coordinated. Review care team assignments.
                </p>
                <button
                  type="button"
                  className="mt-2 text-[12px] font-medium"
                  style={{ color: "var(--ok)" }}
                >
                  View care team →
                </button>
              </div>
            )}
            {highImpact === 0 && activeChronic === 0 && (
              <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                No specific insights at this time.
              </p>
            )}
          </div>
        </ClearingCard>

        <ClearingCard>
          <div className="mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" style={{ color: "var(--warn)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Verification status
            </div>
            <div className="flex-1" />
            {filteredEntries.some((e) => !e.verified) && (
              <Btn kind="ghost" size="sm" onClick={handleVerifyAll}>
                Verify all
              </Btn>
            )}
          </div>

          {filteredEntries.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No conditions to verify
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {filteredEntries.map((entry) => {
                const verification = getVerificationStatus(entry);
                const Icon = verification.icon;
                const bg =
                  verification.tone === "warn" ? "var(--warn-soft)" : "var(--paper-2)";
                const iconColor =
                  verification.tone === "warn" ? "oklch(0.5 0.12 70)" : "var(--ok)";
                const textColor =
                  verification.tone === "warn" ? "oklch(0.5 0.12 70)" : "var(--ok)";
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5"
                    style={{ background: bg, border: "1px solid var(--line)" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" style={{ color: iconColor }} />
                      <div className="leading-tight">
                        <p className="text-[12.5px] font-medium" style={{ color: "var(--ink)" }}>
                          {entry.condition}
                        </p>
                        <p className="text-[11px]" style={{ color: textColor }}>
                          {verification.status}
                        </p>
                      </div>
                    </div>
                    {!entry.verified && (
                      <Btn kind="ghost" size="sm" onClick={() => handleVerify(entry.id)}>
                        Verify
                      </Btn>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ClearingCard>
      </div>

      {/* Add/Edit Condition Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingEntry(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEntry ? "Edit condition" : "Add condition"}</DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update condition information"
                : "Record a new past medical history condition."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="condition">
                Condition <span style={{ color: "var(--critical)" }}>*</span>
              </Label>
              <Input
                id="condition"
                placeholder="e.g., Type 2 Diabetes Mellitus"
                {...form.register("condition")}
                className={cn(form.formState.errors.condition && "border-destructive")}
              />
              {form.formState.errors.condition && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {form.formState.errors.condition.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as "Active" | "Resolved" | "Chronic" | "Inactive")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Chronic">Chronic</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnosedDate">Date diagnosed</Label>
                <Input id="diagnosedDate" type="date" {...form.register("diagnosedDate")} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="impact">Impact</Label>
                <Select
                  value={form.watch("impact") || "Moderate"}
                  onValueChange={(value) =>
                    form.setValue("impact", value as "High" | "Moderate" | "Low")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="icd10">ICD-10 code</Label>
                <Input id="icd10" placeholder="e.g., E11.9" {...form.register("icd10")} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="e.g., Patient reported, Medical records"
                {...form.register("source")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" placeholder="Additional notes..." rows={3} {...form.register("notes")} />
            </div>

            <DialogFooter>
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingEntry
                  ? "Update condition"
                  : "Save condition"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
