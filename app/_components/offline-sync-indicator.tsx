"use client";

import { useState } from "react";
import { useOffline } from "./providers/offline-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { getOperationsByStatus } from "@/app/_lib/offline/repos/outbox.repo";
import { getSyncEngine } from "@/app/_lib/offline/sync-engine";
import { toast } from "sonner";

export function OfflineSyncIndicator() {
  const { isOnline, pendingCount, syncing, failedCount } = useOffline();
  const [showDialog, setShowDialog] = useState(false);
  const [failedOps, setFailedOps] = useState<unknown[]>([]);

  const loadFailedOperations = async () => {
    try {
      const ops = await getOperationsByStatus("failed");
      setFailedOps(ops);
    } catch (error) {
      console.error("Error loading failed operations:", error);
    }
  };

  const handleRetry = async () => {
    const syncEngine = getSyncEngine();
    syncEngine.start();
    toast.info("Retrying failed operations...");
    setShowDialog(false);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Online/Offline Badge */}
      <Badge
        variant={isOnline ? "default" : "secondary"}
        className="flex items-center gap-1"
      >
        {isOnline ? (
          <>
            <Wifi className="h-3 w-3" />
            Online
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3" />
            Offline
          </>
        )}
      </Badge>

      {/* Pending Count */}
      {pendingCount > 0 && (
        <Badge variant="outline" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          {pendingCount} pending
        </Badge>
      )}

      {/* Syncing Indicator */}
      {syncing && (
        <Badge variant="outline" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Syncing...
        </Badge>
      )}

      {/* Failed Operations Dialog */}
      {failedCount > 0 && (
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={loadFailedOperations}
            >
              <AlertCircle className="h-4 w-4" />
              {failedCount} failed
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Failed Operations</DialogTitle>
              <DialogDescription>
                {failedCount} operation(s) failed to sync. You can retry them
                now.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {failedOps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No failed operations found.
                  </p>
                ) : (
                  failedOps.map((op: any, index) => (
                    <div key={op.id || index} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{op.type}</p>
                          <p className="text-xs text-muted-foreground">
                            {op.endpoint}
                          </p>
                        </div>
                        <Badge variant="destructive">Failed</Badge>
                      </div>
                      {op.lastError && (
                        <p className="text-xs text-destructive">
                          {op.lastError}
                        </p>
                      )}
                      {index < failedOps.length - 1 && (
                        <Separator className="my-2" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Close
              </Button>
              <Button onClick={handleRetry} disabled={!isOnline}>
                Retry All
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
