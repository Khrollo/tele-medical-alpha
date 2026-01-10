"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export function FamilyHistoryContent({
  patientId,
  patientName,
  familyHistory: initialFamilyHistory,
}: FamilyHistoryContentProps) {
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

      window.location.reload();
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
      window.location.reload();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Living":
        return {
          variant: "default" as const,
          label: status,
          className:
            "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500",
        };
      case "Deceased":
        return { variant: "secondary" as const, label: status };
      default:
        return { variant: "secondary" as const, label: status };
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Family History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage family history for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Family History
        </Button>
      </div>

      {/* Family History List */}
      {familyHistory.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                No family history recorded
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
          {familyHistory.map((entry) => {
            const statusBadge = getStatusBadge(entry.status);

            return (
              <Card key={entry.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg font-semibold">
                      {entry.relationship}
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
                      variant={statusBadge.variant}
                      className={statusBadge.className || ""}
                    >
                      {statusBadge.label}
                    </Badge>
                  </div>
                  {entry.conditions && entry.conditions.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Known Conditions
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {entry.conditions.map((condition, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs"
                          >
                            {condition}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingEntry ? "Edit Family History" : "Add Family History"}
            </DialogTitle>
            <DialogDescription>
              {editingEntry
                ? "Update family history information"
                : "Record family medical history for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="relationship">RELATIONSHIP</Label>
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
                <p className="text-sm text-destructive">
                  {form.formState.errors.relationship.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>STATUS</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.watch("status") === "Living" ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    form.watch("status") === "Living" &&
                      "bg-primary text-primary-foreground"
                  )}
                  onClick={() => form.setValue("status", "Living")}
                >
                  Living
                </Button>
                <Button
                  type="button"
                  variant={form.watch("status") === "Deceased" ? "default" : "outline"}
                  className={cn(
                    "flex-1",
                    form.watch("status") === "Deceased" &&
                      "bg-primary text-primary-foreground"
                  )}
                  onClick={() => form.setValue("status", "Deceased")}
                >
                  Deceased
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>KNOWN CONDITIONS</Label>
                {selectedConditions.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => form.setValue("conditions", [])}
                  >
                    Clear all
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {COMMON_CONDITIONS.map((condition) => {
                  const isSelected = selectedConditions.includes(condition);
                  return (
                    <Button
                      key={condition}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-8 rounded-full",
                        isSelected && "bg-primary text-primary-foreground"
                      )}
                      onClick={() => toggleCondition(condition)}
                    >
                      {condition}
                    </Button>
                  );
                })}
              </div>
              {selectedConditions.length > 0 && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">Selected Conditions:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedConditions.map((condition) => (
                      <Badge
                        key={condition}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {condition}
                        <button
                          type="button"
                          onClick={() => removeCondition(condition)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="search-condition">Search other conditions...</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddCustomCondition}
                  disabled={!searchQuery.trim() || selectedConditions.includes(searchQuery.trim())}
                >
                  Add
                </Button>
              </div>
            </div>

            {form.formState.errors.conditions && (
              <p className="text-sm text-destructive">
                {form.formState.errors.conditions.message}
              </p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
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
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingEntry
                  ? "Update History"
                  : "Save Family History"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

