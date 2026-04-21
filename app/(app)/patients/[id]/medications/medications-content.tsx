"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Pill as PillIcon, Activity, Ban } from "lucide-react";
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
  addMedicationAction,
  updateMedicationAction,
  deleteMedicationAction,
} from "@/app/_actions/medications";
import type { Medication } from "@/app/_lib/db/drizzle/queries/medications";

const medicationSchema = z.object({
  brandName: z.string().optional(),
  genericName: z.string().optional(),
  strength: z.string().optional(),
  form: z.string().optional(),
  dosage: z.string().optional(),
  frequency: z.string().optional(),
  status: z.enum(["Active", "Inactive", "Discontinued"]),
  notes: z.string().optional(),
});

type MedicationFormData = z.infer<typeof medicationSchema>;

interface MedicationsContentProps {
  patientId: string;
  patientName: string;
  medications: Medication[];
}

type FilterType = "all" | "active" | "inactive" | "discontinued";

function statusTone(status: string): { tone: PillTone; label: string } {
  switch (status) {
    case "Active":
      return { tone: "ok", label: status };
    case "Inactive":
      return { tone: "neutral", label: status };
    case "Discontinued":
      return { tone: "critical", label: status };
    default:
      return { tone: "neutral", label: status };
  }
}

export function MedicationsContent({
  patientId,
  patientName,
  medications: initialMedications,
}: MedicationsContentProps) {
  const router = useRouter();
  const [medications, setMedications] = React.useState<Medication[]>(initialMedications);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingMedication, setEditingMedication] = React.useState<Medication | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterType>("all");

  React.useEffect(() => {
    setMedications(initialMedications);
  }, [initialMedications]);

  const form = useForm<MedicationFormData>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      brandName: "",
      genericName: "",
      strength: "",
      form: "",
      dosage: "",
      frequency: "",
      status: "Active",
      notes: "",
    },
  });

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingMedication) {
      form.reset({
        brandName: "",
        genericName: "",
        strength: "",
        form: "",
        dosage: "",
        frequency: "",
        status: "Active",
        notes: "",
      });
    } else if (editingMedication) {
      form.reset({
        brandName: editingMedication.brandName || "",
        genericName: editingMedication.genericName || "",
        strength: editingMedication.strength || "",
        form: editingMedication.form || "",
        dosage: editingMedication.dosage || "",
        frequency: editingMedication.frequency || "",
        status: editingMedication.status,
        notes: editingMedication.notes || "",
      });
    }
  }, [showAddModal, editingMedication, form]);

  const handleSubmit = async (data: MedicationFormData) => {
    setIsSubmitting(true);
    try {
      if (editingMedication) {
        await updateMedicationAction(patientId, editingMedication.id, data);
        toast.success("Medication updated successfully");
      } else {
        await addMedicationAction(patientId, data);
        toast.success("Medication added successfully");
      }

      router.refresh();
    } catch (error) {
      console.error("Error saving medication:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save medication"
      );
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingMedication(null);
    }
  };

  const handleDelete = async (medicationId: string) => {
    if (!confirm("Are you sure you want to delete this medication?")) {
      return;
    }

    setDeletingId(medicationId);
    try {
      await deleteMedicationAction(patientId, medicationId);
      toast.success("Medication deleted successfully");
      setMedications((current) => current.filter((medication) => medication.id !== medicationId));
      router.refresh();
    } catch (error) {
      console.error("Error deleting medication:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete medication"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (medication: Medication) => {
    setEditingMedication(medication);
    setShowAddModal(true);
  };

  const getMedicationDisplayName = (medication: Medication) => {
    if (medication.brandName && medication.genericName) {
      return `${medication.brandName} (${medication.genericName})`;
    }
    return medication.brandName || medication.genericName || "Unnamed medication";
  };

  const totalMedications = medications.length;
  const activeCount = medications.filter((m) => m.status === "Active").length;
  const inactiveCount = medications.filter((m) => m.status === "Inactive").length;
  const discontinuedCount = medications.filter((m) => m.status === "Discontinued").length;

  const filteredMedications = React.useMemo(() => {
    if (filter === "active") return medications.filter((m) => m.status === "Active");
    if (filter === "inactive") return medications.filter((m) => m.status === "Inactive");
    if (filter === "discontinued")
      return medications.filter((m) => m.status === "Discontinued");
    return medications;
  }, [medications, filter]);

  const summaryMetrics = [
    { k: "Total medications", v: totalMedications, icon: PillIcon, tone: "var(--ink-3)" as const },
    { k: "Active", v: activeCount, icon: Activity, tone: "var(--ok)" as const },
    { k: "Inactive", v: inactiveCount, icon: PillIcon, tone: "var(--ink-3)" as const },
    { k: "Discontinued", v: discontinuedCount, icon: Ban, tone: "var(--critical)" as const },
  ];

  const filterTabs: Array<[FilterType, string, number]> = [
    ["all", "All", totalMedications],
    ["active", "Active", activeCount],
    ["inactive", "Inactive", inactiveCount],
    ["discontinued", "Discontinued", discontinuedCount],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <SubTabHeader
        eyebrow="Chart · Medications"
        title="Medications"
        subtitle={`Manage medications for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add medication
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

      {/* Medications panel */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Medication list
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

        {filteredMedications.length === 0 ? (
          <div
            className="mx-5 my-6 flex flex-col items-center justify-center gap-3 rounded-[14px] py-10"
            style={{ border: "1px dashed var(--line-strong)" }}
          >
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              {filter === "all"
                ? "No medications recorded"
                : `No ${filter} medications found`}
            </p>
            {filter === "all" && (
              <Btn
                kind="soft"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setShowAddModal(true)}
              >
                Add first medication
              </Btn>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Medication", "Strength / form", "Dosage / frequency", "Status", "Notes", "Actions"].map(
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
                {filteredMedications.map((medication, i, arr) => {
                  const st = statusTone(medication.status);
                  const strengthForm = [medication.strength, medication.form]
                    .filter(Boolean)
                    .join(" • ");
                  const dosageFreq = [medication.dosage, medication.frequency]
                    .filter(Boolean)
                    .join(" • ");
                  return (
                    <tr
                      key={medication.id}
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
                          {getMedicationDisplayName(medication)}
                        </div>
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {strengthForm || "—"}
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {dosageFreq || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={st.tone} dot>
                          {st.label}
                        </Pill>
                      </td>
                      <td
                        className="px-5 py-3 text-[12.5px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        {medication.notes || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(medication)}
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
                            onClick={() => handleDelete(medication.id)}
                            disabled={deletingId === medication.id}
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

      {/* Add/Edit Medication Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingMedication(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMedication ? "Edit medication" : "Add medication"}
            </DialogTitle>
            <DialogDescription>
              {editingMedication
                ? "Update medication information"
                : "Record a new medication for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand name</Label>
              <Input
                id="brandName"
                placeholder="e.g., Tylenol"
                {...form.register("brandName")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genericName">Generic name</Label>
              <Input
                id="genericName"
                placeholder="e.g., Acetaminophen"
                {...form.register("genericName")}
              />
            </div>

            {/* Strength and Form side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="strength">Strength</Label>
                <Input
                  id="strength"
                  placeholder="e.g., 500mg"
                  {...form.register("strength")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="form">Form</Label>
                <Input
                  id="form"
                  placeholder="e.g., Tablet, Capsule"
                  {...form.register("form")}
                />
              </div>
            </div>

            {/* Dosage and Frequency side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosage">Dosage</Label>
                <Input
                  id="dosage"
                  placeholder="e.g., 1 tablet"
                  {...form.register("dosage")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Input
                  id="frequency"
                  placeholder="e.g., Twice daily"
                  {...form.register("frequency")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", value as "Active" | "Inactive" | "Discontinued")
                }
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
                  setEditingMedication(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingMedication
                  ? "Update medication"
                  : "Save medication"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
