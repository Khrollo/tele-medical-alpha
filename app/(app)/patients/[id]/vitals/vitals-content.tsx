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
  TrendingUp,
} from "lucide-react";
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
  bpNote: z.string().optional(),
  hr: z.string().optional(),
  hrNote: z.string().optional(),
  temp: z.string().optional(),
  tempNote: z.string().optional(),
  weight: z.string().optional(),
  weightNote: z.string().optional(),
  height: z.string().optional(),
  heightNote: z.string().optional(),
  spo2: z.string().optional(),
  spo2Note: z.string().optional(),
  rr: z.string().optional(),
  rrNote: z.string().optional(),
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
  const [showTrendsModal, setShowTrendsModal] = React.useState(false);
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
      bpNote: "",
      hr: "",
      hrNote: "",
      temp: "",
      tempNote: "",
      weight: "",
      weightNote: "",
      height: "",
      heightNote: "",
      spo2: "",
      spo2Note: "",
      rr: "",
      rrNote: "",
      notes: "",
    },
  });

  // Reset form when opening/closing modal
  React.useEffect(() => {
    if (showAddModal && !editingVital) {
      form.reset({
        date: new Date().toISOString().split("T")[0],
        bp: "",
        bpNote: "",
        hr: "",
        hrNote: "",
        temp: "",
        tempNote: "",
        weight: "",
        weightNote: "",
        height: "",
        heightNote: "",
        spo2: "",
        spo2Note: "",
        rr: "",
        rrNote: "",
        notes: "",
      });
    } else if (editingVital) {
      form.reset({
        date: editingVital.date.split("T")[0],
        bp: editingVital.bp || "",
        bpNote: editingVital.bpNote || "",
        hr: editingVital.hr || "",
        hrNote: editingVital.hrNote || "",
        temp: editingVital.temp || "",
        tempNote: editingVital.tempNote || "",
        weight: editingVital.weight || "",
        weightNote: editingVital.weightNote || "",
        height: editingVital.height || "",
        heightNote: editingVital.heightNote || "",
        spo2: editingVital.spo2 || "",
        spo2Note: editingVital.spo2Note || "",
        rr: editingVital.rr || "",
        rrNote: editingVital.rrNote || "",
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
          <div className="flex items-center gap-2">
            <Btn
              kind="ghost"
              icon={<TrendingUp className="h-4 w-4" />}
              onClick={() => setShowTrendsModal(true)}
              disabled={vitals.length < 2}
              title={
                vitals.length < 2
                  ? "Need at least 2 entries to show a trend"
                  : undefined
              }
            >
              View trends
            </Btn>
            <Btn
              kind="accent"
              icon={<Plus className="h-4 w-4" />}
              onClick={() => setShowAddModal(true)}
            >
              Add entry
            </Btn>
          </div>
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
                        fontSize: 22,
                        color: "var(--ink)",
                        letterSpacing: "-0.015em",
                        lineHeight: 1.15,
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
                      note={vital.bpNote}
                    />
                  )}
                  {vital.hr && (
                    <VitalCell
                      icon={Heart}
                      label="Heart rate"
                      value={vital.hr}
                      unit="bpm"
                      note={vital.hrNote}
                    />
                  )}
                  {vital.temp && (
                    <VitalCell
                      icon={Thermometer}
                      label="Temperature"
                      value={vital.temp}
                      unit="°F"
                      note={vital.tempNote}
                    />
                  )}
                  {vital.weight && (
                    <VitalCell
                      icon={Scale}
                      label="Weight"
                      value={vital.weight}
                      unit="lbs"
                      note={vital.weightNote}
                    />
                  )}
                  {vital.height && (
                    <VitalCell
                      icon={Ruler}
                      label="Height"
                      value={vital.height}
                      unit="cm"
                      note={vital.heightNote}
                    />
                  )}
                  {vital.spo2 && (
                    <VitalCell
                      icon={Droplet}
                      label="SpO₂"
                      value={vital.spo2}
                      unit="%"
                      note={vital.spo2Note}
                    />
                  )}
                  {vital.rr && (
                    <VitalCell
                      icon={Wind}
                      label="Resp rate"
                      value={vital.rr}
                      unit="/min"
                      note={vital.rrNote}
                    />
                  )}
                  {vital.bmi && (
                    <VitalCell
                      icon={Scale}
                      label="BMI"
                      value={vital.bmi}
                      unit=""
                      note={vital.bmiNote}
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

      {/* Trends Modal */}
      <Dialog open={showTrendsModal} onOpenChange={setShowTrendsModal}>
        <DialogContent className="sm:max-w-[780px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vital trends</DialogTitle>
            <DialogDescription>
              {patientName} — {sortedAsc.length} entr
              {sortedAsc.length === 1 ? "y" : "ies"} over time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-5">
            {metrics
              .filter((m) => m.data.length >= 2)
              .map((m) => {
                const chartData = sortedAsc
                  .map((v) => {
                    const raw =
                      m.k === "Blood pressure"
                        ? toSystolic(v.bp)
                        : m.k === "Heart rate"
                        ? toNumber(v.hr)
                        : m.k === "Temperature"
                        ? toNumber(v.temp)
                        : m.k === "SpO₂"
                        ? toNumber(v.spo2)
                        : m.k === "Weight"
                        ? toNumber(v.weight)
                        : m.k === "Respiratory rate"
                        ? toNumber(v.rr)
                        : NaN;
                    return {
                      date: formatDate(v.date),
                      value: isNaN(raw) ? null : raw,
                    };
                  })
                  .filter((d) => d.value !== null);
                const Icon = m.icon;
                return (
                  <div
                    key={m.k}
                    className="rounded-[12px]"
                    style={{
                      border: "1px solid var(--line)",
                      background: "var(--card)",
                    }}
                  >
                    <div
                      className="flex items-center gap-2 px-4 py-3"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <Icon
                        className="h-4 w-4"
                        style={{ color: m.tone }}
                      />
                      <div
                        className="serif"
                        style={{
                          fontSize: 15,
                          color: "var(--ink)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {m.k}
                      </div>
                      <div className="flex-1" />
                      <div
                        className="mono text-[11px]"
                        style={{ color: "var(--ink-3)" }}
                      >
                        latest {m.latest} {m.unit}
                      </div>
                    </div>
                    <div style={{ height: 180, padding: "10px 8px 12px" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={chartData}
                          margin={{ top: 8, right: 16, bottom: 8, left: 0 }}
                        >
                          <CartesianGrid
                            stroke="var(--line)"
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            stroke="var(--ink-3)"
                            tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            stroke="var(--ink-3)"
                            tick={{ fontSize: 10, fill: "var(--ink-3)" }}
                            tickLine={false}
                            axisLine={false}
                            domain={["auto", "auto"]}
                            width={40}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "var(--card)",
                              border: "1px solid var(--line)",
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            labelStyle={{ color: "var(--ink-2)" }}
                            itemStyle={{ color: "var(--ink)" }}
                          />
                          <Legend
                            wrapperStyle={{
                              fontSize: 11,
                              color: "var(--ink-3)",
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={`${m.k} (${m.unit})`}
                            stroke={m.tone}
                            strokeWidth={2}
                            dot={{ r: 3, fill: m.tone }}
                            activeDot={{ r: 5 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            {metrics.every((m) => m.data.length < 2) && (
              <p
                className="text-[13px]"
                style={{ color: "var(--ink-3)" }}
              >
                Need at least 2 recorded values per metric to show a trend.
              </p>
            )}
          </div>
          <DialogFooter>
            <Btn
              kind="ghost"
              type="button"
              onClick={() => setShowTrendsModal(false)}
            >
              Close
            </Btn>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <VitalWithNote
                label="Blood pressure"
                placeholder="e.g., 120/80"
                fieldId="bp"
                register={form.register}
              />
              <VitalWithNote
                label="Heart rate"
                unit="bpm"
                placeholder="e.g., 72"
                fieldId="hr"
                register={form.register}
              />
              <VitalWithNote
                label="Temperature"
                unit="°F"
                placeholder="e.g., 98.6"
                fieldId="temp"
                register={form.register}
              />
              <VitalWithNote
                label="SpO₂"
                unit="%"
                placeholder="e.g., 98"
                fieldId="spo2"
                register={form.register}
              />
              <VitalWithNote
                label="Weight"
                unit="lbs"
                placeholder="e.g., 170"
                fieldId="weight"
                register={form.register}
              />
              <VitalWithNote
                label="Height"
                unit="cm"
                placeholder="e.g., 177.8"
                fieldId="height"
                register={form.register}
              />
              <VitalWithNote
                label="Respiratory rate"
                unit="/min"
                placeholder="e.g., 16"
                fieldId="rr"
                register={form.register}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">General notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Overall notes for this entry — e.g. clinical context, what the patient was doing…"
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
  note,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  unit: string;
  note?: string;
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
      {note ? (
        <div
          className="mt-0.5 text-[11.5px] italic leading-snug"
          style={{ color: "var(--ink-3)" }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

// Helper used inside the add/edit modal — renders a vital's value input and
// a small optional note field below it, sharing the same ID prefix.
function VitalWithNote({
  label,
  unit,
  placeholder,
  fieldId,
  register,
}: {
  label: string;
  unit?: string;
  placeholder: string;
  fieldId:
    | "bp"
    | "hr"
    | "temp"
    | "spo2"
    | "weight"
    | "height"
    | "rr";
  register: ReturnType<typeof useForm<VitalFormData>>["register"];
}) {
  const noteId = `${fieldId}Note` as const;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>
        {label}
        {unit ? (
          <span
            className="mono ml-1 text-[10.5px]"
            style={{ color: "var(--ink-3)" }}
          >
            ({unit})
          </span>
        ) : null}
      </Label>
      <Input id={fieldId} placeholder={placeholder} {...register(fieldId)} />
      <Input
        id={noteId}
        placeholder="Optional note for this value"
        className="text-[12.5px]"
        style={{ color: "var(--ink-2)" }}
        {...register(
          noteId as
            | "bpNote"
            | "hrNote"
            | "tempNote"
            | "spo2Note"
            | "weightNote"
            | "heightNote"
            | "rrNote"
        )}
      />
    </div>
  );
}
