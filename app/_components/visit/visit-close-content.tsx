"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSignature, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { finalizeVisitAction, updatePatientAssignedAction, updateVisitDraftAction } from "@/app/_actions/visits";
import { searchProvidersAction } from "@/app/_actions/users";
import type { VisitNote } from "@/app/_lib/visit-note/schema";
import { enrichCodingSuggestions, validateNoteForSignOff } from "@/app/_lib/visit-note/sign-off";

interface VisitCloseContentProps {
  patientId: string;
  patientName: string;
  visitId: string;
  initialNote: VisitNote;
}

interface ProviderSearchResult {
  id: string;
  name: string | null;
  email: string;
  role: string | null;
}

const summarySections = [
  {
    id: "subjective",
    title: "Subjective",
    render: (note: VisitNote) => `${note.subjective.chiefComplaint || "No chief complaint"}\n\n${note.subjective.hpi || "No HPI documented"}`,
  },
  {
    id: "ros",
    title: "Review of Systems",
    render: (note: VisitNote) =>
      Object.entries(note.reviewOfSystems)
        .filter(([, value]) => value.status !== "not-reviewed")
        .map(([key, value]) => `${key}: ${value.status}${value.notes ? ` - ${value.notes}` : ""}`)
        .join("\n") || "No ROS documented",
  },
  {
    id: "objective",
    title: "Objective / Exam",
    render: (note: VisitNote) =>
      [
        note.objective.bp && `BP ${note.objective.bp}`,
        note.objective.hr && `HR ${note.objective.hr}`,
        note.objective.temp && `Temp ${note.objective.temp}`,
        ...Object.entries(note.objective.examFindings)
          .filter(([, value]) => Boolean(value))
          .map(([key, value]) => `${key}: ${value}`),
      ]
        .filter(Boolean)
        .join("\n") || "No objective findings documented",
  },
  {
    id: "assessment",
    title: "Assessment & Plan",
    render: (note: VisitNote) =>
      note.assessmentPlan
        .map(
          (entry, index) =>
            `${index + 1}. ${entry.assessment || "Assessment pending"}\n${entry.plan || "Plan pending"}`
        )
        .join("\n\n") || "No assessment and plan documented",
  },
  {
    id: "actions",
    title: "Orders / Actions",
    render: (note: VisitNote) =>
      [
        ...note.orders.map((order) => `${order.type || "Order"}: ${order.details || "Details pending"}`),
        ...note.visitActions.prescriptions.map((item) => `Prescription: ${item.medication || "Medication pending"}`),
        ...note.visitActions.labs.map((item) => `Lab: ${item.test || "Lab pending"}`),
        ...note.visitActions.imaging.map((item) => `Imaging: ${item.study || "Imaging pending"}`),
        ...note.visitActions.referrals.map((item) => `Referral: ${item.specialty || "Referral pending"}`),
        ...note.visitActions.nextSteps.map((item) => `Next step: ${item.task || "Task pending"}`),
      ].join("\n") || "No actions staged",
  },
];

