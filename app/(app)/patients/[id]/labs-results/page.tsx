import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientOrdersAction } from "@/app/_actions/orders";
import { isLabOrImagingOrder } from "@/app/_lib/utils/patient-workflow-chips";
import { ClearingCard, Pill, type PillTone } from "@/components/ui/clearing";

const RESULTED = new Set([
  "resulted",
  "complete",
  "completed",
  "done",
  "received",
  "final",
]);
const PENDING = new Set([
  "ordered",
  "collected",
  "pending",
  "in progress",
  "in_progress",
  "awaiting",
  "draft",
  "",
]);

function statusTone(status: string): PillTone {
  const s = status.trim().toLowerCase().replace(/_/g, " ");
  if (RESULTED.has(s)) return "ok";
  if (PENDING.has(s)) return "warn";
  return "neutral";
}

function priorityTone(priority: string): PillTone {
  const p = priority.trim().toLowerCase();
  if (p === "critical" || p === "stat") return "critical";
  if (p === "urgent" || p === "high") return "warn";
  return "neutral";
}

export default async function LabsResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  // Admins intentionally excluded — parent patient chart at
  // app/(app)/patients/[id]/page.tsx only allows doctor|nurse, so granting
  // admins direct-URL access to labs/imaging here would widen PHI access
  // asymmetrically. Keep this in lockstep with the chart root.
  if (session.role !== "doctor" && session.role !== "nurse") {
    redirect("/sign-in");
  }

  const overview = await getPatientOverview(patientId);
  if (!overview) {
    notFound();
  }

  const orders = await getPatientOrdersAction(patientId);
  const resultItems = orders.filter((order) => isLabOrImagingOrder(order.type));

  const pendingCount = resultItems.filter(
    (r) => statusTone(r.status) === "warn",
  ).length;
  const readyCount = resultItems.filter(
    (r) => statusTone(r.status) === "ok",
  ).length;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <div>
        <div
          className="text-[11.5px] uppercase"
          style={{ color: "var(--ink-3)", letterSpacing: "0.12em", fontWeight: 600 }}
        >
          Chart · {overview.patient.fullName}
        </div>
        <h1
          className="serif mt-1.5"
          style={{
            fontSize: "clamp(28px, 3.5vw, 36px)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          Labs & imaging
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Pill tone="neutral">{resultItems.length} total</Pill>
          {readyCount > 0 && <Pill tone="ok">{readyCount} resulted</Pill>}
          {pendingCount > 0 && (
            <Pill tone="warn" dot>
              {pendingCount} pending
            </Pill>
          )}
        </div>
        <p className="mt-3 max-w-xl text-[13.5px]" style={{ color: "var(--ink-2)" }}>
          Review lab and imaging orders and results linked to this chart.
        </p>
      </div>

      {resultItems.length === 0 ? (
        <ClearingCard>
          <div
            className="py-12 text-center text-[13px]"
            style={{ color: "var(--ink-3)" }}
          >
            No lab or imaging items have been documented yet.
          </div>
        </ClearingCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {resultItems.map((item) => {
            const dateDisplay = item.dateOrdered
              ? new Date(item.dateOrdered).toLocaleDateString()
              : item.visitDate.toLocaleDateString();
            return (
              <ClearingCard key={item.id} pad={0}>
                <div
                  className="flex flex-wrap items-center gap-2 px-5 py-4"
                  style={{ borderBottom: "1px solid var(--line)" }}
                >
                  <div
                    className="serif min-w-0 flex-1 truncate"
                    style={{ fontSize: 17, letterSpacing: "-0.01em", color: "var(--ink)" }}
                  >
                    {item.details || item.type || "Order"}
                  </div>
                  <Pill tone="neutral">{item.type || "Result"}</Pill>
                </div>
                <div className="flex flex-col gap-2.5 px-5 py-4 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] uppercase"
                      style={{ color: "var(--ink-3)", letterSpacing: "0.08em", minWidth: 72 }}
                    >
                      Status
                    </span>
                    <Pill tone={statusTone(item.status)} dot={statusTone(item.status) === "warn"}>
                      {item.status
                        ? item.status.charAt(0).toUpperCase() +
                          item.status.slice(1).replace(/_/g, " ")
                        : "Pending"}
                    </Pill>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[11px] uppercase"
                      style={{ color: "var(--ink-3)", letterSpacing: "0.08em", minWidth: 72 }}
                    >
                      Priority
                    </span>
                    <Pill tone={priorityTone(item.priority)}>
                      {item.priority || "Routine"}
                    </Pill>
                  </div>
                  <div
                    className="flex items-center gap-2"
                    style={{ color: "var(--ink-2)" }}
                  >
                    <span
                      className="text-[11px] uppercase"
                      style={{ color: "var(--ink-3)", letterSpacing: "0.08em", minWidth: 72 }}
                    >
                      Ordered
                    </span>
                    <span className="mono text-[12px]" style={{ color: "var(--ink)" }}>
                      {dateDisplay}
                    </span>
                    <span style={{ color: "var(--ink-3)" }}>·</span>
                    <span style={{ color: "var(--ink-2)" }}>
                      {item.orderedByName || "Care team"}
                    </span>
                  </div>
                </div>
              </ClearingCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
