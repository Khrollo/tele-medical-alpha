"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Calendar, Info } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  addVaccineHistoryAction,
  scheduleVaccineAction,
  updateVaccineHistoryAction,
  updateScheduledVaccineAction,
  deleteVaccineHistoryAction,
  deleteScheduledVaccineAction,
} from "@/app/_actions/vaccines";
import type {
  VaccineHistory,
  ScheduledVaccine,
} from "@/app/_lib/db/drizzle/queries/vaccines";
import { cn } from "@/app/_lib/utils/cn";

const vaccineHistorySchema = z.object({
  vaccineName: z.string().min(1, "Vaccine name is required"),
  dateAdministered: z.string().min(1, "Date administered is required"),
  doseNumber: z.string().optional(),
  administrationSite: z.string().optional(),
  route: z.string().optional(),
  lotNumber: z.string().optional(),
  manufacturer: z.string().optional(),
});

const scheduledVaccineSchema = z.object({
  vaccineName: z.string().min(1, "Vaccine name is required"),
  scheduledDate: z.string().min(1, "Scheduled date is required"),
  doseNumber: z.string().optional(),
  notes: z.string().optional(),
});

type VaccineHistoryFormData = z.infer<typeof vaccineHistorySchema>;
type ScheduledVaccineFormData = z.infer<typeof scheduledVaccineSchema>;

interface VaccinesContentProps {
  patientId: string;
  patientName: string;
  vaccines: {
    history: VaccineHistory[];
    scheduled: ScheduledVaccine[];
  };
}

const COMMON_VACCINES = ["Tdap", "Influenza", "COVID-19"];

const DOSE_NUMBERS = [
  "1st dose",
  "2nd dose",
  "3rd dose",
  "Booster",
  "Additional",
];

const ADMINISTRATION_SITES = [
  "Left deltoid",
  "Right deltoid",
  "Left arm",
  "Right arm",
  "Left thigh",
  "Right thigh",
  "Other",
];

const ROUTES = [
  "IM (Intramuscular)",
  "Subcutaneous",
  "Oral",
  "Intranasal",
  "Intradermal",
];

const MANUFACTURERS = [
  "Pfizer",
  "Moderna",
  "Johnson & Johnson",
  "AstraZeneca",
  "Novavax",
  "GSK",
  "Sanofi",
  "Merck",
  "Other",
];

