"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Pill, Activity, Clock, FlaskConical, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const getMedicationDisplayName = (medication: Medication) => {
    if (medication.brandName && medication.genericName) {
      return `${medication.brandName} (${medication.genericName})`;
    }
    return medication.brandName || medication.genericName || "Unnamed Medication";
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-8 bg-slate-50/30 dark:bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Medications</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Active prescriptions and medical therapy for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Medication
        </Button>
      </div>

      {/* Medications List */}
      {medications.length === 0 ? (
        <Card className="rounded-[2rem] border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Pill className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium mb-6">No medications recorded yet</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline" className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Add First Medication
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {medications.map((medication) => {
            const statusBadge = getStatusBadge(medication.status);

            return (
              <Card key={medication.id} className="rounded-[2rem] border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform hover:-translate-y-1">
                <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                        <FlaskConical className="h-5 w-5" />
                      </div>
                      <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 truncate max-w-[150px]">
                        {getMedicationDisplayName(medication)}
                      </CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-full"
                        onClick={() => handleEdit(medication)}
                      >
                        <Pencil className="h-4 w-4 text-slate-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/5"
                        onClick={() => handleDelete(medication.id)}
                        disabled={deletingId === medication.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant={statusBadge.variant}
                      className={cn("rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-wider", statusBadge.className)}
                    >
                      {statusBadge.label}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {(medication.strength || medication.form) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Activity className="h-3 w-3" />
                          Strength
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                          {[medication.strength, medication.form].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    )}
                    {(medication.dosage || medication.frequency) && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <Clock className="h-3 w-3" />
                          Schedule
                        </div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                          {[medication.dosage, medication.frequency].filter(Boolean).join(" • ")}
                        </p>
                      </div>
                    )}
                  </div>

                  {medication.notes && (
                    <div className="pt-4 border-t border-slate-50 dark:border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Clinical Notes</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">{medication.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingMedication ? "Edit Medication" : "Add Medication"}
            </DialogTitle>
            <DialogDescription>
              {editingMedication
                ? "Update medication information"
                : "Record a new medication for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                placeholder="e.g., Tylenol"
                {...form.register("brandName")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="genericName">Generic Name</Label>
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingMedication(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingMedication
                  ? "Update Medication"
                  : "Save Medication"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
