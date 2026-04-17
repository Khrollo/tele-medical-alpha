"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Activity, Heart, Thermometer, Scale, Ruler, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

type ChartSeriesKey =
  | "bpSystolic"
  | "bpDiastolic"
  | "hr"
  | "tempC"
  | "weight"
  | "spo2";

interface ChartDataPoint {
  id: string;
  date: string;
  displayDate: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  hr: number | null;
  tempC: number | null;
  weight: number | null;
  spo2: number | null;
  bpSystolicAbnormal: boolean;
  bpDiastolicAbnormal: boolean;
  hrAbnormal: boolean;
  tempCAbnormal: boolean;
  weightAbnormal: boolean;
  spo2Abnormal: boolean;
}

const SERIES_CONFIG: Array<{
  key: ChartSeriesKey;
  label: string;
  colorClass: string;
  stroke: string;
  abnormalKey: keyof ChartDataPoint;
}> = [
  {
    key: "bpSystolic",
    label: "BP Systolic",
    colorClass: "text-blue-600 dark:text-blue-400",
    stroke: "hsl(var(--chart-1, 221.2 83.2% 53.3%))",
    abnormalKey: "bpSystolicAbnormal",
  },
  {
    key: "bpDiastolic",
    label: "BP Diastolic",
    colorClass: "text-cyan-600 dark:text-cyan-400",
    stroke: "hsl(var(--chart-2, 188 94% 43%))",
    abnormalKey: "bpDiastolicAbnormal",
  },
  {
    key: "hr",
    label: "HR",
    colorClass: "text-rose-600 dark:text-rose-400",
    stroke: "hsl(var(--chart-3, 346.8 77.2% 49.8%))",
    abnormalKey: "hrAbnormal",
  },
  {
    key: "tempC",
    label: "Temp (C)",
    colorClass: "text-orange-600 dark:text-orange-400",
    stroke: "hsl(var(--chart-4, 24.6 95% 53.1%))",
    abnormalKey: "tempCAbnormal",
  },
  {
    key: "weight",
    label: "Weight",
    colorClass: "text-violet-600 dark:text-violet-400",
    stroke: "hsl(var(--chart-5, 262.1 83.3% 57.8%))",
    abnormalKey: "weightAbnormal",
  },
  {
    key: "spo2",
    label: "SpO2",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    stroke: "hsl(142 72% 40%)",
    abnormalKey: "spo2Abnormal",
  },
];

function parseNumericValue(value?: string) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBloodPressure(bp?: string) {
  if (!bp) return { systolic: null, diastolic: null };
  const [systolicRaw, diastolicRaw] = bp.split("/");
  const systolic = parseNumericValue(systolicRaw);
  const diastolic = parseNumericValue(diastolicRaw);
  return { systolic, diastolic };
}

function fahrenheitToCelsius(value: number | null) {
  if (value === null) return null;
  return Number.parseFloat((((value - 32) * 5) / 9).toFixed(1));
}

function formatInputDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function formatShortDate(dateString: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(dateString));
}

