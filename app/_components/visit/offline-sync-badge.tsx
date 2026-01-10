"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/app/_lib/utils/cn";

interface OfflineSyncBadgeProps {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  className?: string;
}

export function OfflineSyncBadge({
  isOnline,
  pendingCount,
  isSyncing,
  className,
}: OfflineSyncBadgeProps) {
  return (
    <Badge
      variant={isOnline ? "default" : "secondary"}
      className={cn("gap-1.5", className)}
    >
      {isOnline ? (
        <Wifi className="h-3 w-3" />
      ) : (
        <WifiOff className="h-3 w-3" />
      )}
      {isSyncing && <RefreshCw className="h-3 w-3 animate-spin" />}
      <span>
        {isOnline
          ? isSyncing
            ? "Syncing..."
            : pendingCount > 0
            ? `${pendingCount} pending`
            : "Online"
          : `${pendingCount} queued`}
      </span>
    </Badge>
  );
}

