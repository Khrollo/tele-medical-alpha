import type { PillTone } from "@/components/ui/clearing";

export interface WorkflowFlags {
  vitalsRecorded: boolean;
  labsPending: number;
  labsReady: number;
  imagingPending: number;
  imagingReady: number;
}

export interface WorkflowChip {
  key: string;
  label: string;
  tone: PillTone;
  dot?: boolean;
}

const RESULTED_STATUSES = new Set([
  "resulted",
  "complete",
  "completed",
  "done",
  "received",
  "final",
]);

const PENDING_STATUSES = new Set([
  "ordered",
  "collected",
  "pending",
  "in progress",
  "in_progress",
  "awaiting",
  "draft",
  "",
]);

function classifyOrder(type: string, status: string): {
  category: "lab" | "imaging" | null;
  state: "pending" | "ready" | null;
} {
  const t = type.toLowerCase();
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  const category =
    t.includes("lab") || t.includes("blood")
      ? "lab"
      : t.includes("imaging") ||
        t.includes("x-ray") ||
        t.includes("xray") ||
        t.includes("mri") ||
        t.includes("ct") ||
        t.includes("ultrasound")
      ? "imaging"
      : null;
  if (!category) return { category: null, state: null };
  if (RESULTED_STATUSES.has(s)) return { category, state: "ready" };
  if (PENDING_STATUSES.has(s)) return { category, state: "pending" };
  return { category, state: "pending" };
}

export function tallyOrdersForWorkflow(
  orders: Array<{ type?: string | null; status?: string | null }>,
): Pick<WorkflowFlags, "labsPending" | "labsReady" | "imagingPending" | "imagingReady"> {
  const out = { labsPending: 0, labsReady: 0, imagingPending: 0, imagingReady: 0 };
  for (const order of orders) {
    const { category, state } = classifyOrder(order.type ?? "", order.status ?? "");
    if (!category || !state) continue;
    if (category === "lab" && state === "pending") out.labsPending++;
    else if (category === "lab" && state === "ready") out.labsReady++;
    else if (category === "imaging" && state === "pending") out.imagingPending++;
    else if (category === "imaging" && state === "ready") out.imagingReady++;
  }
  return out;
}

export function deriveWorkflowChips(
  flags: WorkflowFlags | null,
  _visitStatus: string | null,
): WorkflowChip[] {
  const chips: WorkflowChip[] = [];

  if (!flags) return chips;

  if (flags.vitalsRecorded) {
    chips.push({ key: "vitals", label: "Vitals \u2713", tone: "ok" });
  }

  if (flags.labsReady > 0) {
    chips.push({
      key: "labs-ready",
      label: flags.labsReady === 1 ? "Lab in" : `${flags.labsReady} labs in`,
      tone: "ok",
    });
  } else if (flags.labsPending > 0) {
    chips.push({
      key: "labs-pending",
      label:
        flags.labsPending === 1
          ? "Lab pending"
          : `${flags.labsPending} labs pending`,
      tone: "warn",
      dot: true,
    });
  }

  if (flags.imagingReady > 0) {
    chips.push({
      key: "imaging-ready",
      label: flags.imagingReady === 1 ? "Imaging ready" : `${flags.imagingReady} imaging ready`,
      tone: "ok",
    });
  } else if (flags.imagingPending > 0) {
    chips.push({
      key: "imaging-pending",
      label:
        flags.imagingPending === 1
          ? "Imaging pending"
          : `${flags.imagingPending} imaging pending`,
      tone: "warn",
      dot: true,
    });
  }

  return chips;
}
