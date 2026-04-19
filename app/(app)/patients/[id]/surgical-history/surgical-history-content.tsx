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
  Search,
  Scissors,
  Calendar,
  AlertCircle,
  RefreshCw,
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
import {
  Btn,
  ClearingCard,
  Pill,
  SubTabHeader,
  type PillTone,
} from "@/components/ui/clearing";
import {
  addSurgicalHistoryAction,
  updateSurgicalHistoryAction,
  deleteSurgicalHistoryAction,
} from "@/app/_actions/surgical-history";
import type { SurgicalHistoryEntry } from "@/app/_lib/db/drizzle/queries/surgical-history";

const surgicalHistorySchema = z.object({
  procedure: z.string().min(1, "Procedure is required"),
  date: z.string().optional(),
  laterality: z.enum(["Left", "Right", "Bilateral", "N/A"]).optional(),
  site: z.string().optional(),
  surgeon: z.string().optional(),
  hospital: z.string().optional(),
  outcome: z.string().optional(),
  complications: z.string().optional(),
  source: z.enum(["Patient Reported", "Medical Records", "Other"]),
  notes: z.string().optional(),
});

type SurgicalHistoryFormData = z.infer<typeof surgicalHistorySchema>;

interface SurgicalHistoryContentProps {
  patientId: string;
  patientName: string;
  surgicalHistory: SurgicalHistoryEntry[];
}

type FilterType = "all" | "recent" | "complications";

const COMMON_PROCEDURES = [
  "Appendectomy",
  "Cholecystectomy",
  "Hernia Repair",
  "Knee Replacement",
  "Hip Replacement",
  "Cataract Surgery",
  "C-Section",
  "Tonsillectomy",
  "Gallbladder Removal",
  "Hysterectomy",
];

function sourceTone(source: string): { tone: PillTone; label: string } {
  switch (source) {
    case "Medical Records":
      return { tone: "info", label: "Medical records" };
    case "Patient Reported":
      return { tone: "neutral", label: "Patient reported" };
    default:
      return { tone: "neutral", label: source };
  }
}

