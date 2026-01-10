"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
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
  addSurgicalHistoryAction,
  updateSurgicalHistoryAction,
  deleteSurgicalHistoryAction,
} from "@/app/_actions/surgical-history";
import type { SurgicalHistoryEntry } from "@/app/_lib/db/drizzle/queries/surgical-history";
import { cn } from "@/app/_lib/utils/cn";

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

export function SurgicalHistoryContent({
  patientId,
  patientName,
  surgicalHistory: initialSurgicalHistory,
}: SurgicalHistoryContentProps) {
  const [surgicalHistory, setSurgicalHistory] = React.useState<SurgicalHistoryEntry[]>(
    initialSurgicalHistory
  );
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingEntry, setEditingEntry] =
    React.useState<SurgicalHistoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [procedureSearch, setProcedureSearch] = React.useState("");

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
    if (!dateString) return "Not recorded";
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

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "Medical Records":
        return {
          variant: "default" as const,
          className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500",
        };
      case "Patient Reported":
        return {
          variant: "secondary" as const,
          className: "",
        };
      default:
        return {
          variant: "outline" as const,
          className: "",
        };
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Surgical History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage surgical history for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Surgery
        </Button>
      </div>

      {/* Surgical History List */}
      {surgicalHistory.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                No surgical history recorded
              </p>
              <Button onClick={() => setShowAddModal(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {surgicalHistory.map((entry) => {
            const sourceBadge = getSourceBadge(entry.source);

            return (
              <Card key={entry.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {entry.procedure}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(entry)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={sourceBadge.variant}
                      className={sourceBadge.className || ""}
                    >
                      {entry.source}
                    </Badge>
                    {entry.laterality && entry.laterality !== "N/A" && (
                      <Badge variant="outline">{entry.laterality}</Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-medium">{formatDate(entry.date)}</p>
                  </div>
                  {entry.site && (
                    <div>
                      <p className="text-xs text-muted-foreground">Site</p>
                      <p className="text-sm">{entry.site}</p>
                    </div>
                  )}
                  {entry.surgeon && (
                    <div>
                      <p className="text-xs text-muted-foreground">Surgeon</p>
                      <p className="text-sm">{entry.surgeon}</p>
                    </div>
                  )}
                  {entry.hospital && (
                    <div>
                      <p className="text-xs text-muted-foreground">Hospital</p>
                      <p className="text-sm">{entry.hospital}</p>
                    </div>
                  )}
                  {entry.outcome && (
                    <div>
                      <p className="text-xs text-muted-foreground">Outcome</p>
                      <p className="text-sm">{entry.outcome}</p>
                    </div>
                  )}
                  {entry.complications && (
                    <div>
                      <p className="text-xs text-muted-foreground">Complications</p>
                      <p className="text-sm text-destructive">{entry.complications}</p>
                    </div>
                  )}
                  {entry.notes && (
                    <div>
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="text-sm">{entry.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {editingEntry ? "Edit Surgical History" : "Quick Chart Surgery"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update surgical history information"
                : "Record a surgical procedure for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="procedure">Procedure Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto">
                  {filteredProcedures.map((procedure) => (
                    <button
                      key={procedure}
                      type="button"
                      onClick={() => handleProcedureSelect(procedure)}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-accent rounded"
                    >
                      {procedure}
                    </button>
                  ))}
                </div>
              )}
              {form.formState.errors.procedure && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.procedure.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date / Year</Label>
              <Input
                id="date"
                placeholder="YYYY"
                {...form.register("date")}
              />
              <p className="text-xs text-muted-foreground">
                Enter year (YYYY) or full date (YYYY-MM-DD)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="laterality">Laterality</Label>
              <Select
                value={form.watch("laterality") || "N/A"}
                onValueChange={(value) =>
                  form.setValue("laterality", value as "Left" | "Right" | "Bilateral" | "N/A")
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

            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input
                id="site"
                placeholder="e.g., Abdomen, Knee, etc."
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

            <div className="space-y-2">
              <Label htmlFor="hospital">Hospital / Facility</Label>
              <Input
                id="hospital"
                placeholder="Hospital or facility name"
                {...form.register("hospital")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="outcome">Outcome</Label>
              <Input
                id="outcome"
                placeholder="e.g., Successful, Improved, etc."
                {...form.register("outcome")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="complications">Complications</Label>
              <Input
                id="complications"
                placeholder="e.g., Infection, Bleeding, etc."
                {...form.register("complications")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Select
                value={form.watch("source")}
                onValueChange={(value) =>
                  form.setValue("source", value as "Patient Reported" | "Medical Records" | "Other")
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
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                  form.reset();
                  setProcedureSearch("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

