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
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  Activity,
  Shield,
  Brain,
  RefreshCw,
  Check,
} from "lucide-react";
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
  addPastMedicalHistoryEntryAction,
  updatePastMedicalHistoryEntryAction,
  deletePastMedicalHistoryEntryAction,
  setNoSignificantPMHAction,
  verifyPastMedicalHistoryEntryAction,
  verifyAllPastMedicalHistoryEntriesAction,
} from "@/app/_actions/past-medical-history";
import type {
  PastMedicalHistoryEntry,
  PastMedicalHistoryData,
} from "@/app/_lib/db/drizzle/queries/past-medical-history";
import { cn } from "@/app/_lib/utils/cn";

const pmhEntrySchema = z.object({
  condition: z.string().min(1, "Condition is required"),
  status: z.enum(["Active", "Resolved", "Chronic", "Inactive"]),
  diagnosedDate: z.string().optional(),
  impact: z.enum(["High", "Moderate", "Low"]).optional(),
  icd10: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

type PMHEntryFormData = z.infer<typeof pmhEntrySchema>;

interface PastMedicalHistoryContentProps {
  patientId: string;
  patientName: string;
  pastMedicalHistory: PastMedicalHistoryData;
}

type FilterType = "all" | "active" | "resolved";

export function PastMedicalHistoryContent({
  patientId,
  patientName,
  pastMedicalHistory: initialPMH,
}: PastMedicalHistoryContentProps) {
  const [pmh, setPMH] = React.useState<PastMedicalHistoryData>(initialPMH);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<PastMedicalHistoryEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<FilterType>("all");
  const [isSettingNoPMH, setIsSettingNoPMH] = React.useState(false);

  const form = useForm<PMHEntryFormData>({
    resolver: zodResolver(pmhEntrySchema),
    defaultValues: {
      condition: "",
      status: "Active",
      diagnosedDate: "",
      impact: "Moderate",
      icd10: "",
      source: "",
      notes: "",
    },
  });

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingEntry) {
      form.reset({
        condition: "",
        status: "Active",
        diagnosedDate: "",
        impact: "Moderate",
        icd10: "",
        source: "",
        notes: "",
      });
    } else if (editingEntry) {
      form.reset({
        condition: editingEntry.condition || "",
        status: (editingEntry.status as "Active" | "Resolved" | "Chronic" | "Inactive") || "Active",
        diagnosedDate: editingEntry.diagnosedDate || "",
        impact: (editingEntry.impact as "High" | "Moderate" | "Low") || "Moderate",
        icd10: editingEntry.icd10 || "",
        source: editingEntry.source || "",
        notes: editingEntry.notes || "",
      });
    }
  }, [showAddModal, editingEntry, form]);

  const handleSubmit = async (data: PMHEntryFormData) => {
    setIsSubmitting(true);
    try {
      if (editingEntry) {
        await updatePastMedicalHistoryEntryAction(patientId, editingEntry.id, data);
        toast.success("Condition updated successfully");
      } else {
        await addPastMedicalHistoryEntryAction(patientId, data);
        toast.success("Condition added successfully");
      }
      window.location.reload();
    } catch (error) {
      console.error("Error saving condition:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save condition"
      );
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingEntry(null);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this condition?")) {
      return;
    }

    setDeletingId(entryId);
    try {
      await deletePastMedicalHistoryEntryAction(patientId, entryId);
      toast.success("Condition deleted successfully");
      window.location.reload();
    } catch (error) {
      console.error("Error deleting condition:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete condition"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (entry: PastMedicalHistoryEntry) => {
    setEditingEntry(entry);
    setShowAddModal(true);
  };

  const handleSetNoSignificantPMH = async () => {
    if (pmh.entries.length > 0) {
      if (!confirm("Setting 'No Significant PMH' will mark all existing entries as inactive. Continue?")) {
        return;
      }
    }

    setIsSettingNoPMH(true);
    try {
      await setNoSignificantPMHAction(patientId, !pmh.noSignificantPMH);
      toast.success(
        pmh.noSignificantPMH
          ? "No Significant PMH flag removed"
          : "No Significant PMH flag set"
      );
      window.location.reload();
    } catch (error) {
      console.error("Error setting no significant PMH:", error);
      toast.error("Failed to update flag");
    } finally {
      setIsSettingNoPMH(false);
    }
  };

  const handleVerify = async (entryId: string) => {
    try {
      await verifyPastMedicalHistoryEntryAction(patientId, entryId);
      toast.success("Condition verified");
      window.location.reload();
    } catch (error) {
      console.error("Error verifying condition:", error);
      toast.error("Failed to verify condition");
    }
  };

  const handleVerifyAll = async () => {
    if (!confirm("Verify all conditions?")) {
      return;
    }

    try {
      await verifyAllPastMedicalHistoryEntriesAction(patientId);
      toast.success("All conditions verified");
      window.location.reload();
    } catch (error) {
      console.error("Error verifying all conditions:", error);
      toast.error("Failed to verify conditions");
    }
  };

  // Calculate summary statistics
  const totalConditions = pmh.entries.length;
  const activeChronic = pmh.entries.filter(
    (e) => e.status === "Active" || e.status === "Chronic"
  ).length;
  const highImpact = pmh.entries.filter((e) => e.impact === "High").length;

  // Filter entries
  const filteredEntries = React.useMemo(() => {
    if (filter === "active") {
      return pmh.entries.filter((e) => e.status === "Active" || e.status === "Chronic");
    }
    if (filter === "resolved") {
      return pmh.entries.filter((e) => e.status === "Resolved");
    }
    return pmh.entries;
  }, [pmh.entries, filter]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return { variant: "destructive" as const, label: status };
      case "Chronic":
        return {
          variant: "default" as const,
          label: status,
          className: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500",
        };
      case "Resolved":
        return {
          variant: "default" as const,
          label: status,
          className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500",
        };
      default:
        return { variant: "secondary" as const, label: status };
    }
  };

  const getImpactBadge = (impact?: string) => {
    switch (impact) {
      case "High":
        return { variant: "destructive" as const, label: impact };
      case "Moderate":
        return {
          variant: "default" as const,
          label: impact,
          className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500",
        };
      case "Low":
        return {
          variant: "default" as const,
          label: impact,
          className: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500",
        };
      default:
        return null;
    }
  };

  const getVerificationStatus = (entry: PastMedicalHistoryEntry) => {
    if (!entry.verified) {
      return { status: "Needs Verification", icon: Clock, color: "text-orange-500" };
    }
    if (entry.verifiedDate) {
      const verifiedDate = new Date(entry.verifiedDate);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        return { status: "Verified Today", icon: CheckCircle2, color: "text-green-500" };
      }
      return {
        status: `Verified ${diffDays} day${diffDays > 1 ? "s" : ""} ago`,
        icon: CheckCircle2,
        color: "text-green-500",
      };
    }
    return { status: "Verified", icon: CheckCircle2, color: "text-green-500" };
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Past Medical History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage past medical history for {patientName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={pmh.noSignificantPMH ? "default" : "outline"}
            onClick={handleSetNoSignificantPMH}
            disabled={isSettingNoPMH}
          >
            <Check className="h-4 w-4 mr-2" />
            {pmh.noSignificantPMH ? "No Significant PMH" : "Mark No Significant PMH"}
          </Button>
          <Button onClick={() => setShowAddModal(true)} disabled={pmh.noSignificantPMH}>
            <Plus className="h-4 w-4 mr-2" />
            Add Condition
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Conditions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalConditions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chronic</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeChronic}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Impact</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highImpact}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">{formatDate(pmh.lastUpdated) || "-"}</div>
          </CardContent>
        </Card>
      </div>

      {/* No Significant PMH Message */}
      {pmh.noSignificantPMH && (
        <Card className="border-green-500 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="flex items-center justify-center py-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                No significant past medical history recorded for this patient.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medical Conditions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Medical Conditions</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                All ({totalConditions})
              </Button>
              <Button
                variant={filter === "active" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("active")}
              >
                Active ({activeChronic})
              </Button>
              <Button
                variant={filter === "resolved" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("resolved")}
              >
                Resolved ({totalConditions - activeChronic})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-muted-foreground mb-4">
                  {filter === "all"
                    ? "No conditions recorded"
                    : `No ${filter} conditions found`}
                </p>
                {filter === "all" && !pmh.noSignificantPMH && (
                  <Button onClick={() => setShowAddModal(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Condition
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      CONDITION
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      STATUS
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      DATE
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      IMPACT
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      SOURCE
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">
                      ACTIONS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => {
                    const statusBadge = getStatusBadge(entry.status);
                    const impactBadge = getImpactBadge(entry.impact);
                    return (
                      <tr key={entry.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div className="font-medium">{entry.condition}</div>
                          {entry.icd10 && (
                            <div className="text-xs text-muted-foreground">ICD-10: {entry.icd10}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={statusBadge.variant}
                            className={statusBadge.className || ""}
                          >
                            {statusBadge.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">{formatDate(entry.diagnosedDate)}</td>
                        <td className="p-3">
                          {impactBadge ? (
                            <Badge
                              variant={impactBadge.variant}
                              className={impactBadge.className || ""}
                            >
                              {impactBadge.label}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {entry.source || "-"}
                        </td>
                        <td className="p-3">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clinical Intelligence Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              <CardTitle>Clinical Intelligence</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Risk Stratification */}
            {highImpact > 0 && (
              <div className="p-4 border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                <p className="text-sm mb-2">
                  Patient has multiple cardiovascular risk factors. Consider comprehensive risk
                  assessment.
                </p>
                <Button variant="link" className="p-0 h-auto text-blue-600 dark:text-blue-400">
                  View Risk Calculator →
                </Button>
              </div>
            )}
            {/* Care Coordination */}
            {activeChronic > 0 && (
              <div className="p-4 border rounded-lg bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <p className="text-sm mb-2">
                  Chronic conditions management appears coordinated. Review care team assignments.
                </p>
                <Button variant="link" className="p-0 h-auto text-green-600 dark:text-green-400">
                  View Care Team →
                </Button>
              </div>
            )}
            {highImpact === 0 && activeChronic === 0 && (
              <p className="text-sm text-muted-foreground">No specific insights at this time.</p>
            )}
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-yellow-500" />
                <CardTitle>Verification Status</CardTitle>
              </div>
              {filteredEntries.some((e) => !e.verified) && (
                <Button size="sm" variant="outline" onClick={handleVerifyAll}>
                  Verify All Conditions
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No conditions to verify</p>
            ) : (
              <div className="space-y-3">
                {filteredEntries.map((entry) => {
                  const verification = getVerificationStatus(entry);
                  const Icon = verification.icon;
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        !entry.verified
                          ? "bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
                          : "bg-muted/50 border-border"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("h-4 w-4", verification.color)} />
                        <div>
                          <p className="text-sm font-medium">{entry.condition}</p>
                          <p className={cn("text-xs", verification.color)}>
                            {verification.status}
                          </p>
                        </div>
                      </div>
                      {!entry.verified && (
                        <Button size="sm" variant="outline" onClick={() => handleVerify(entry.id)}>
                          Verify
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Condition Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingEntry(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Condition" : "Add Condition"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update condition information"
                : "Record a new past medical history condition."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="condition">
                Condition <span className="text-destructive">*</span>
              </Label>
              <Input
                id="condition"
                placeholder="e.g., Type 2 Diabetes Mellitus"
                {...form.register("condition")}
                className={cn(form.formState.errors.condition && "border-destructive")}
              />
              {form.formState.errors.condition && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.condition.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as "Active" | "Resolved" | "Chronic" | "Inactive")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Chronic">Chronic</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="diagnosedDate">Date Diagnosed</Label>
                <Input
                  id="diagnosedDate"
                  type="date"
                  {...form.register("diagnosedDate")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="impact">Impact</Label>
                <Select
                  value={form.watch("impact") || "Moderate"}
                  onValueChange={(value) =>
                    form.setValue("impact", value as "High" | "Moderate" | "Low")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="icd10">ICD-10 Code</Label>
                <Input
                  id="icd10"
                  placeholder="e.g., E11.9"
                  {...form.register("icd10")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="e.g., Patient reported, Medical records"
                {...form.register("source")}
              />
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
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingEntry
                  ? "Update Condition"
                  : "Save Condition"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

