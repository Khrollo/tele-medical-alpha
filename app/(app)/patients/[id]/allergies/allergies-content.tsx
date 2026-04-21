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
  AlertTriangle,
  ShieldAlert,
  Activity,
  CheckCircle2,
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
  addAllergyAction,
  updateAllergyAction,
  deleteAllergyAction,
} from "@/app/_actions/allergies";
import type { Allergy } from "@/app/_lib/db/drizzle/queries/allergies";
import { cn } from "@/app/_lib/utils/cn";

const allergySchema = z.object({
  name: z.string().min(1, "Allergy name is required"),
  severity: z.enum(["Mild", "Moderate", "Severe"]),
  type: z.string().optional(),
  reactions: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Resolved"]),
});

type AllergyFormData = z.infer<typeof allergySchema>;

interface AllergiesContentProps {
  patientId: string;
  patientName: string;
  allergies: Allergy[];
}

type FilterType = "all" | "active" | "resolved";

function severityTone(severity: string): { tone: PillTone; label: string } {
  switch (severity) {
    case "Severe":
      return { tone: "critical", label: severity };
    case "Moderate":
      return { tone: "warn", label: severity };
    case "Mild":
      return { tone: "ok", label: severity };
    default:
      return { tone: "neutral", label: severity };
  }
}

function statusTone(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case "Active":
      return { tone: "critical", label: status };
    case "Resolved":
      return { tone: "ok", label: status };
    case "Inactive":
      return { tone: "neutral", label: status };
    default:
      return { tone: "neutral", label: status };
  }
}

export function AllergiesContent({
  patientId,
  patientName,
  allergies: initialAllergies,
}: AllergiesContentProps) {
  const router = useRouter();
  const [allergies, setAllergies] = React.useState<Allergy[]>(initialAllergies);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingAllergy, setEditingAllergy] = React.useState<Allergy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterType>("all");

  React.useEffect(() => {
    setAllergies(initialAllergies);
  }, [initialAllergies]);

  const form = useForm<AllergyFormData>({
    resolver: zodResolver(allergySchema),
    defaultValues: {
      name: "",
      severity: "Moderate",
      type: "",
      reactions: "",
      status: "Active",
    },
  });

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingAllergy) {
      form.reset({
        name: "",
        severity: "Moderate",
        type: "",
        reactions: "",
        status: "Active",
      });
    } else if (editingAllergy) {
      form.reset({
        name: editingAllergy.name,
        severity: editingAllergy.severity,
        type: editingAllergy.type || "",
        reactions: editingAllergy.reactions || "",
        status: editingAllergy.status,
      });
    }
  }, [showAddModal, editingAllergy, form]);

  const handleSubmit = async (data: AllergyFormData) => {
    setIsSubmitting(true);
    try {
      if (editingAllergy) {
        await updateAllergyAction(patientId, editingAllergy.id, data);
        toast.success("Allergy updated successfully");
      } else {
        await addAllergyAction(patientId, data);
        toast.success("Allergy added successfully");
      }

      router.refresh();
    } catch (error) {
      console.error("Error saving allergy:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save allergy"
      );
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingAllergy(null);
    }
  };

  const handleDelete = async (allergyId: string) => {
    if (!confirm("Are you sure you want to delete this allergy?")) {
      return;
    }

    setDeletingId(allergyId);
    try {
      await deleteAllergyAction(patientId, allergyId);
      toast.success("Allergy deleted successfully");
      setAllergies((current) => current.filter((allergy) => allergy.id !== allergyId));
      router.refresh();
    } catch (error) {
      console.error("Error deleting allergy:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete allergy"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (allergy: Allergy) => {
    setEditingAllergy(allergy);
    setShowAddModal(true);
  };

  const totalAllergies = allergies.length;
  const activeCount = allergies.filter((a) => a.status === "Active").length;
  const severeCount = allergies.filter((a) => a.severity === "Severe").length;
  const resolvedCount = allergies.filter((a) => a.status === "Resolved").length;

  const filteredAllergies = React.useMemo(() => {
    if (filter === "active") {
      return allergies.filter((a) => a.status === "Active");
    }
    if (filter === "resolved") {
      return allergies.filter((a) => a.status === "Resolved");
    }
    return allergies;
  }, [allergies, filter]);

  const summaryMetrics = [
    { k: "Total allergies", v: totalAllergies, icon: ShieldAlert, tone: "var(--ink-3)" as const },
    { k: "Active", v: activeCount, icon: Activity, tone: "var(--ink-3)" as const },
    { k: "Severe", v: severeCount, icon: AlertTriangle, tone: "var(--critical)" as const },
    { k: "Resolved", v: resolvedCount, icon: CheckCircle2, tone: "var(--ink-3)" as const },
  ];

  const filterTabs: Array<[FilterType, string, number]> = [
    ["all", "All", totalAllergies],
    ["active", "Active", activeCount],
    ["resolved", "Resolved", resolvedCount],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <SubTabHeader
        eyebrow="Chart · Allergies"
        title="Allergies"
        subtitle={`Manage allergies for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add allergy
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

      {/* Allergies panel */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Allergy list
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

        {filteredAllergies.length === 0 ? (
          <div
            className="mx-5 my-6 flex flex-col items-center justify-center gap-3 rounded-[14px] py-10"
            style={{ border: "1px dashed var(--line-strong)" }}
          >
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              {filter === "all"
                ? "No allergies recorded"
                : `No ${filter} allergies found`}
            </p>
            {filter === "all" && (
              <Btn
                kind="soft"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAddModal(true)}
              >
                Add first allergy
              </Btn>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Allergen", "Severity", "Status", "Type", "Reactions", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-2.5 text-left text-[10.5px] font-medium uppercase"
                        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAllergies.map((allergy, i, arr) => {
                  const sev = severityTone(allergy.severity);
                  const st = statusTone(allergy.status);
                  return (
                    <tr
                      key={allergy.id}
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
                          {allergy.name}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={sev.tone} dot>
                          {sev.label}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {allergy.type || "—"}
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {allergy.reactions || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(allergy)}
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
                            onClick={() => handleDelete(allergy.id)}
                            disabled={deletingId === allergy.id}
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

      {/* Add/Edit Allergy Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingAllergy(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingAllergy ? "Edit allergy" : "Add allergy"}
            </DialogTitle>
            <DialogDescription>
              {editingAllergy
                ? "Update allergy information"
                : "Record a new allergy for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Allergy name <span style={{ color: "var(--critical)" }}>*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Penicillin"
                {...form.register("name")}
                className={cn(
                  form.formState.errors.name && "border-destructive"
                )}
              />
              {form.formState.errors.name && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={form.watch("severity")}
                onValueChange={(value) =>
                  form.setValue("severity", value as "Mild" | "Moderate" | "Severe")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mild">Mild</SelectItem>
                  <SelectItem value="Moderate">Moderate</SelectItem>
                  <SelectItem value="Severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                placeholder="Food, Medication, etc."
                {...form.register("type")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reactions">Reactions</Label>
              <Textarea
                id="reactions"
                placeholder="Rash, swelling, etc."
                rows={3}
                {...form.register("reactions")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", value as "Active" | "Inactive" | "Resolved")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAllergy(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingAllergy
                  ? "Update allergy"
                  : "Save allergy"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
