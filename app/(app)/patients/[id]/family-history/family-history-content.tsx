"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  X,
  Users,
  Heart,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  addFamilyHistoryAction,
  updateFamilyHistoryAction,
  deleteFamilyHistoryAction,
} from "@/app/_actions/family-history";
import type { FamilyHistoryEntry } from "@/app/_lib/db/drizzle/queries/family-history";
import { cn } from "@/app/_lib/utils/cn";

const familyHistorySchema = z.object({
  relationship: z.string().min(1, "Relationship is required"),
  status: z.enum(["Living", "Deceased"]),
  conditions: z.array(z.string()).min(1, "At least one condition is required"),
});

type FamilyHistoryFormData = z.infer<typeof familyHistorySchema>;

interface FamilyHistoryContentProps {
  patientId: string;
  patientName: string;
  familyHistory: FamilyHistoryEntry[];
}

type FilterType = "all" | "living" | "deceased";

const RELATIONSHIPS = [
  "Mother",
  "Father",
  "Sister",
  "Brother",
  "Maternal Grandmother",
  "Maternal Grandfather",
  "Paternal Grandmother",
  "Paternal Grandfather",
  "Aunt",
  "Uncle",
  "Cousin",
  "Son",
  "Daughter",
  "Other",
];

const COMMON_CONDITIONS = [
  "High Blood Pressure",
  "Diabetes",
  "Heart Disease",
  "Stroke",
  "Cancer",
  "Asthma",
  "Mental Health",
];

function statusTone(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case "Living":
      return { tone: "ok", label: "Living" };
    case "Deceased":
      return { tone: "neutral", label: "Deceased" };
    default:
      return { tone: "neutral", label: status };
  }
}

