"use client";

import * as React from "react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Clock } from "lucide-react";
import { formatDateTime } from "@/app/_lib/utils/format-date";
import { formatVisitStatusLabel } from "@/app/_lib/utils/visit-status-label";

interface OpenVisit {
  id: string;
  patientId: string;
  patientName: string;
  status: string | null;
  priority: string | null;
  appointmentType: string | null;
  createdAt: Date;
  patientJoinToken: string | null;
  twilioRoomName: string | null;
}

interface DoctorInboxDailySummary {
  closedTodayCount: number;
  unclosedTodayCount: number;
  todayNotes: Array<{
    visitId: string;
    patientId: string;
    patientName: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    status: string | null;
    notesStatus: string | null;
    authorId: string | null;
    authorRole: string | null;
  }>;
}

interface OpenNotesContentProps {
  visits: OpenVisit[];
  dailySummary: DoctorInboxDailySummary;
}

function isClosedStatus(status: string | null): boolean {
  return status === "Signed & Complete";
}

export function OpenNotesContent({ visits, dailySummary }: OpenNotesContentProps) {
  const [searchQuery, setSearchQuery] = useState("");

  React.useEffect(() => {
    const topBarSearch = document.getElementById("open-notes-search") as HTMLInputElement | null;
    if (!topBarSearch) {
      return;
    }

    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement;
      setSearchQuery(target.value);
    };

    topBarSearch.addEventListener("input", handleInput);
    if (topBarSearch.value !== searchQuery) {
      topBarSearch.value = searchQuery;
    }

    return () => {
      topBarSearch.removeEventListener("input", handleInput);
    };
  }, [searchQuery]);

  const sortedNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = dailySummary.todayNotes.filter((note) => {
      if (!query) return true;
      return (
        note.patientName.toLowerCase().includes(query) ||
        (note.status?.toLowerCase().includes(query) ?? false)
      );
    });

    return filtered.sort((a, b) => {
      const aClosed = isClosedStatus(a.status);
      const bClosed = isClosedStatus(b.status);

      if (aClosed !== bClosed) {
        return aClosed ? 1 : -1;
      }

      const aTime = new Date(a.updatedAt).getTime();
      const bTime = new Date(b.updatedAt).getTime();
      return bTime - aTime;
    });
  }, [dailySummary.todayNotes, searchQuery]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Daily physician note queue, ordered by what still needs attention first.
        </p>
      </div>

      {sortedNotes.length === 0 && dailySummary.todayNotes.length > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No notes found matching your search</p>
          </CardContent>
        </Card>
      ) : dailySummary.todayNotes.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No note activity assigned for today</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {sortedNotes.map((note) => {
            const closed = isClosedStatus(note.status);
            const linkedVisit = visits.find((visit) => visit.id === note.visitId);

            return (
              <Card key={note.visitId} className="w-full hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {note.patientName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Updated:</span>
                    <span className="font-medium">
                      {formatDateTime(new Date(note.updatedAt))}
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    {formatVisitStatusLabel(note.status)}
                    {linkedVisit?.appointmentType ? ` • ${linkedVisit.appointmentType}` : ""}
                  </div>

                  <Button asChild className="w-full" variant={closed ? "outline" : "default"}>
                    <Link
                      href={
                        closed
                          ? `/patients/${note.patientId}/visit-history?visitId=${note.visitId}`
                          : `/patients/${note.patientId}/new-visit?visitId=${note.visitId}`
                      }
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      {closed ? "View Note" : "Continue Note"}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
