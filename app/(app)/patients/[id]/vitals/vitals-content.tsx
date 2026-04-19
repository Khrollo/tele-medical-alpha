"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  Activity,
  Heart,
  Thermometer,
  Scale,
  Ruler,
  Wind,
  Droplet,
} from "lucide-react";
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
import {
  Btn,
  ClearingCard,
  Sparkline,
  SubTabHeader,
} from "@/components/ui/clearing";
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

// Parse numeric value from vitals string; returns NaN if not parseable.
function toNumber(v: string | undefined): number {
  if (!v) return NaN;
  const n = parseFloat(v);
  return isNaN(n) ? NaN : n;
}

// For BP, parse systolic ("120/80" → 120)
function toSystolic(v: string | undefined): number {
  if (!v) return NaN;
  const parts = v.split("/");
  const n = parseFloat(parts[0] || "");
  return isNaN(n) ? NaN : n;
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
      date: new Date().toISOString().split("T")[0],
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
        date: new Date().toISOString().split("T")[0],
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
        date: editingVital.date.split("T")[0],
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
        error instanceof Error ? error.message : "Failed to save vital entry"
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
        error instanceof Error ? error.message : "Failed to delete vital entry"
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
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Trend data (sorted oldest → newest for sparklines)
  const sortedAsc = React.useMemo(
    () =>
      [...vitals].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [vitals]
  );

  // Latest entry (most recent) for summary values
  const latest = React.useMemo(
    () =>
      [...vitals].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0],
    [vitals]
  );

  type VitalMetric = {
    k: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    latest: string;
    unit: string;
    tone: string;
    data: number[];
  };

  const metrics: VitalMetric[] = [
    {
      k: "Blood pressure",
      icon: Activity,
      latest: latest?.bp || "—",
      unit: "mmHg",
      tone: "var(--critical)",
      data: sortedAsc
        .map((v) => toSystolic(v.bp))
        .filter((n) => !isNaN(n)),
    },
    {
      k: "Heart rate",
      icon: Heart,
      latest: latest?.hr || "—",
      unit: "bpm",
      tone: "var(--critical)",
      data: sortedAsc.map((v) => toNumber(v.hr)).filter((n) => !isNaN(n)),
    },
    {
      k: "Temperature",
      icon: Thermometer,
      latest: latest?.temp || "—",
      unit: "°F",
      tone: "var(--warn)",
      data: sortedAsc.map((v) => toNumber(v.temp)).filter((n) => !isNaN(n)),
    },
    {
      k: "SpO₂",
      icon: Droplet,
      latest: latest?.spo2 || "—",
      unit: "%",
      tone: "var(--info)",
      data: sortedAsc.map((v) => toNumber(v.spo2)).filter((n) => !isNaN(n)),
    },
    {
      k: "Weight",
      icon: Scale,
      latest: latest?.weight || "—",
      unit: "lbs",
      tone: "var(--ink-3)",
      data: sortedAsc.map((v) => toNumber(v.weight)).filter((n) => !isNaN(n)),
    },
    {
      k: "Respiratory rate",
      icon: Wind,
      latest: latest?.rr || "—",
      unit: "/min",
      tone: "var(--info)",
      data: sortedAsc.map((v) => toNumber(v.rr)).filter((n) => !isNaN(n)),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <SubTabHeader
        eyebrow="Chart · Vitals"
        title="Vital signs"
        subtitle={`Manage vital signs for ${patientName}.`}
        actions={
          <Btn
            kind="accent"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Add entry
          </Btn>
        }
      />

      {/* Summary strip with sparklines */}
      <div
        className="grid overflow-hidden rounded-2xl"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          border: "1px solid var(--line)",
          background: "var(--card)",
        }}
      >
        {metrics.map((m, i, arr) => {
          const Icon = m.icon;
          return (
            <div
              key={m.k}
              className="flex flex-col gap-2 px-5 py-4"
              style={{
                borderRight:
                  i < arr.length - 1 ? "1px solid var(--line)" : undefined,
              }}
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
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div
                    className="serif"
                    style={{
                      fontSize: 24,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      color: "var(--ink)",
                    }}
                  >
                    {m.latest}
                  </div>
                  <div
                    className="mono mt-1 text-[10.5px]"
                    style={{ color: "var(--ink-3)" }}
                  >
                    {m.unit}
                  </div>
                </div>
                {m.data.length >= 2 && (
                  <Sparkline
                    data={m.data}
                    w={80}
                    h={26}
                    stroke={m.tone}
                    fill={m.tone}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Entries */}
      {vitals.length === 0 ? (
        <ClearingCard>
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Activity className="h-8 w-8" style={{ color: "var(--ink-3)" }} />
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No vital signs recorded
            </p>
            <Btn
              kind="soft"
              icon={<Plus className="h-3.5 w-3.5" />}
              onClick={() => setShowAddModal(true)}
            >
              Add first vital entry
            </Btn>
          </div>
        </ClearingCard>
      ) : (
        <ClearingCard pad={0}>
          <div
            className="flex flex-wrap items-center gap-3 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--line)" }}
          >
            <div
              className="serif"
              style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
            >
              Entries
            </div>
            <div className="flex-1" />
            <div
              className="mono text-[11.5px]"
              style={{ color: "var(--ink-3)" }}
            >
              {vitals.length} total
            </div>
          </div>
          <div className="flex flex-col">
            {vitals.map((vital, i, arr) => (
              <div
                key={vital.id}
                className="flex flex-col gap-3 px-5 py-4"
                style={{
                  borderBottom:
                    i < arr.length - 1 ? "1px solid var(--line)" : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-3">
                    <div
                      className="serif"
                      style={{
                        fontSize: 16,
                        color: "var(--ink)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {formatDate(vital.date)}
                    </div>
                    <div
                      className="mono text-[11px] uppercase"
                      style={{ color: "var(--ink-3)", letterSpacing: "0.05em" }}
                    >
                      Entry · {i + 1} of {arr.length}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleEdit(vital)}
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
                      onClick={() => handleDelete(vital.id)}
                      disabled={deletingId === vital.id}
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
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
                  {vital.bp && (
                    <VitalCell
                      icon={Activity}
                      label="Blood pressure"
                      value={vital.bp}
                      unit="mmHg"
                    />
                  )}
                  {vital.hr && (
                    <VitalCell
                      icon={Heart}
                      label="Heart rate"
                      value={vital.hr}
                      unit="bpm"
                    />
                  )}
                  {vital.temp && (
                    <VitalCell
                      icon={Thermometer}
                      label="Temperature"
                      value={vital.temp}
                      unit="°F"
                    />
                  )}
                  {vital.weight && (
                    <VitalCell
                      icon={Scale}
                      label="Weight"
                      value={vital.weight}
                      unit="lbs"
                    />
                  )}
                  {vital.height && (
                    <VitalCell
                      icon={Ruler}
                      label="Height"
                      value={vital.height}
                      unit="cm"
                    />
                  )}
                  {vital.spo2 && (
                    <VitalCell
                      icon={Droplet}
                      label="SpO₂"
                      value={vital.spo2}
                      unit="%"
                    />
                  )}
                  {vital.rr && (
                    <VitalCell
                      icon={Wind}
                      label="Resp rate"
                      value={vital.rr}
                      unit="/min"
                    />
                  )}
                  {vital.bmi && (
                    <VitalCell
                      icon={Scale}
                      label="BMI"
                      value={vital.bmi}
                      unit=""
                    />
                  )}
                </div>
                {vital.notes && (
                  <div
                    className="mt-1 pt-3"
                    style={{ borderTop: "1px solid var(--line)" }}
                  >
                    <div
                      className="text-[10.5px] uppercase"
                      style={{
                        color: "var(--ink-3)",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Notes
                    </div>
                    <p
                      className="mt-1 text-[13px] leading-5"
                      style={{ color: "var(--ink-2)" }}
                    >
                      {vital.notes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ClearingCard>
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
              {editingVital ? "Edit vital entry" : "Add vital entry"}
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
                Date <span style={{ color: "var(--critical)" }}>*</span>
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
                <p className="text-sm" style={{ color: "var(--critical)" }}>
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bp">Blood pressure</Label>
                <Input
                  id="bp"
                  placeholder="e.g., 120/80"
                  {...form.register("bp")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hr">Heart rate (bpm)</Label>
                <Input id="hr" placeholder="e.g., 72" {...form.register("hr")} />
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
                <Label htmlFor="spo2">SpO₂ (%)</Label>
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
                <Label htmlFor="rr">Respiratory rate (/min)</Label>
                <Input id="rr" placeholder="e.g., 16" {...form.register("rr")} />
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
              <Btn
                kind="ghost"
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingVital(null);
                  form.reset();
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn kind="accent" type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Saving…"
                  : editingVital
                  ? "Update entry"
                  : "Save entry"}
              </Btn>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VitalCell({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-1.5 text-[10.5px] uppercase"
        style={{ color: "var(--ink-3)", letterSpacing: "0.1em" }}
      >
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="serif"
          style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="mono text-[10.5px]"
            style={{ color: "var(--ink-3)" }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