export function FamilyHistoryContent({
  patientId,
  patientName,
  familyHistory: initialFamilyHistory,
}: FamilyHistoryContentProps) {
  const router = useRouter();
  const [familyHistory, setFamilyHistory] = React.useState<FamilyHistoryEntry[]>(
    initialFamilyHistory
  );
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingEntry, setEditingEntry] =
    React.useState<FamilyHistoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [customConditions, setCustomConditions] = React.useState<string[]>([]);
  const [filter, setFilter] = React.useState<FilterType>("all");

  React.useEffect(() => {
    setFamilyHistory(initialFamilyHistory);
  }, [initialFamilyHistory]);

  const form = useForm<FamilyHistoryFormData>({
    resolver: zodResolver(familyHistorySchema),
    defaultValues: {
      relationship: "",
      status: "Living",
      conditions: [],
    },
  });

  const selectedConditions = form.watch("conditions") || [];

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingEntry) {
      form.reset({
        relationship: "",
        status: "Living",
        conditions: [],
      });
      setSearchQuery("");
      setCustomConditions([]);
    } else if (editingEntry) {
      form.reset({
        relationship: editingEntry.relationship,
        status: editingEntry.status,
        conditions: editingEntry.conditions || [],
      });
      setSearchQuery("");
      setCustomConditions([]);
    }
  }, [showAddModal, editingEntry, form]);

  const handleSubmit = async (data: FamilyHistoryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingEntry) {
        await updateFamilyHistoryAction(patientId, editingEntry.id, data);
        toast.success("Family history updated successfully");
      } else {
        await addFamilyHistoryAction(patientId, data);
        toast.success("Family history added successfully");
      }

      router.refresh();
    } catch (error) {
      console.error("Error saving family history:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save family history"
      );
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingEntry(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this family history entry?")) {
      return;
    }

    setDeletingId(entryId);
    try {
      await deleteFamilyHistoryAction(patientId, entryId);
      toast.success("Family history deleted successfully");
      setFamilyHistory((current) => current.filter((entry) => entry.id !== entryId));
      router.refresh();
    } catch (error) {
      console.error("Error deleting family history:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete family history"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (entry: FamilyHistoryEntry) => {
    setEditingEntry(entry);
    setShowAddModal(true);
  };

  const toggleCondition = (condition: string) => {
    const current = form.getValues("conditions") || [];
    if (current.includes(condition)) {
      form.setValue(
        "conditions",
        current.filter((c) => c !== condition)
      );
    } else {
      form.setValue("conditions", [...current, condition]);
    }
  };

  const handleAddCustomCondition = () => {
    if (searchQuery.trim() && !selectedConditions.includes(searchQuery.trim())) {
      const newCondition = searchQuery.trim();
      form.setValue("conditions", [...selectedConditions, newCondition]);
      setCustomConditions([...customConditions, newCondition]);
      setSearchQuery("");
    }
  };

  const removeCondition = (condition: string) => {
    form.setValue(
      "conditions",
      selectedConditions.filter((c) => c !== condition)
    );
  };

  const totalRelatives = familyHistory.length;
  const livingCount = familyHistory.filter((e) => e.status === "Living").length;
  const deceasedCount = familyHistory.filter((e) => e.status === "Deceased").length;
  const uniqueConditions = React.useMemo(() => {
    const set = new Set<string>();
    familyHistory.forEach((e) => e.conditions?.forEach((c) => set.add(c)));
    return set.size;
  }, [familyHistory]);

  const filteredEntries = React.useMemo(() => {
    if (filter === "living") {
      return familyHistory.filter((e) => e.status === "Living");
    }
    if (filter === "deceased") {
      return familyHistory.filter((e) => e.status === "Deceased");
    }
    return familyHistory;
  }, [familyHistory, filter]);

  const summaryMetrics = [
    { k: "Relatives recorded", v: totalRelatives, icon: Users, tone: "var(--ink-3)" },
    { k: "Living", v: livingCount, icon: Heart, tone: "var(--ok)" },
    { k: "Deceased", v: deceasedCount, icon: AlertCircle, tone: "var(--ink-3)" },
    { k: "Distinct conditions", v: uniqueConditions, icon: RefreshCw, tone: "var(--ink-3)" },
  ];

  const filterTabs: Array<[FilterType, string, number]> = [
    ["all", "All", totalRelatives],
    ["living", "Living", livingCount],
    ["deceased", "Deceased", deceasedCount],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      {/* Header */}
      <SubTabHeader
        eyebrow="Chart · Family history"
        title="Family history"
        subtitle={`Manage family history for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add family history
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

      {/* Family relatives */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Relatives
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
                ? "No family history recorded"
                : `No ${filter} relatives found`}
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
          <div
            className="grid gap-px"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              background: "var(--line)",
            }}
          >
            {filteredEntries.map((entry) => {
              const st = statusTone(entry.status);
              return (
                <div
                  key={entry.id}
                  className="flex flex-col gap-3 p-5"
                  style={{ background: "var(--card)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        className="serif"
                        style={{
                          fontSize: 17,
                          color: "var(--ink)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {entry.relationship}
                      </div>
                      <div className="mt-1.5">
                        <Pill tone={st.tone} dot>
                          {st.label}
                        </Pill>
                      </div>
                    </div>
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
                  </div>

                  {entry.conditions && entry.conditions.length > 0 ? (
                    <div>
                      <div
                        className="text-[10.5px] uppercase"
                        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                      >
                        Known conditions
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {entry.conditions.map((condition, index) => (
                          <Pill key={index} tone="neutral">
                            {condition}
                          </Pill>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>
                      No conditions recorded
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ClearingCard>

      {/* Add/Edit Family History Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingEntry(null);
            form.reset();
            setSearchQuery("");
            setCustomConditions([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit family history" : "Add family history"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update family history information"
                : "Record family medical history for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="relationship">
                Relationship <span style={{ color: "var(--critical)" }}>*</span>
              </Label>
              <Select
                value={form.watch("relationship")}
                onValueChange={(value) => form.setValue("relationship", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((rel) => (
                    <SelectItem key={rel} value={rel}>
                      {rel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.relationship && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {form.formState.errors.relationship.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <div
                className="flex gap-1 rounded-full p-1"
                style={{ border: "1px solid var(--line)", background: "var(--paper-2)" }}
              >
                {(["Living", "Deceased"] as const).map((s) => {
                  const active = form.watch("status") === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => form.setValue("status", s)}
                      className="h-8 flex-1 rounded-full text-[12.5px] font-medium tracking-tight transition-colors"
                      style={{
                        background: active ? "var(--ink)" : "transparent",
                        color: active ? "var(--paper)" : "var(--ink-2)",
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Known conditions</Label>
                {selectedConditions.length > 0 && (
                  <Btn
                    kind="plain"
                    size="sm"
                    type="button"
                    onClick={() => form.setValue("conditions", [])}
                  >
                    Clear all
                  </Btn>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {COMMON_CONDITIONS.map((condition) => {
                  const isSelected = selectedConditions.includes(condition);
                  return (
                    <button
                      key={condition}
                      type="button"
                      onClick={() => toggleCondition(condition)}
                      className={cn(
                        "h-8 rounded-full px-3.5 text-[12.5px] font-medium tracking-tight transition-colors"
                      )}
                      style={{
                        background: isSelected ? "var(--ink)" : "var(--paper-2)",
                        color: isSelected ? "var(--paper)" : "var(--ink-2)",
                        border: `1px solid ${isSelected ? "var(--ink)" : "var(--line)"}`,
                      }}
                    >
                      {condition}
                    </button>
                  );
                })}
              </div>
              {selectedConditions.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p
                    className="text-[11px] uppercase"
                    style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                  >
                    Selected conditions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedConditions.map((condition) => (
                      <Pill key={condition} tone="accent">
                        <span>{condition}</span>
                        <button
                          type="button"
                          onClick={() => removeCondition(condition)}
                          className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full"
                          style={{ color: "var(--brand-ink)" }}
                          aria-label={`Remove ${condition}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Pill>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-condition">Search other conditions…</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: "var(--ink-3)" }}
                  />
                  <Input
                    id="search-condition"
                    placeholder="Search other conditions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCustomCondition();
                      }
                    }}
                    className="pl-9"
                  />
                </div>
                <Btn
                  kind="ghost"
                  type="button"
                  onClick={handleAddCustomCondition}
                  disabled={
                    !searchQuery.trim() ||
                    selectedConditions.includes(searchQuery.trim())
                  }
                >
                  Add
                </Btn>
              </div>
            </div>

            {form.formState.errors.conditions && (
              <p className="text-sm" style={{ color: "var(--critical)" }}>
                {form.formState.errors.conditions.message}
              </p>
            )}

            <DialogFooter>
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                  form.reset();
                  setSearchQuery("");
                  setCustomConditions([]);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingEntry
                  ? "Update history"
                  : "Save family history"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