export function VisitCloseContent({
  patientId,
  patientName,
  visitId,
  initialNote,
}: VisitCloseContentProps) {
  const router = useRouter();
  const [note, setNote] = React.useState<VisitNote>(() => enrichCodingSuggestions(initialNote));
  const [isSigning, setIsSigning] = React.useState(false);
  const [pendingIcd10Code, setPendingIcd10Code] = React.useState("");
  const [pendingCptCode, setPendingCptCode] = React.useState("");
  const [codeErrors, setCodeErrors] = React.useState<{ icd10Codes?: string; cptCodes?: string }>(
    {}
  );
  const [providerQuery, setProviderQuery] = React.useState(
    initialNote.coSign.requestedFrom || ""
  );
  const [providerResults, setProviderResults] = React.useState<ProviderSearchResult[]>([]);
  const [isSearchingProviders, setIsSearchingProviders] = React.useState(false);
  const [isSendingCoSignRequest, setIsSendingCoSignRequest] = React.useState(false);

  React.useEffect(() => {
    setProviderQuery(note.coSign.requestedFrom || "");
  }, [note.coSign.requestedFrom]);

  React.useEffect(() => {
    if (!note.coSign.requested) {
      setProviderResults([]);
      return;
    }

    const query = providerQuery.trim();
    if (!query || note.coSign.requestedFrom === query) {
      setProviderResults([]);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setIsSearchingProviders(true);
        const results = (await searchProvidersAction(query)) as ProviderSearchResult[];
        setProviderResults(results);
      } catch (error) {
        console.error("Error searching providers:", error);
        setProviderResults([]);
      } finally {
        setIsSearchingProviders(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [note.coSign.requested, note.coSign.requestedFrom, providerQuery]);

  const updateList = React.useCallback(
    (field: "icd10Codes" | "cptCodes", value: string[]) => {
      setNote((current) => ({
        ...current,
        coding: {
          ...current.coding,
          [field]: value,
        },
      }));
    },
    []
  );

  const addCodeToList = React.useCallback(
    (field: "icd10Codes" | "cptCodes", value: string) => {
      const trimmedValue = value.trim().toUpperCase();
      const validator =
        field === "icd10Codes"
          ? /^[A-TV-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/
          : /^[0-9]{5}[A-Z]?$/;

      if (!trimmedValue) {
        return false;
      }

      if (!validator.test(trimmedValue)) {
        setCodeErrors((current) => ({
          ...current,
          [field]:
            field === "icd10Codes"
              ? "Invalid ICD-10 format (e.g. J06.9)"
              : "Invalid CPT format (e.g. 99214)",
        }));
        return false;
      }

      setCodeErrors((current) => ({
        ...current,
        [field]: undefined,
      }));
      updateList(
        field,
        Array.from(new Set([...note.coding[field], trimmedValue]))
      );
      return true;
    },
    [note.coding, updateList]
  );

  const removeCodeFromList = React.useCallback(
    (field: "icd10Codes" | "cptCodes", code: string) => {
      updateList(
        field,
        note.coding[field].filter((entry) => entry !== code)
      );
    },
    [note.coding, updateList]
  );

  const selectProvider = React.useCallback((provider: ProviderSearchResult) => {
    const displayName = provider.name?.trim() || provider.email;
    setProviderQuery(displayName);
    setProviderResults([]);
    setNote((current) => ({
      ...current,
      coSign: {
        ...current.coSign,
        requested: true,
        requestedFrom: displayName,
        requestedFromUserId: provider.id,
      },
    }));
  }, []);

  const handleSendCoSignRequest = React.useCallback(async () => {
    if (!note.coSign.requestedFromUserId || !note.coSign.requestedFrom) {
      toast.error("Select a co-sign provider before sending the request.");
      return;
    }

    setIsSendingCoSignRequest(true);
    try {
      const response = await fetch(`/api/visits/${visitId}/cosign-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestedFrom: note.coSign.requestedFrom,
          requestedFromUserId: note.coSign.requestedFromUserId,
          reason: note.coSign.reason,
        }),
      });

      const payload = (await response.json()) as {
        ok: boolean;
        error?: string;
        coSign?: VisitNote["coSign"];
      };

      if (!response.ok || !payload.ok || !payload.coSign) {
        throw new Error(payload.error || "Failed to send co-sign request");
      }

      setNote((current) => ({
        ...current,
        coSign: payload.coSign!,
      }));
      toast.success("Co-sign request sent");
    } catch (error) {
      console.error("Error sending co-sign request:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send co-sign request"
      );
    } finally {
      setIsSendingCoSignRequest(false);
    }
  }, [note.coSign, visitId]);

  const signErrors = validateNoteForSignOff(note);

  const handleSign = async () => {
    const nextNote: VisitNote = {
      ...note,
      signOff: {
        ...note.signOff,
        signedAt: new Date().toISOString(),
      },
    };

    const validationErrors = validateNoteForSignOff(nextNote);
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    setIsSigning(true);
    try {
      await updateVisitDraftAction(visitId, {
        notesJson: nextNote,
      });
      await finalizeVisitAction(visitId, "signed");
      await updatePatientAssignedAction(patientId, null);
      toast.success("Visit signed and closed");
      router.push(`/patients/${patientId}/visit-history/${visitId}`);
      router.refresh();
    } catch (error) {
      console.error("Error signing visit:", error);
      toast.error(error instanceof Error ? error.message : "Failed to sign visit");
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Visit Close / Sign-off</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Review the completed note for {patientName}, confirm coding, and
            complete the irreversible close-out.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/patients/${patientId}/new-visit?visitId=${visitId}`}>
              Return to note
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/patients/${patientId}/visit-history/${visitId}`}>
              View history
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-semibold">Irreversible sign-off</div>
            <div className="mt-1">
              Sign &amp; Close should only be used once documentation, ICD-10,
              CPT, orders, and follow-up plans are final. Reopening a signed note
              must go through the amendment flow.
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
        <Card className="h-fit xl:sticky xl:top-6">
          <CardHeader>
            <CardTitle className="text-base">Section anchors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summarySections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {section.title}
              </a>
            ))}
            <a
              href="#coding"
              className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Coding
            </a>
            <a
              href="#signature"
              className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Signature
            </a>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {summarySections.map((section) => (
            <Card key={section.id} id={section.id}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {section.render(note)}
                </pre>
              </CardContent>
            </Card>
          ))}

          <Card id="coding">
            <CardHeader>
              <CardTitle>Coding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ICD-10 codes</Label>
                  <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border bg-background p-2">
                    {note.coding.icd10Codes.length > 0 ? (
                      note.coding.icd10Codes.map((code) => (
                        <Badge
                          key={code}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          {code}
                          <button
                            type="button"
                            className="rounded-full p-0.5 transition hover:bg-background/70"
                            onClick={() => removeCodeFromList("icd10Codes", code)}
                            aria-label={`Remove ${code}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No ICD-10 codes added yet.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={pendingIcd10Code}
                      onChange={(event) => {
                        setPendingIcd10Code(event.target.value);
                        if (codeErrors.icd10Codes) {
                          setCodeErrors((current) => ({
                            ...current,
                            icd10Codes: undefined,
                          }));
                        }
                      }}
                      placeholder="Add code"
                      aria-label="Add ICD-10 code"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const added = addCodeToList("icd10Codes", pendingIcd10Code);
                        if (added) {
                          setPendingIcd10Code("");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {codeErrors.icd10Codes && (
                    <p className="text-sm text-destructive">{codeErrors.icd10Codes}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {note.coding.suggestedIcd10Codes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        className="rounded-full border px-2 py-1 text-xs"
                        onClick={() =>
                          addCodeToList("icd10Codes", code)
                        }
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>CPT codes</Label>
                  <div className="flex min-h-11 flex-wrap gap-2 rounded-lg border bg-background p-2">
                    {note.coding.cptCodes.length > 0 ? (
                      note.coding.cptCodes.map((code) => (
                        <Badge
                          key={code}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          {code}
                          <button
                            type="button"
                            className="rounded-full p-0.5 transition hover:bg-background/70"
                            onClick={() => removeCodeFromList("cptCodes", code)}
                            aria-label={`Remove ${code}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No CPT codes added yet.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={pendingCptCode}
                      onChange={(event) => {
                        setPendingCptCode(event.target.value);
                        if (codeErrors.cptCodes) {
                          setCodeErrors((current) => ({
                            ...current,
                            cptCodes: undefined,
                          }));
                        }
                      }}
                      placeholder="Add code"
                      aria-label="Add CPT code"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const added = addCodeToList("cptCodes", pendingCptCode);
                        if (added) {
                          setPendingCptCode("");
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {codeErrors.cptCodes && (
                    <p className="text-sm text-destructive">{codeErrors.cptCodes}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {note.coding.suggestedCptCodes.map((code) => (
                      <button
                        key={code}
                        type="button"
                        className="rounded-full border px-2 py-1 text-xs"
                        onClick={() =>
                          addCodeToList("cptCodes", code)
                        }
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>MDM complexity</Label>
                  <Input
                    value={note.coding.mdmComplexity}
                    onChange={(event) =>
                      setNote((current) => ({
                        ...current,
                        coding: {
                          ...current.coding,
                          mdmComplexity: event.target.value,
                        },
                      }))
                    }
                    placeholder="low / moderate / high"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Visit duration (minutes)</Label>
                  <Input
                    value={note.coding.visitDurationMinutes}
                    onChange={(event) =>
                      setNote((current) => ({
                        ...current,
                        coding: {
                          ...current.coding,
                          visitDurationMinutes: event.target.value,
                        },
                      }))
                    }
                    placeholder="e.g. 35"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Co-sign request</Label>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="cosign"
                    checked={note.coSign.requested}
                    onCheckedChange={(checked) =>
                      setNote((current) => ({
                        ...current,
                        coSign: {
                          ...current.coSign,
                          requested: checked === true,
                          status: checked === true ? current.coSign.status : "not-requested",
                        },
                      }))
                    }
                  />
                  <Label htmlFor="cosign">Request co-sign before billing release</Label>
                </div>
                {note.coSign.requested && (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="relative space-y-2">
                        <Label>Requested from</Label>
                        <Input
                          value={providerQuery}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setProviderQuery(nextValue);
                            setNote((current) => ({
                              ...current,
                              coSign: {
                                ...current.coSign,
                                requestedFrom: nextValue,
                                requestedFromUserId: "",
                              },
                            }));
                          }}
                          placeholder="Search doctors by name or email"
                        />
                        {isSearchingProviders && (
                          <p className="text-xs text-muted-foreground">
                            Searching providers...
                          </p>
                        )}
                        {providerResults.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-background p-1 shadow-lg">
                            {providerResults.map((provider) => {
                              const displayName = provider.name?.trim() || provider.email;
                              return (
                                <button
                                  key={provider.id}
                                  type="button"
                                  className="flex w-full flex-col rounded-md px-3 py-2 text-left text-sm transition hover:bg-muted"
                                  onClick={() => selectProvider(provider)}
                                >
                                  <span className="font-medium">{displayName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {provider.email}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Reason</Label>
                        <Input
                          value={note.coSign.reason}
                          onChange={(event) =>
                            setNote((current) => ({
                              ...current,
                              coSign: {
                                ...current.coSign,
                                reason: event.target.value,
                              },
                            }))
                          }
                          placeholder="Reason"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSendCoSignRequest}
                        disabled={
                          isSendingCoSignRequest || !note.coSign.requestedFromUserId
                        }
                      >
                        {isSendingCoSignRequest ? "Sending..." : "Send Request"}
                      </Button>
                      {note.coSign.status && note.coSign.status !== "not-requested" && (
                        <Badge variant="secondary">
                          Co-sign status: {note.coSign.status}
                        </Badge>
                      )}
                    </div>
                    {note.coSign.requestedAt && (
                      <p className="text-xs text-muted-foreground">
                        Requested{" "}
                        {new Date(note.coSign.requestedAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card id="signature">
            <CardHeader>
              <CardTitle>Signature block</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="attestation"
                  checked={note.signOff.attestationAccepted}
                  onCheckedChange={(checked) =>
                    setNote((current) => ({
                      ...current,
                      signOff: {
                        ...current.signOff,
                        attestationAccepted: checked === true,
                      },
                    }))
                  }
                />
                <Label htmlFor="attestation" className="leading-5">
                  I have reviewed this note, confirmed required ICD-10 and CPT
                  codes, and understand that Sign &amp; Close is irreversible
                  without an amendment.
                </Label>
              </div>
              <div className="space-y-2">
                <Label>Amendment / co-sign notes</Label>
                <Textarea
                  value={note.signOff.amendmentReason}
                  onChange={(event) =>
                    setNote((current) => ({
                      ...current,
                      signOff: {
                        ...current.signOff,
                        amendmentReason: event.target.value,
                      },
                    }))
                  }
                  rows={3}
                  placeholder="Optional notes for close-out or amendment context"
                />
              </div>
              {signErrors.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  <div className="font-semibold">Close-out requirements</div>
                  <ul className="mt-2 list-disc pl-5">
                    {signErrors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleSign}
                  disabled={isSigning || signErrors.length > 0}
                  className="min-w-[180px]"
                >
                  {isSigning ? (
                    "Signing..."
                  ) : (
                    <>
                      <FileSignature className="mr-2 h-4 w-4" />
                      Sign & Close
                    </>
                  )}
                </Button>
                <Badge variant={signErrors.length === 0 ? "default" : "outline"}>
                  {signErrors.length === 0 ? "Ready to close" : "Action required"}
                </Badge>
                {signErrors.length === 0 && (
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Validated for close-out
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