export function SurgicalHistoryContent({
  patientId,
  patientName,
  surgicalHistory: initialSurgicalHistory,
}: SurgicalHistoryContentProps) {
  const [surgicalHistory] = React.useState<SurgicalHistoryEntry[]>(
    initialSurgicalHistory
  );
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingEntry, setEditingEntry] =
    React.useState<SurgicalHistoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [procedureSearch, setProcedureSearch] = React.useState("");
  const [filter, setFilter] = React.useState<FilterType>("all");

  const form = useForm<SurgicalHistoryFormData>({
    resolver: zodResolver(surgicalHistorySchema),
    defaultValues: {
      procedure: "",
      date: "",
      laterality: "N/A",
      site: "",
      surgeon: "",
      hospital: "",
      outcome: "",
      complications: "",
      source: "Patient Reported",
      notes: "",
    },
  });

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingEntry) {
      form.reset({
        procedure: "",
        date: "",
        laterality: "N/A",
        site: "",
        surgeon: "",
        hospital: "",
        outcome: "",
        complications: "",
        source: "Patient Reported",
        notes: "",
      });
      setProcedureSearch("");
    } else if (editingEntry) {
      form.reset({
        procedure: editingEntry.procedure,
        date: editingEntry.date || "",
        laterality: editingEntry.laterality || "N/A",
        site: editingEntry.site || "",
        surgeon: editingEntry.surgeon || "",
        hospital: editingEntry.hospital || "",
        outcome: editingEntry.outcome || "",
        complications: editingEntry.complications || "",
        source: editingEntry.source,
        notes: editingEntry.notes || "",
      });
      setProcedureSearch(editingEntry.procedure);
    }
  }, [showAddModal, editingEntry, form]);

  const handleSubmit = async (data: SurgicalHistoryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingEntry) {
        await updateSurgicalHistoryAction(patientId, editingEntry.id, data);
        toast.success("Surgical history updated successfully");
      } else {
        await addSurgicalHistoryAction(patientId, data);
        toast.success("Surgical history added successfully");
      }

      window.location.reload();
    } catch (error) {
      console.error("Error saving surgical history:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save surgical history"
      );
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingEntry(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this surgical history entry?")) {
      return;
    }

    setDeletingId(entryId);
    try {
      await deleteSurgicalHistoryAction(patientId, entryId);
      toast.success("Surgical history deleted successfully");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting surgical history:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete surgical history"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (entry: SurgicalHistoryEntry) => {
    setEditingEntry(entry);
    setShowAddModal(true);
  };

  const handleProcedureSelect = (procedure: string) => {
    form.setValue("procedure", procedure);
    setProcedureSearch(procedure);
  };

  const filteredProcedures = COMMON_PROCEDURES.filter((p) =>
    p.toLowerCase().includes(procedureSearch.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    // If it's just a year (YYYY), return as is
    if (/^\d{4}$/.test(dateString)) {
      return dateString;
    }
    // Otherwise try to format as date
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const totalProcedures = surgicalHistory.length;
  const complicationsCount = surgicalHistory.filter(
    (e) => e.complications && e.complications.trim().length > 0
  ).length;
  const recentCount = React.useMemo(() => {
    const now = new Date();
    const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    return surgicalHistory.filter((e) => {
      if (!e.date) return false;
      if (/^\d{4}$/.test(e.date)) {
        return Number(e.date) >= fiveYearsAgo.getFullYear();
      }
      const d = new Date(e.date);
      return !isNaN(d.getTime()) && d >= fiveYearsAgo;
    }).length;
  }, [surgicalHistory]);
  const latestDate = React.useMemo(() => {
    const dated = surgicalHistory
      .map((e) => e.date)
      .filter(Boolean) as string[];
    if (dated.length === 0) return "—";
    const parsed = dated
      .map((d) => {
        if (/^\d{4}$/.test(d)) return { d, t: new Date(`${d}-01-01`).getTime() };
        const t = new Date(d).getTime();
        return { d, t };
      })
      .filter((x) => !isNaN(x.t))
      .sort((a, b) => b.t - a.t);
    return parsed.length > 0 ? formatDate(parsed[0].d) : "—";
  }, [surgicalHistory]);

  const filteredEntries = React.useMemo(() => {
    if (filter === "recent") {
      const now = new Date();
      const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
      return surgicalHistory.filter((e) => {
        if (!e.date) return false;
        if (/^\d{4}$/.test(e.date)) {
          return Number(e.date) >= fiveYearsAgo.getFullYear();
        }
        const d = new Date(e.date);
        return !isNaN(d.getTime()) && d >= fiveYearsAgo;
      });
    }
    if (filter === "complications") {
      return surgicalHistory.filter(
        (e) => e.complications && e.complications.trim().length > 0
      );
    }
    return surgicalHistory;
  }, [surgicalHistory, filter]);

  const summaryMetrics = [
    {
      k: "Total procedures",
      v: totalProcedures,
      icon: Scissors,
      tone: "var(--ink-3)",
    },
    { k: "Last 5 years", v: recentCount, icon: Calendar, tone: "var(--ink-3)" },
    {
      k: "With complications",
      v: complicationsCount,
      icon: AlertCircle,
      tone: complicationsCount > 0 ? "var(--critical)" : "var(--ink-3)",
    },
    { k: "Most recent", v: latestDate, icon: RefreshCw, tone: "var(--ink-3)" },
  ];

  const filterTabs: Array<[FilterType, string, number]> = [
    ["all", "All", totalProcedures],
    ["recent", "Recent", recentCount],
    ["complications", "With complications", complicationsCount],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <SubTabHeader
        eyebrow="Chart · Surgical history"
        title="Surgical history"
        subtitle={`Manage surgical history for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add surgery
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

      {/* Procedures */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Procedures
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
              {filter === "all"
                ? "No surgical history recorded"
                : `No ${filter === "recent" ? "recent" : "complicated"} surgeries found`}
            </p>
            {filter === "all" && (
              <Btn
                kind="soft"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAddModal(true)}
              >
                Add first entry
              </Btn>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {[
                    "Procedure",
                    "Date",
                    "Laterality",
                    "Surgeon",
                    "Source",
                    "Complications",
                    "Actions",
                  ].map((h) => (
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
                  const src = sourceTone(entry.source);
                  const hasComplications =
                    entry.complications && entry.complications.trim().length > 0;
                  return (
                    <tr
                      key={entry.id}
                      style={{
                        borderBottom:
                          i < arr.length - 1 ? "1px solid var(--line)" : undefined,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          "var(--paper-2)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLTableRowElement).style.background =
                          "transparent";
                      }}
                    >
                      <td className="px-5 py-3">
                        <div
                          className="text-[13.5px] font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {entry.procedure}
                        </div>
                        {(entry.site || entry.hospital) && (
                          <div
                            className="mt-0.5 text-[11.5px]"
                            style={{ color: "var(--ink-3)" }}
                          >
                            {[entry.site, entry.hospital].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-5 py-3">
                        {entry.laterality && entry.laterality !== "N/A" ? (
                          <Pill tone="neutral">{entry.laterality}</Pill>
                        ) : (
                          <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                            —
                          </span>
                        )}
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {entry.surgeon || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={src.tone}>{src.label}</Pill>
                      </td>
                      <td className="px-5 py-3">
                        {hasComplications ? (
                          <Pill tone="critical" dot>
                            {entry.complications}
                          </Pill>
                        ) : (
                          <Pill tone="ok">None</Pill>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(entry)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                            style={{ color: "var(--ink-2)" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "var(--paper-3)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "transparent";
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
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "var(--critical-soft)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.background =
                                "transparent";
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

      {/* Outcome/Notes detail panel - expanded details for entries with notes/outcome */}
      {filteredEntries.some((e) => e.outcome || e.notes) && (
        <ClearingCard>
          <div className="mb-3 flex items-center gap-2">
            <Scissors className="h-4 w-4" style={{ color: "var(--info)" }} />
            <div className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>
              Procedure notes
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {filteredEntries
              .filter((e) => e.outcome || e.notes)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-[10px] p-3"
                  style={{
                    background: "var(--paper-2)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    className="text-[12.5px] font-medium"
                    style={{ color: "var(--ink)" }}
                  >
                    {entry.procedure}
                    <span
                      className="mono ml-2 text-[11px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {formatDate(entry.date)}
                    </span>
                  </div>
                  {entry.outcome && (
                    <div className="mt-1.5">
                      <div
                        className="text-[10.5px] uppercase"
                        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                      >
                        Outcome
                      </div>
                      <div
                        className="mt-0.5 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {entry.outcome}
                      </div>
                    </div>
                  )}
                  {entry.notes && (
                    <div className="mt-1.5">
                      <div
                        className="text-[10.5px] uppercase"
                        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                      >
                        Notes
                      </div>
                      <div
                        className="mt-0.5 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {entry.notes}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </ClearingCard>
      )}

      {/* Add/Edit Surgical History Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingEntry(null);
            form.reset();
            setProcedureSearch("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit surgical history" : "Add surgery"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update surgical history information"
                : "Record a surgical procedure for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="procedure">
                Procedure <span style={{ color: "var(--critical)" }}>*</span>
              </Label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                  style={{ color: "var(--ink-3)" }}
                />
                <Input
                  id="procedure"
                  placeholder="e.g. Appendectomy"
                  value={procedureSearch}
                  onChange={(e) => {
                    setProcedureSearch(e.target.value);
                    form.setValue("procedure", e.target.value);
                  }}
                  className="pl-9"
                />
              </div>
              {procedureSearch && filteredProcedures.length > 0 && (
                <div
                  className="max-h-32 overflow-y-auto rounded-[10px] p-1.5"
                  style={{ border: "1px solid var(--line)", background: "var(--paper-2)" }}
                >
                  {filteredProcedures.map((procedure) => (
                    <button
                      key={procedure}
                      type="button"
                      onClick={() => handleProcedureSelect(procedure)}
                      className="w-full rounded-md px-2 py-1 text-left text-[12.5px]"
                      style={{ color: "var(--ink-2)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--paper-3)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "transparent";
                      }}
                    >
                      {procedure}
                    </button>
                  ))}
                </div>
              )}
              {form.formState.errors.procedure && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {form.formState.errors.procedure.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date / year</Label>
                <Input id="date" placeholder="YYYY" {...form.register("date")} />
                <p className="text-[11px]" style={{ color: "var(--ink-3)" }}>
                  YYYY or YYYY-MM-DD
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="laterality">Laterality</Label>
                <Select
                  value={form.watch("laterality") || "N/A"}
                  onValueChange={(value) =>
                    form.setValue(
                      "laterality",
                      value as "Left" | "Right" | "Bilateral" | "N/A"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N/A">N/A</SelectItem>
                    <SelectItem value="Left">Left</SelectItem>
                    <SelectItem value="Right">Right</SelectItem>
                    <SelectItem value="Bilateral">Bilateral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site">Site</Label>
                <Input
                  id="site"
                  placeholder="e.g., Abdomen, Knee"
                  {...form.register("site")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surgeon">Surgeon</Label>
                <Input
                  id="surgeon"
                  placeholder="Surgeon name"
                  {...form.register("surgeon")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital / facility</Label>
              <Input
                id="hospital"
                placeholder="Hospital or facility name"
                {...form.register("hospital")}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outcome">Outcome</Label>
                <Input
                  id="outcome"
                  placeholder="e.g., Successful"
                  {...form.register("outcome")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="complications">Complications</Label>
                <Input
                  id="complications"
                  placeholder="e.g., Infection"
                  {...form.register("complications")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={form.watch("source")}
                onValueChange={(value) =>
                  form.setValue(
                    "source",
                    value as "Patient Reported" | "Medical Records" | "Other"
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Patient Reported">Patient Reported</SelectItem>
                  <SelectItem value="Medical Records">Medical Records</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes..."
                rows={3}
                {...form.register("notes")}
              />
            </div>

            <DialogFooter>
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                  form.reset();
                  setProcedureSearch("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save entry"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
