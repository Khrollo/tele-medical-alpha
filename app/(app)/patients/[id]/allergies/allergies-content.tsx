"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, X, Trash2, Pencil } from "lucide-react";
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

export function AllergiesContent({
  patientId,
  patientName,
  allergies: initialAllergies,
}: AllergiesContentProps) {
  const [allergies, setAllergies] = React.useState<Allergy[]>(initialAllergies);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingAllergy, setEditingAllergy] = React.useState<Allergy | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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
      
      // Refresh the page to get updated data
      window.location.reload();
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
      // Refresh the page to get updated data
      window.location.reload();
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

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Severe":
        return { variant: "destructive" as const, label: severity };
      case "Moderate":
        return { variant: "default" as const, label: severity, className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500" };
      case "Mild":
        return { variant: "default" as const, label: severity, className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500" };
      default:
        return { variant: "secondary" as const, label: severity };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return { variant: "destructive" as const, label: status };
      case "Inactive":
        return { variant: "secondary" as const, label: status };
      case "Resolved":
        return { variant: "default" as const, label: status, className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500" };
      default:
        return { variant: "secondary" as const, label: status };
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Allergies</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage allergies for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Allergy
        </Button>
      </div>

      {/* Allergies List */}
      {allergies.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No allergies recorded</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Allergy
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {allergies.map((allergy) => {
            const severityBadge = getSeverityBadge(allergy.severity);
            const statusBadge = getStatusBadge(allergy.status);

            return (
              <Card key={allergy.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {allergy.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(allergy)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(allergy.id)}
                        disabled={deletingId === allergy.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={severityBadge.variant}
                      className={severityBadge.className || ""}
                    >
                      {severityBadge.label}
                    </Badge>
                    <Badge
                      variant={statusBadge.variant}
                      className={statusBadge.className || ""}
                    >
                      {statusBadge.label}
                    </Badge>
                  </div>
                  {allergy.type && (
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium">{allergy.type}</p>
                    </div>
                  )}
                  {allergy.reactions && (
                    <div>
                      <p className="text-xs text-muted-foreground">Reactions</p>
                      <p className="text-sm">{allergy.reactions}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
              {editingAllergy ? "Edit Allergy" : "Add Allergy"}
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
                Allergy Name <span className="text-destructive">*</span>
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
                <p className="text-sm text-destructive">
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingAllergy(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingAllergy
                  ? "Update Allergy"
                  : "Save Allergy"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

