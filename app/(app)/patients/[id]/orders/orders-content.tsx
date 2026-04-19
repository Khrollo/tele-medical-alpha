"use client";

import * as React from "react";
import {
  Plus,
  Search,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Filter,
  Calendar,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Btn,
  ClearingCard,
  Pill,
  SubTabHeader,
  type PillTone,
} from "@/components/ui/clearing";
import type { Order } from "@/app/_actions/orders";

interface OrdersContentProps {
  patientId: string;
  patientName: string;
  orders: Order[];
}

type OrderType = "all" | "medications" | "labs" | "imaging";

function statusTone(status: string): { tone: PillTone; label: string } {
  const s = (status || "").toLowerCase();
  if (!status) return { tone: "neutral", label: "N/A" };
  if (s.includes("cancel")) return { tone: "neutral", label: status };
  if (s.includes("complete") || s.includes("fulfill") || s.includes("result"))
    return { tone: "ok", label: status };
  if (s.includes("pending") || s.includes("approval"))
    return { tone: "warn", label: status };
  if (s.includes("lab") || s.includes("progress") || s.includes("in-progress"))
    return { tone: "info", label: status };
  return { tone: "neutral", label: status };
}

function priorityTone(priority: string): { tone: PillTone; label: string } {
  const p = (priority || "").toLowerCase();
  if (!priority) return { tone: "neutral", label: "N/A" };
  if (p === "stat" || p === "urgent")
    return { tone: "critical", label: priority };
  if (p === "routine" || p === "normal")
    return { tone: "info", label: priority };
  return { tone: "neutral", label: priority };
}

export function OrdersContent({
  patientName,
  orders: initialOrders,
}: OrdersContentProps) {
  const [orders] = React.useState<Order[]>(initialOrders);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedType, setSelectedType] = React.useState<OrderType>("all");

  // Calculate summary statistics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const ordersToday = orders.filter((order) => {
    const orderDate = order.dateOrdered
      ? new Date(order.dateOrdered)
      : new Date(order.visitDate);
    if (isNaN(orderDate.getTime())) return false;
    orderDate.setHours(0, 0, 0, 0);
    return orderDate.getTime() === today.getTime();
  });

  const pendingApproval = orders.filter(
    (order) =>
      order.status?.toLowerCase().includes("pending") ||
      order.status?.toLowerCase().includes("approval")
  );

  const statOrders = orders.filter(
    (order) =>
      order.priority?.toLowerCase() === "stat" ||
      order.priority?.toLowerCase() === "urgent"
  );

  const completed = orders.filter(
    (order) =>
      order.status?.toLowerCase().includes("completed") ||
      order.status?.toLowerCase().includes("fulfilled")
  );

  // Filter orders based on type and search
  const filteredOrders = React.useMemo(() => {
    let filtered = orders;

    // Filter by type
    if (selectedType !== "all") {
      filtered = filtered.filter((order) => {
        const orderType = order.type?.toLowerCase() || "";
        return orderType.includes(selectedType);
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.details?.toLowerCase().includes(query) ||
          order.type?.toLowerCase().includes(query) ||
          order.status?.toLowerCase().includes(query) ||
          order.orderedByName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [orders, selectedType, searchQuery]);

  const formatDate = (date: Date | string) => {
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
  };

  const summaryMetrics: Array<{
    k: string;
    v: number;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    tone: string;
  }> = [
    { k: "Orders today", v: ordersToday.length, icon: FileText, tone: "var(--info)" },
    {
      k: "Pending approval",
      v: pendingApproval.length,
      icon: Clock,
      tone: "var(--warn)",
    },
    { k: "STAT orders", v: statOrders.length, icon: AlertCircle, tone: "var(--critical)" },
    { k: "Completed", v: completed.length, icon: CheckCircle, tone: "var(--ok)" },
  ];

  const typeTabs: Array<[OrderType, string, number]> = [
    ["all", "All types", orders.length],
    [
      "medications",
      "Medications",
      orders.filter((o) =>
        o.type?.toLowerCase().includes("medication")
      ).length,
    ],
    [
      "labs",
      "Labs",
      orders.filter((o) => o.type?.toLowerCase().includes("lab")).length,
    ],
    [
      "imaging",
      "Imaging",
      orders.filter((o) => o.type?.toLowerCase().includes("imaging")).length,
    ],
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <SubTabHeader
        eyebrow="Chart · Orders"
        title="Orders"
        subtitle={`Manage lab, imaging, and medication orders for ${patientName}.`}
        actions={
          <Btn kind="accent" icon={<Plus className="h-4 w-4" />}>
            New order
          </Btn>
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

      {/* Orders table card */}
      <ClearingCard pad={0}>
        <div
          className="flex flex-wrap items-center gap-3 px-5 py-3.5"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <div
            className="serif"
            style={{ fontSize: 18, color: "var(--ink)", letterSpacing: "-0.01em" }}
          >
            Orders management
          </div>
          <div className="flex-1" />
          <div
            className="flex gap-1 rounded-full p-1"
            style={{ border: "1px solid var(--line)", background: "var(--paper-2)" }}
          >
            {typeTabs.map(([k, label, n]) => {
              const active = selectedType === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedType(k)}
                  className="h-7 rounded-full px-3.5 text-[12.5px] font-medium tracking-tight transition-colors"
                  style={{
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "var(--ink-2)",
                  }}
                >
                  {label} <span className="mono ml-1 opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--ink-3)" }}
              />
              <Input
                placeholder="Search orders…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full pl-9 text-[12.5px] sm:w-[220px]"
              />
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md"
              style={{ color: "var(--ink-2)", border: "1px solid var(--line)" }}
              aria-label="Filter"
            >
              <Filter className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
              No orders recorded yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line)" }}>
                  {[
                    "Order details",
                    "Type",
                    "Priority",
                    "Status",
                    "Date",
                    "Ordered by",
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
                {filteredOrders.map((order, i, arr) => {
                  const st = statusTone(order.status);
                  const pr = priorityTone(order.priority);
                  return (
                    <tr
                      key={order.id}
                      style={{
                        borderBottom:
                          i < arr.length - 1
                            ? "1px solid var(--line)"
                            : undefined,
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
                          className="max-w-md text-[13.5px] font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {order.details || "No details"}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="mono text-[11.5px] uppercase"
                          style={{ color: "var(--ink-2)", letterSpacing: "0.05em" }}
                        >
                          {order.type || "N/A"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={pr.tone} dot={pr.tone === "critical"}>
                          {pr.label}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={st.tone} dot={st.tone === "critical" || st.tone === "warn"}>
                          {st.label}
                        </Pill>
                      </td>
                      <td className="px-5 py-3">
                        <div
                          className="flex items-center gap-1.5 text-[12.5px]"
                          style={{ color: "var(--ink-2)" }}
                        >
                          <Calendar
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--ink-3)" }}
                          />
                          <span className="mono nowrap">
                            {order.dateOrdered
                              ? formatDate(order.dateOrdered)
                              : formatDate(order.visitDate)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div
                          className="flex items-center gap-1.5 text-[12.5px]"
                          style={{ color: "var(--ink-2)" }}
                        >
                          <User
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--ink-3)" }}
                          />
                          <span>{order.orderedByName || "N/A"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ClearingCard>
    </div>
  );
}