export function VaccinesContent({
  patientId,
  patientName,
  vaccines: initialVaccines,
}: VaccinesContentProps) {
  const [vaccines, setVaccines] = React.useState(initialVaccines);
  const [showHistoryModal, setShowHistoryModal] = React.useState(false);
  const [showScheduleModal, setShowScheduleModal] = React.useState(false);
  const [editingHistory, setEditingHistory] =
    React.useState<VaccineHistory | null>(null);
  const [editingScheduled, setEditingScheduled] =
    React.useState<ScheduledVaccine | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletingType, setDeletingType] = React.useState<
    "history" | "scheduled" | null
  >(null);

  const historyForm = useForm<VaccineHistoryFormData>({
    resolver: zodResolver(vaccineHistorySchema),
    defaultValues: {
      vaccineName: "",
      dateAdministered: "",
      doseNumber: "",
      administrationSite: "",
      route: "",
      lotNumber: "",
      manufacturer: "",
    },
  });

  const scheduleForm = useForm<ScheduledVaccineFormData>({
    resolver: zodResolver(scheduledVaccineSchema),
    defaultValues: {
      vaccineName: "",
      scheduledDate: "",
      doseNumber: "",
      notes: "",
    },
  });

  // Reset forms when opening/closing modals
  React.useEffect(() => {
    if (showHistoryModal && !editingHistory) {
      historyForm.reset({
        vaccineName: "",
        dateAdministered: "",
        doseNumber: "",
        administrationSite: "",
        route: "",
        lotNumber: "",
        manufacturer: "",
      });
    } else if (editingHistory) {
      historyForm.reset({
        vaccineName: editingHistory.vaccineName,
        dateAdministered: editingHistory.dateAdministered,
        doseNumber: editingHistory.doseNumber || "",
        administrationSite: editingHistory.administrationSite || "",
        route: editingHistory.route || "",
        lotNumber: editingHistory.lotNumber || "",
        manufacturer: editingHistory.manufacturer || "",
      });
    }
  }, [showHistoryModal, editingHistory, historyForm]);

  React.useEffect(() => {
    if (showScheduleModal && !editingScheduled) {
      scheduleForm.reset({
        vaccineName: "",
        scheduledDate: "",
        doseNumber: "",
        notes: "",
      });
    } else if (editingScheduled) {
      scheduleForm.reset({
        vaccineName: editingScheduled.vaccineName,
        scheduledDate: editingScheduled.scheduledDate,
        doseNumber: editingScheduled.doseNumber || "",
        notes: editingScheduled.notes || "",
      });
    }
  }, [showScheduleModal, editingScheduled, scheduleForm]);

  const handleHistorySubmit = async (data: VaccineHistoryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingHistory) {
        await updateVaccineHistoryAction(patientId, editingHistory.id, data);
        toast.success("Vaccine history updated successfully");
      } else {
        await addVaccineHistoryAction(patientId, data);
        toast.success("Vaccine history added successfully");
      }

      window.location.reload();
    } catch (error) {
      console.error("Error saving vaccine history:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save vaccine history"
      );
    } finally {
      setIsSubmitting(false);
      setShowHistoryModal(false);
      setEditingHistory(null);
    }
  };

  const handleScheduleSubmit = async (data: ScheduledVaccineFormData) => {
    setIsSubmitting(true);
    try {
      if (editingScheduled) {
        await updateScheduledVaccineAction(patientId, editingScheduled.id, data);
        toast.success("Scheduled vaccine updated successfully");
      } else {
        await scheduleVaccineAction(patientId, data);
        toast.success("Vaccine scheduled successfully");
      }

      window.location.reload();
    } catch (error) {
      console.error("Error scheduling vaccine:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule vaccine"
      );
    } finally {
      setIsSubmitting(false);
      setShowScheduleModal(false);
      setEditingScheduled(null);
    }
  };

  const handleDeleteHistory = async (vaccineId: string) => {
    if (!confirm("Are you sure you want to delete this vaccine history?")) {
      return;
    }

    setDeletingId(vaccineId);
    setDeletingType("history");
    try {
      await deleteVaccineHistoryAction(patientId, vaccineId);
      toast.success("Vaccine history deleted successfully");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting vaccine history:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete vaccine history"
      );
    } finally {
      setDeletingId(null);
      setDeletingType(null);
    }
  };

  const handleDeleteScheduled = async (vaccineId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled vaccine?")) {
      return;
    }

    setDeletingId(vaccineId);
    setDeletingType("scheduled");
    try {
      await deleteScheduledVaccineAction(patientId, vaccineId);
      toast.success("Scheduled vaccine deleted successfully");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting scheduled vaccine:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete scheduled vaccine"
      );
    } finally {
      setDeletingId(null);
      setDeletingType(null);
    }
  };

  const handleEditHistory = (vaccine: VaccineHistory) => {
    setEditingHistory(vaccine);
    setShowHistoryModal(true);
  };

  const handleEditScheduled = (vaccine: ScheduledVaccine) => {
    setEditingScheduled(vaccine);
    setShowScheduleModal(true);
  };

  const setQuickVaccine = (name: string, form: "history" | "schedule") => {
    if (form === "history") {
      historyForm.setValue("vaccineName", name);
    } else {
      scheduleForm.setValue("vaccineName", name);
    }
  };

  const formatDate = (dateString: string) => {
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

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vaccines</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage vaccines for {patientName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowHistoryModal(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add History
          </Button>
          <Button onClick={() => setShowScheduleModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Schedule Vaccine
          </Button>
        </div>
      </div>

      {/* Scheduled Vaccines Section */}
      {vaccines.scheduled.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Scheduled Vaccines</h2>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {vaccines.scheduled.map((vaccine) => (
              <Card key={vaccine.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {vaccine.vaccineName}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditScheduled(vaccine)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteScheduled(vaccine.id)}
                        disabled={
                          deletingId === vaccine.id && deletingType === "scheduled"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500">
                    Scheduled
                  </Badge>
                  <div>
                    <p className="text-xs text-muted-foreground">Scheduled Date</p>
                    <p className="text-sm font-medium">
                      {formatDate(vaccine.scheduledDate)}
                    </p>
                  </div>
                  {vaccine.doseNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Dose Number</p>
                      <p className="text-sm">{vaccine.doseNumber}</p>
                    </div>
                  )}
                  {vaccine.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{vaccine.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Vaccine History Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Immunization History</h2>
        {vaccines.history.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  No immunization history recorded
                </p>
                <Button
                  onClick={() => setShowHistoryModal(true)}
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Vaccine
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {vaccines.history.map((vaccine) => (
              <Card key={vaccine.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {vaccine.vaccineName}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditHistory(vaccine)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteHistory(vaccine.id)}
                        disabled={
                          deletingId === vaccine.id && deletingType === "history"
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Date Administered</p>
                    <p className="text-sm font-medium">
                      {formatDate(vaccine.dateAdministered)}
                    </p>
                  </div>
                  {vaccine.doseNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Dose Number</p>
                      <p className="text-sm">{vaccine.doseNumber}</p>
                    </div>
                  )}
                  {vaccine.administrationSite && (
                    <div>
                      <p className="text-xs text-muted-foreground">Site</p>
                      <p className="text-sm">{vaccine.administrationSite}</p>
                    </div>
                  )}
                  {vaccine.route && (
                    <div>
                      <p className="text-xs text-muted-foreground">Route</p>
                      <p className="text-sm">{vaccine.route}</p>
                    </div>
                  )}
                  {vaccine.lotNumber && (
                    <div>
                      <p className="text-xs text-muted-foreground">Lot Number</p>
                      <p className="text-sm">{vaccine.lotNumber}</p>
                    </div>
                  )}
                  {vaccine.manufacturer && (
                    <div>
                      <p className="text-xs text-muted-foreground">Manufacturer</p>
                      <p className="text-sm">{vaccine.manufacturer}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Immunization History Modal */}
      <Dialog
        open={showHistoryModal}
        onOpenChange={(open) => {
          setShowHistoryModal(open);
          if (!open) {
            setEditingHistory(null);
            historyForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingHistory
                ? "Edit Immunization History"
                : "Add Immunization History"}
            </DialogTitle>
            <DialogDescription>
              {editingHistory
                ? "Update immunization history information"
                : "Record a past vaccination administration."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={historyForm.handleSubmit(handleHistorySubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="history-vaccineName">
                Vaccine Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="history-vaccineName"
                placeholder="e.g., Tdap, Influenza, COVID-19"
                {...historyForm.register("vaccineName")}
                className={cn(
                  historyForm.formState.errors.vaccineName &&
                    "border-destructive"
                )}
              />
              <div className="flex gap-2 flex-wrap">
                {COMMON_VACCINES.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs",
                      name === "Tdap" && "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500",
                      name === "Influenza" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500",
                      name === "COVID-19" && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500"
                    )}
                    onClick={() => setQuickVaccine(name, "history")}
                  >
                    {name}
                  </Button>
                ))}
              </div>
              {historyForm.formState.errors.vaccineName && (
                <p className="text-sm text-destructive">
                  {historyForm.formState.errors.vaccineName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-dateAdministered">
                Date Administered <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="history-dateAdministered"
                  type="date"
                  {...historyForm.register("dateAdministered")}
                  className={cn(
                    "pr-10",
                    historyForm.formState.errors.dateAdministered &&
                      "border-destructive"
                  )}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {historyForm.formState.errors.dateAdministered && (
                <p className="text-sm text-destructive">
                  {historyForm.formState.errors.dateAdministered.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-doseNumber">Dose Number</Label>
              <Select
                value={historyForm.watch("doseNumber") || ""}
                onValueChange={(value) =>
                  historyForm.setValue("doseNumber", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {DOSE_NUMBERS.map((dose) => (
                    <SelectItem key={dose} value={dose}>
                      {dose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-administrationSite">
                Administration Site
              </Label>
              <Select
                value={historyForm.watch("administrationSite") || ""}
                onValueChange={(value) =>
                  historyForm.setValue("administrationSite", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ADMINISTRATION_SITES.map((site) => (
                    <SelectItem key={site} value={site}>
                      {site}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-route">Route</Label>
              <Select
                value={historyForm.watch("route") || ""}
                onValueChange={(value) => historyForm.setValue("route", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {ROUTES.map((route) => (
                    <SelectItem key={route} value={route}>
                      {route}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-lotNumber">Lot Number</Label>
              <Input
                id="history-lotNumber"
                placeholder="e.g., ABC123"
                {...historyForm.register("lotNumber")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-manufacturer">Manufacturer</Label>
              <Select
                value={historyForm.watch("manufacturer") || ""}
                onValueChange={(value) =>
                  historyForm.setValue("manufacturer", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  {MANUFACTURERS.map((manufacturer) => (
                    <SelectItem key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowHistoryModal(false);
                  setEditingHistory(null);
                  historyForm.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingHistory
                  ? "Update History"
                  : "Save Immunization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Schedule Vaccine Modal */}
      <Dialog
        open={showScheduleModal}
        onOpenChange={(open) => {
          setShowScheduleModal(open);
          if (!open) {
            setEditingScheduled(null);
            scheduleForm.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingScheduled ? "Edit Scheduled Vaccine" : "Schedule Vaccine"}
            </DialogTitle>
            <DialogDescription>
              {editingScheduled
                ? "Update scheduled vaccine information"
                : "Schedule a future vaccination for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={scheduleForm.handleSubmit(handleScheduleSubmit)}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="schedule-vaccineName">
                Vaccine Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="schedule-vaccineName"
                placeholder="e.g., Tdap, Influenza, COVID-19"
                {...scheduleForm.register("vaccineName")}
                className={cn(
                  scheduleForm.formState.errors.vaccineName &&
                    "border-destructive"
                )}
              />
              <div className="flex gap-2 flex-wrap">
                {COMMON_VACCINES.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs",
                      name === "Tdap" && "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500",
                      name === "Influenza" && "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500",
                      name === "COVID-19" && "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500"
                    )}
                    onClick={() => setQuickVaccine(name, "schedule")}
                  >
                    {name}
                  </Button>
                ))}
              </div>
              {scheduleForm.formState.errors.vaccineName && (
                <p className="text-sm text-destructive">
                  {scheduleForm.formState.errors.vaccineName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-scheduledDate">
                Scheduled Date <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="schedule-scheduledDate"
                  type="date"
                  {...scheduleForm.register("scheduledDate")}
                  className={cn(
                    "pr-10",
                    scheduleForm.formState.errors.scheduledDate &&
                      "border-destructive"
                  )}
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {scheduleForm.formState.errors.scheduledDate && (
                <p className="text-sm text-destructive">
                  {scheduleForm.formState.errors.scheduledDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-doseNumber">Dose Number</Label>
              <Select
                value={scheduleForm.watch("doseNumber") || ""}
                onValueChange={(value) =>
                  scheduleForm.setValue("doseNumber", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {DOSE_NUMBERS.map((dose) => (
                    <SelectItem key={dose} value={dose}>
                      {dose}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-notes">Notes</Label>
              <Textarea
                id="schedule-notes"
                placeholder="Additional notes or instructions..."
                rows={3}
                {...scheduleForm.register("notes")}
              />
            </div>

            {!editingScheduled && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This will create a scheduled vaccination reminder. The vaccine
                  will need to be administered and recorded after the scheduled
                  date.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowScheduleModal(false);
                  setEditingScheduled(null);
                  scheduleForm.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingScheduled
                  ? "Update Schedule"
                  : "Schedule Vaccine"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