function CustomAbnormalDot(props: {
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
  abnormalKey: keyof ChartDataPoint;
}) {
  const { cx, cy, payload, abnormalKey } = props;
  if (cx === undefined || cy === undefined || !payload) {
    return null;
  }

  const isAbnormal = Boolean(payload[abnormalKey]);
  const fill = isAbnormal
    ? "hsl(var(--destructive))"
    : "hsl(var(--primary))";

  return (
    <circle
      cx={cx}
      cy={cy}
      r={isAbnormal ? 5 : 3}
      fill={fill}
      stroke="hsl(var(--background))"
      strokeWidth={2}
    />
  );
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
  const [selectedSeries, setSelectedSeries] = React.useState<Record<ChartSeriesKey, boolean>>({
    bpSystolic: true,
    bpDiastolic: true,
    hr: true,
    tempC: true,
    weight: true,
    spo2: true,
  });
  const [startDate, setStartDate] = React.useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return formatInputDate(date);
  });
  const [endDate, setEndDate] = React.useState(() => formatInputDate(new Date()));

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

  const chartData = React.useMemo<ChartDataPoint[]>(() => {
    return [...vitals]
      .map((vital) => {
        const { systolic, diastolic } = parseBloodPressure(vital.bp);
        const hr = parseNumericValue(vital.hr);
        const tempF = parseNumericValue(vital.temp);
        const tempC = fahrenheitToCelsius(tempF);
        const weight = parseNumericValue(vital.weight);
        const spo2 = parseNumericValue(vital.spo2);

        const bpAbnormal = Boolean(
          systolic !== null && (systolic > 140 || systolic < 90)
        );
        const hrAbnormal = Boolean(hr !== null && (hr > 100 || hr < 60));
        const tempAbnormal = Boolean(
          tempC !== null && (tempC > 38.3 || tempC < 36)
        );
        const spo2Abnormal = Boolean(spo2 !== null && spo2 < 95);

        return {
          id: vital.id,
          date: vital.date,
          displayDate: formatShortDate(vital.date),
          bpSystolic: systolic,
          bpDiastolic: diastolic,
          hr,
          tempC,
          weight,
          spo2,
          bpSystolicAbnormal: bpAbnormal,
          bpDiastolicAbnormal: bpAbnormal,
          hrAbnormal,
          tempCAbnormal: tempAbnormal,
          weightAbnormal: false,
          spo2Abnormal,
        };
      })
      .filter((entry) => {
        const entryDate = new Date(entry.date).getTime();
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        return entryDate >= start && entryDate <= end;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [endDate, startDate, vitals]);

  const toggleSeries = (series: ChartSeriesKey, checked: boolean) => {
    setSelectedSeries((current) => ({
      ...current,
      [series]: checked,
    }));
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Vital Signs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage vital signs for {patientName}
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Vital Entry
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vital Progression</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SERIES_CONFIG.map((series) => (
                <label
                  key={series.key}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selectedSeries[series.key]}
                    onCheckedChange={(checked) =>
                      toggleSeries(series.key, checked === true)
                    }
                  />
                  <span className={cn("font-medium", series.colorClass)}>
                    {series.label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="space-y-1">
                <Label htmlFor="vitals-range-start">Start</Label>
                <Input
                  id="vitals-range-start"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vitals-range-end">End</Label>
                <Input
                  id="vitals-range-end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No vital data available in the selected date range.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="displayDate" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {SERIES_CONFIG.map((series) =>
                      selectedSeries[series.key] ? (
                        <Line
                          key={series.key}
                          type="monotone"
                          dataKey={series.key}
                          name={series.label}
                          connectNulls
                          stroke={series.stroke}
                          strokeWidth={2}
                          dot={(props) => (
                            <CustomAbnormalDot
                              {...props}
                              abnormalKey={series.abnormalKey}
                            />
                          )}
                          activeDot={{ r: 6 }}
                        />
                      ) : null
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground">
                Red dots indicate abnormal values based on configured thresholds.
                Temperature is plotted in Celsius for thresholding.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vitals List */}
      {vitals.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">No vital signs recorded</p>
              <Button onClick={() => setShowAddModal(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add First Vital Entry
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {vitals.map((vital) => (
            <Card key={vital.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {formatDate(vital.date)}
                    </CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(vital)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(vital.id)}
                      disabled={deletingId === vital.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {vital.bp && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        Blood Pressure
                      </div>
                      <p className="text-sm font-semibold">{vital.bp}</p>
                    </div>
                  )}
                  {vital.hr && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Heart className="h-3 w-3" />
                        Heart Rate
                      </div>
                      <p className="text-sm font-semibold">{vital.hr} bpm</p>
                    </div>
                  )}
                  {vital.temp && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Thermometer className="h-3 w-3" />
                        Temperature
                      </div>
                      <p className="text-sm font-semibold">{vital.temp} °F</p>
                    </div>
                  )}
                  {vital.weight && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Scale className="h-3 w-3" />
                        Weight
                      </div>
                      <p className="text-sm font-semibold">{vital.weight} lbs</p>
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
