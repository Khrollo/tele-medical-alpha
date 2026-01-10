"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
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
import { cn } from "@/app/_lib/utils/cn";

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
  const [medications, setMedications] = React.useState<Medication[]>(initialMedications);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingMedication, setEditingMedication] = React.useState<Medication | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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
      
      // Refresh the page to get updated data
      window.location.reload();
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
      // Refresh the page to get updated data
      window.location.reload();
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
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Medications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage medications for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Medication
        </Button>
      </div>

      {/* Medications List */}
      {medications.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No medications recorded</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Medication
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {medications.map((medication) => {
            const statusBadge = getStatusBadge(medication.status);

            return (
              <Card key={medication.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {getMedicationDisplayName(medication)}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(medication)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(medication.id)}
                        disabled={deletingId === medication.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={statusBadge.variant}
                      className={statusBadge.className || ""}
                    >
                      {statusBadge.label}
                    </Badge>
                  </div>
                  {(medication.strength || medication.form) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Strength & Form</p>
                      <p className="text-sm font-medium">
                        {[medication.strength, medication.form].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  )}
                  {(medication.dosage || medication.frequency) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Dosage & Frequency</p>
                      <p className="text-sm font-medium">
                        {[medication.dosage, medication.frequency].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  )}
                  {medication.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{medication.notes}</p>
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

