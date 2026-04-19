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
  Calendar,
  Info,
  Syringe,
  CalendarClock,
  History,
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
} from "@/components/ui/clearing";
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

  React.useEffect(() => {
    setVaccines(initialVaccines);
  }, [initialVaccines]);

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

  const totalHistory = vaccines.history.length;
  const totalScheduled = vaccines.scheduled.length;
  const now = new Date();
  const upcomingScheduled = vaccines.scheduled.filter((s) => {
    try {
      return new Date(s.scheduledDate) >= now;
    } catch {
      return false;
    }
  }).length;
  const last12mHistory = vaccines.history.filter((h) => {
    try {
      const d = new Date(h.dateAdministered);
      const year = 1000 * 60 * 60 * 24 * 365;
      return now.getTime() - d.getTime() <= year;
    } catch {
      return false;
    }
  }).length;

  const summaryMetrics = [
    { k: "Immunizations", v: totalHistory, icon: Syringe, tone: "var(--ink-3)" as const },
    { k: "Last 12 months", v: last12mHistory, icon: History, tone: "var(--ink-3)" as const },
    { k: "Scheduled", v: totalScheduled, icon: CalendarClock, tone: "var(--info)" as const },
    { k: "Upcoming", v: upcomingScheduled, icon: Calendar, tone: "var(--ok)" as const },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <SubTabHeader
        eyebrow="Chart · Vaccines"
        title="Vaccines"
        subtitle={`Manage vaccines for ${patientName}.`}
        actions={
          <>
            <Btn
              kind="ghost"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowHistoryModal(true)}
            >
              Add history
            </Btn>
            <Btn
              kind="accent"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowScheduleModal(true)}
            >
              Schedule vaccine
            </Btn>
          </>
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

      {/* Scheduled Vaccines */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <CalendarClock className="h-4 w-4" style={{ color: "var(--info)" }} />
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Scheduled vaccines
          </div>
          <Pill tone="info">{totalScheduled}</Pill>
          <div className="flex-1" />
          <Btn
            kind="soft"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setShowScheduleModal(true)}
          >
            Schedule
          </Btn>
        </div>

        {vaccines.scheduled.length === 0 ? (
          <div
            className="mx-5 my-6 flex flex-col items-center justify-center gap-2 rounded-[14px] py-10"
            style={{ border: "1px dashed var(--line-strong)" }}
          >
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No scheduled vaccines
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {["Vaccine", "Scheduled date", "Dose", "Notes", "Actions"].map((h) => (
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
                {vaccines.scheduled.map((vaccine, i, arr) => (
                  <tr
                    key={vaccine.id}
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
                      <div className="flex items-center gap-2">
                        <div
                          className="text-[13.5px] font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {vaccine.vaccineName}
                        </div>
                        <Pill tone="info" dot>
                          Scheduled
                        </Pill>
                      </div>
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {formatDate(vaccine.scheduledDate)}
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {vaccine.doseNumber || "—"}
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {vaccine.notes || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditScheduled(vaccine)}
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
                          onClick={() => handleDeleteScheduled(vaccine.id)}
                          disabled={
                            deletingId === vaccine.id &&
                            deletingType === "scheduled"
                          }
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClearingCard>

      {/* Immunization History */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <History className="h-4 w-4" style={{ color: "var(--ink-3)" }} />
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Immunization history
          </div>
          <Pill tone="neutral">{totalHistory}</Pill>
          <div className="flex-1" />
          <Btn
            kind="soft"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => setShowHistoryModal(true)}
          >
            Add
          </Btn>
        </div>

        {vaccines.history.length === 0 ? (
          <div
            className="mx-5 my-6 flex flex-col items-center justify-center gap-3 rounded-[14px] py-10"
            style={{ border: "1px dashed var(--line-strong)" }}
          >
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No immunization history recorded
            </p>
            <Btn
              kind="soft"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowHistoryModal(true)}
            >
              Add first vaccine
            </Btn>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {[
                    "Vaccine",
                    "Date",
                    "Dose",
                    "Site",
                    "Route",
                    "Manufacturer",
                    "Lot",
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
                {vaccines.history.map((vaccine, i, arr) => (
                  <tr
                    key={vaccine.id}
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
                        {vaccine.vaccineName}
                      </div>
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {formatDate(vaccine.dateAdministered)}
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {vaccine.doseNumber || "—"}
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {vaccine.administrationSite || "—"}
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {vaccine.route || "—"}
                    </td>
                    <td
                      className="px-5 py-3 text-[12.5px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {vaccine.manufacturer || "—"}
                    </td>
                    <td
                      className="mono px-5 py-3 text-[11.5px]"
                      style={{ color: "var(--ink-3)" }}
                    >
                      {vaccine.lotNumber || "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditHistory(vaccine)}
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
                          onClick={() => handleDeleteHistory(vaccine.id)}
                          disabled={
                            deletingId === vaccine.id && deletingType === "history"
                          }
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ClearingCard>

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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingHistory
                ? "Edit immunization history"
                : "Add immunization history"}
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
                Vaccine name <span style={{ color: "var(--critical)" }}>*</span>
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
                  <button
                    key={name}
                    type="button"
                    onClick={() => setQuickVaccine(name, "history")}
                    className="h-7 rounded-full px-3 text-[11.5px] font-medium tracking-tight transition-colors"
                    style={{
                      border: "1px solid var(--line)",
                      background: "var(--paper-2)",
                      color: "var(--ink-2)",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {historyForm.formState.errors.vaccineName && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {historyForm.formState.errors.vaccineName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-dateAdministered">
                Date administered <span style={{ color: "var(--critical)" }}>*</span>
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
                <Calendar
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "var(--ink-3)" }}
                />
              </div>
              {historyForm.formState.errors.dateAdministered && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {historyForm.formState.errors.dateAdministered.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="history-doseNumber">Dose number</Label>
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
                Administration site
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
              <Label htmlFor="history-lotNumber">Lot number</Label>
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
                  <SelectValue placeholder="Select manufacturer" />
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
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowHistoryModal(false);
                  setEditingHistory(null);
                  historyForm.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingHistory
                  ? "Update history"
                  : "Save immunization"}
              </Btn>
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
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingScheduled ? "Edit scheduled vaccine" : "Schedule vaccine"}
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
                Vaccine name <span style={{ color: "var(--critical)" }}>*</span>
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
                  <button
                    key={name}
                    type="button"
                    onClick={() => setQuickVaccine(name, "schedule")}
                    className="h-7 rounded-full px-3 text-[11.5px] font-medium tracking-tight transition-colors"
                    style={{
                      border: "1px solid var(--line)",
                      background: "var(--paper-2)",
                      color: "var(--ink-2)",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              {scheduleForm.formState.errors.vaccineName && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {scheduleForm.formState.errors.vaccineName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-scheduledDate">
                Scheduled date <span style={{ color: "var(--critical)" }}>*</span>
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
                <Calendar
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "var(--ink-3)" }}
                />
              </div>
              {scheduleForm.formState.errors.scheduledDate && (
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {scheduleForm.formState.errors.scheduledDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-doseNumber">Dose number</Label>
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
              <div
                className="flex items-start gap-2.5 rounded-[10px] px-3 py-2.5"
                style={{
                  background: "var(--info-soft)",
                  border: "1px solid transparent",
                  color: "var(--info)",
                }}
              >
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-[12.5px] leading-5" style={{ color: "var(--ink-2)" }}>
                  This will create a scheduled vaccination reminder. The vaccine
                  will need to be administered and recorded after the scheduled
                  date.
                </p>
              </div>
            )}

            <DialogFooter>
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  setEditingScheduled(null);
                  scheduleForm.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingScheduled
                  ? "Update schedule"
                  : "Schedule vaccine"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
