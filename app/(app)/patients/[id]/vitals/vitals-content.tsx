"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Activity, Heart, Thermometer, Scale, Ruler, Wind, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addVitalAction,
  updateVitalAction,
  deleteVitalAction,
} from "@/app/_actions/vitals";
import type { VitalEntry } from "@/app/_lib/db/drizzle/queries/vitals";
import { cn } from "@/app/_lib/utils/cn";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const vitalSchema = z.object({
  date: z.string().min(1, "Date is required"),
  bp: z.string().optional(),
  hr: z.string().optional(),
  temp: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  spo2: z.string().optional(),
  rr: z.string().optional(),
  notes: z.string().optional(),
});

type VitalFormData = z.infer<typeof vitalSchema>;

interface VitalsContentProps {
  patientId: string;
  patientName: string;
  vitals: VitalEntry[];
}

export function VitalsContent({
  patientId,
  patientName,
  vitals: initialVitals,
}: VitalsContentProps) {
  const router = useRouter();
  const [vitals, setVitals] = React.useState<VitalEntry[]>(initialVitals);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingVital, setEditingVital] = React.useState<VitalEntry | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setVitals(initialVitals);
  }, [initialVitals]);

  const form = useForm<VitalFormData>({
    resolver: zodResolver(vitalSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      bp: "",
      hr: "",
      temp: "",
      weight: "",
      height: "",
      spo2: "",
      rr: "",
      notes: "",
    },
  });

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingVital) {
      form.reset({
        date: new Date().toISOString().split('T')[0],
        bp: "",
        hr: "",
        temp: "",
        weight: "",
        height: "",
        spo2: "",
        rr: "",
        notes: "",
      });
    } else if (editingVital) {
      form.reset({
        date: editingVital.date.split('T')[0],
        bp: editingVital.bp || "",
        hr: editingVital.hr || "",
        temp: editingVital.temp || "",
        weight: editingVital.weight || "",
        height: editingVital.height || "",
        spo2: editingVital.spo2 || "",
        rr: editingVital.rr || "",
        notes: editingVital.notes || "",
      });
    }
  }, [showAddModal, editingVital, form]);

  const handleSubmit = async (data: VitalFormData) => {
    setIsSubmitting(true);
    try {
      if (editingVital) {
        await updateVitalAction(patientId, editingVital.id, data);
        toast.success("Vital entry updated successfully");
      } else {
        await addVitalAction(patientId, data);
        toast.success("Vital entry added successfully");
      }
      
      router.refresh();
    } catch (error) {
      console.error("Error saving vital:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save vital entry"
      );
    } finally {
      setIsSubmitting(false);
      setShowAddModal(false);
      setEditingVital(null);
    }
  };

  const handleDelete = async (vitalId: string) => {
    if (!confirm("Are you sure you want to delete this vital entry?")) {
      return;
    }

    setDeletingId(vitalId);
    try {
      await deleteVitalAction(patientId, vitalId);
      toast.success("Vital entry deleted successfully");
      setVitals((current) => current.filter((vital) => vital.id !== vitalId));
      router.refresh();
    } catch (error) {
      console.error("Error deleting vital:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to delete vital entry"
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (vital: VitalEntry) => {
    setEditingVital(vital);
    setShowAddModal(true);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-8 p-4 md:p-8 bg-slate-50/30 dark:bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Vital Signs</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Historical health trends for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vital Entry
        </Button>
      </div>

      {/* Trend Charts Section */}
      {vitals.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                <Heart className="h-4 w-4" />
                Heart Rate & BP Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={[...vitals].reverse()}>
                  <defs>
                    <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    hide 
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #f1f5f9', boxShadow: 'none' }}
                  />
                  <Area type="monotone" dataKey="hr" stroke="#ef4444" fillOpacity={1} fill="url(#colorHr)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-500 flex items-center gap-2 uppercase tracking-wider">
                <Scale className="h-4 w-4" />
                Weight (lbs)
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[250px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[...vitals].reverse()}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #f1f5f9', boxShadow: 'none' }}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Vitals List */}
      {vitals.length === 0 ? (
        <Card className="rounded-[2rem] border-dashed border-2 bg-transparent shadow-none">
          <CardContent className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Activity className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-slate-500 font-medium mb-6">No vital signs recorded yet</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline" className="rounded-full">
                <Plus className="h-4 w-4 mr-2" />
                Add First Vital Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {vitals.map((vital) => (
            <Card key={vital.id} className="rounded-[2rem] border border-slate-50 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform hover:-translate-y-1">
              <CardHeader className="pb-3 border-b border-slate-50 dark:border-slate-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
                      {formatDate(vital.date)}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-full"
                      onClick={() => handleEdit(vital)}
                    >
                      <Pencil className="h-4 w-4 text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/5"
                      onClick={() => handleDelete(vital.id)}
                      disabled={deletingId === vital.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                  {vital.bp && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Activity className="h-3 w-3" />
                        Blood Pressure
                      </div>
                      <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{vital.bp} <span className="text-xs font-medium text-slate-400 ml-0.5">mmHg</span></p>
                    </div>
                  )}
                  {vital.hr && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Heart className="h-3 w-3" />
                        Heart Rate
                      </div>
                      <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{vital.hr} <span className="text-xs font-medium text-slate-400 ml-0.5">bpm</span></p>
                    </div>
                  )}
                  {vital.temp && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Thermometer className="h-3 w-3" />
                        Temperature
                      </div>
                      <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{vital.temp} <span className="text-xs font-medium text-slate-400 ml-0.5">°F</span></p>
                    </div>
                  )}
                  {vital.weight && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <Scale className="h-3 w-3" />
                        Weight
                      </div>
                      <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{vital.weight} <span className="text-xs font-medium text-slate-400 ml-0.5">lbs</span></p>
                    </div>
                  )}
                  {vital.height && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Ruler className="h-3 w-3" />
                        Height
                      </div>
                      <p className="text-sm font-semibold">{vital.height} cm</p>
                    </div>
                  )}
                  {vital.spo2 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wind className="h-3 w-3" />
                        SpO2
                      </div>
                      <p className="text-sm font-semibold">{vital.spo2}%</p>
                    </div>
                  )}
                  {vital.rr && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Wind className="h-3 w-3" />
                        Respiratory Rate
                      </div>
                      <p className="text-sm font-semibold">{vital.rr} /min</p>
                    </div>
                  )}
                  {vital.bmi && (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">BMI</div>
                      <p className="text-sm font-semibold">{vital.bmi}</p>
                    </div>
                  )}
                </div>
                {vital.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{vital.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Vital Modal */}
      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) {
            setEditingVital(null);
            form.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingVital ? "Edit Vital Entry" : "Add Vital Entry"}
            </DialogTitle>
            <DialogDescription>
              {editingVital
                ? "Update vital sign information"
                : "Record new vital signs for this patient."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                {...form.register("date")}
                className={cn(
                  form.formState.errors.date && "border-destructive"
                )}
              />
              {form.formState.errors.date && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp">Blood Pressure</Label>
                <Input
                  id="bp"
                  placeholder="e.g., 120/80"
                  {...form.register("bp")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hr">Heart Rate (bpm)</Label>
                <Input
                  id="hr"
                  placeholder="e.g., 72"
                  {...form.register("hr")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="temp">Temperature (°F)</Label>
                <Input
                  id="temp"
                  placeholder="e.g., 98.6"
                  {...form.register("temp")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="spo2">SpO2 (%)</Label>
                <Input
                  id="spo2"
                  placeholder="e.g., 98"
                  {...form.register("spo2")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="weight">Weight (lbs)</Label>
                <Input
                  id="weight"
                  placeholder="e.g., 170"
                  {...form.register("weight")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  placeholder="e.g., 177.8"
                  {...form.register("height")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rr">Respiratory Rate (/min)</Label>
                <Input
                  id="rr"
                  placeholder="e.g., 16"
                  {...form.register("rr")}
                />
              </div>
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
                  setEditingVital(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving..."
                  : editingVital
                  ? "Update Vital Entry"
                  : "Save Vital Entry"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
