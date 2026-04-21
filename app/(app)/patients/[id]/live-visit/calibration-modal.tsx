"use client";

import * as React from "react";
import {
    AlertTriangle,
    Check,
    ChevronRight,
    Loader2,
    Mic,
    MicOff,
    Radio,
    ShieldCheck,
    Volume2,
    Wifi,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
    formatDbLabel,
    pingParseEndpoint,
    saveCalibration,
    supportsLiveCapture,
    useDeviceList,
    useLevelMeter,
    useMicPermission,
    useNoiseFloor,
    type CalibrationResult,
} from "@/app/_lib/audio/calibration";

type Step = "support" | "permission" | "device" | "noise" | "ping" | "done";

const STEPS: readonly Step[] = [
    "support",
    "permission",
    "device",
    "noise",
    "ping",
    "done",
] as const;

const STEP_LABEL: Record<Step, string> = {
    support: "Browser",
    permission: "Microphone",
    device: "Input",
    noise: "Room noise",
    ping: "AI",
    done: "Ready",
};

export interface CalibrationModalProps {
    open: boolean;
    onCancel: () => void;
    onComplete: (
        result: CalibrationResult,
        stream: MediaStream,
        consentAtIso: string
    ) => void;
}

export function CalibrationModal({ open, onCancel, onComplete }: CalibrationModalProps) {
    const [step, setStep] = React.useState<Step>("support");
    const [stream, setStream] = React.useState<MediaStream | null>(null);
    const [selectedDeviceId, setSelectedDeviceId] = React.useState<string>("");
    const [ping, setPing] = React.useState<{
        status: "idle" | "checking" | "ok" | "error";
        error?: string;
    }>({ status: "idle" });
    const [peakSeen, setPeakSeen] = React.useState<number>(-100);
    const [consentGiven, setConsentGiven] = React.useState(false);
    const consentAtRef = React.useRef<string | null>(null);

    const support = React.useMemo(() => supportsLiveCapture(), []);
    const { permission, request, error: permError } = useMicPermission();
    const { devices, refresh } = useDeviceList(permission === "granted");
    const level = useLevelMeter(stream);
    const { state: noiseState, start: startNoiseMeasurement, reset: resetNoise } =
        useNoiseFloor(stream);

    React.useEffect(() => {
        if (level.db > peakSeen) setPeakSeen(level.db);
    }, [level.db, peakSeen]);

    React.useEffect(() => {
        if (!open) {
            setStep("support");
            setPing({ status: "idle" });
            setPeakSeen(-100);
            setConsentGiven(false);
            consentAtRef.current = null;
            resetNoise();
            if (stream) {
                stream.getTracks().forEach((t) => t.stop());
                setStream(null);
            }
        } else {
            setStep("support");
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRequestPermission = React.useCallback(async () => {
        const s = await request();
        if (s) {
            setStream(s);
            const track = s.getAudioTracks()[0];
            const id = track?.getSettings().deviceId;
            if (id) setSelectedDeviceId(id);
            await refresh();
            setStep("device");
        }
    }, [request, refresh]);

    const handleDeviceSelect = React.useCallback(
        async (deviceId: string) => {
            if (stream) stream.getTracks().forEach((t) => t.stop());
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        deviceId: deviceId ? { exact: deviceId } : undefined,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                    },
                });
                setStream(s);
                setSelectedDeviceId(deviceId);
                setPeakSeen(-100);
            } catch (err) {
                console.error("Failed to switch device", err);
            }
        },
        [stream]
    );

    const handleStartNoise = React.useCallback(() => {
        setStep("noise");
        startNoiseMeasurement();
    }, [startNoiseMeasurement]);

    const finishCalibration = React.useCallback(() => {
        if (!stream || noiseState.status !== "done") return;
        const track = stream.getAudioTracks()[0];
        const settings = track?.getSettings();
        const result: CalibrationResult = {
            deviceId: selectedDeviceId || settings?.deviceId || "default",
            deviceLabel:
                devices.find((d) => d.deviceId === selectedDeviceId)?.label ||
                track?.label ||
                "Microphone",
            noiseFloorDb: noiseState.noiseFloorDb,
            peakDb: peakSeen,
            sampleRate: settings?.sampleRate ?? 48000,
            savedAt: Date.now(),
        };
        saveCalibration(result);
        setStep("done");
        onComplete(result, stream, consentAtRef.current ?? new Date().toISOString());
    }, [stream, noiseState, selectedDeviceId, devices, peakSeen, onComplete]);

    const runPing = React.useCallback(async () => {
        setStep("ping");
        setPing({ status: "checking" });
        const result = await pingParseEndpoint();
        if (result.ok) {
            setPing({ status: "ok" });
        } else {
            setPing({ status: "error", error: result.error });
        }
    }, []);

    // Auto-advance: once noise-floor done → run the AI ping.
    React.useEffect(() => {
        if (step === "noise" && noiseState.status === "done") {
            const t = setTimeout(() => void runPing(), 400);
            return () => clearTimeout(t);
        }
    }, [step, noiseState.status, runPing]);

    // Auto-advance: once ping ok → finish calibration and hand off stream.
    // This effect watches fresh state so we don't capture a stale
    // `finishCalibration` reference inside `runPing`.
    React.useEffect(() => {
        if (step === "ping" && ping.status === "ok") {
            const t = setTimeout(() => finishCalibration(), 400);
            return () => clearTimeout(t);
        }
    }, [step, ping.status, finishCalibration]);

    const handleCancel = React.useCallback(() => {
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            setStream(null);
        }
        resetNoise();
        onCancel();
    }, [stream, resetNoise, onCancel]);

    const voiceDetected = peakSeen > -40;
    const currentIdx = STEPS.indexOf(step);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) handleCancel();
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Radio className="size-5 text-[var(--brand-ink)]" />
                        Calibrate your microphone
                    </DialogTitle>
                </DialogHeader>

                <StepStrip currentIdx={currentIdx} />

                <div className="space-y-4">
                    {step === "support" && (
                        <>
                            <SupportStep
                                support={support}
                                consentGiven={consentGiven}
                                onContinue={() => setStep("permission")}
                            />
                            <ConsentRow
                                consentGiven={consentGiven}
                                onChange={(value) => {
                                    setConsentGiven(value);
                                    if (value) consentAtRef.current = new Date().toISOString();
                                }}
                            />
                        </>
                    )}

                    {step === "permission" && (
                        <PermissionStep
                            permission={permission}
                            error={permError}
                            onRequest={handleRequestPermission}
                        />
                    )}

                    {step === "device" && (
                        <DeviceStep
                            devices={devices}
                            selected={selectedDeviceId}
                            onSelect={handleDeviceSelect}
                            level={level.level}
                            db={level.db}
                            peakDb={level.peak}
                            voiceDetected={voiceDetected}
                            onContinue={handleStartNoise}
                        />
                    )}

                    {step === "noise" && <NoiseStep state={noiseState} />}

                    {step === "ping" && (
                        <PingStep
                            status={ping.status}
                            error={ping.error}
                            onRetry={runPing}
                            onSkip={finishCalibration}
                        />
                    )}

                    {step === "done" && <DoneStep />}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StepStrip({ currentIdx }: { currentIdx: number }) {
    return (
        <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
                const passed = i < currentIdx;
                const active = i === currentIdx;
                return (
                    <React.Fragment key={s}>
                        <div className="flex flex-col items-center gap-1">
                            <div
                                className={cn(
                                    "flex size-6 items-center justify-center rounded-full text-[10px] font-semibold",
                                    passed && "bg-primary/15 text-primary",
                                    active && "bg-primary text-primary-foreground",
                                    !passed && !active && "bg-muted text-muted-foreground"
                                )}
                            >
                                {passed ? <Check className="size-3" /> : i + 1}
                            </div>
                            <span
                                className={cn(
                                    "hidden text-[10px] sm:block",
                                    active ? "text-foreground" : "text-muted-foreground"
                                )}
                            >
                                {STEP_LABEL[s]}
                            </span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div
                                className={cn(
                                    "mb-4 h-px flex-1",
                                    i < currentIdx ? "bg-primary/30" : "bg-border"
                                )}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function ConsentRow({
    consentGiven,
    onChange,
}: {
    consentGiven: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="rounded-lg border bg-muted/40 p-3">
            <Label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-foreground">
                <Checkbox checked={consentGiven} onCheckedChange={onChange} />
                <span>
                    The patient has been informed and consents to this visit being
                    recorded and transcribed by an AI scribe. Consent time will be
                    logged with the visit record.
                </span>
            </Label>
        </div>
    );
}

function SupportStep({
    support,
    consentGiven,
    onContinue,
}: {
    support: { ok: boolean; missing: string[] };
    consentGiven: boolean;
    onContinue: () => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="size-4 text-[var(--brand-ink)]" />
                Browser compatibility
            </div>

            {support.ok ? (
                <p className="text-sm text-muted-foreground">
                    Your browser supports everything we need for live capture.
                </p>
            ) : (
                <Alert variant="destructive">
                    <AlertTriangle className="size-4" />
                    <AlertTitle>Missing browser features</AlertTitle>
                    <AlertDescription>
                        <ul className="ml-4 list-disc text-xs">
                            {support.missing.map((m) => (
                                <li key={m}>{m}</li>
                            ))}
                        </ul>
                        <p className="mt-1 text-xs">Try Chrome or Edge.</p>
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={onContinue}
                    disabled={!support.ok || !consentGiven}
                    size="sm"
                >
                    Continue
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function PermissionStep({
    permission,
    error,
    onRequest,
}: {
    permission: string;
    error: string | null;
    onRequest: () => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Mic className="size-4 text-[var(--brand-ink)]" /> Microphone access
            </div>
            <p className="text-sm text-muted-foreground">
                We need permission to use your microphone. Audio is never stored
                without your consent.
            </p>
            {permission === "denied" && (
                <Alert variant="destructive">
                    <MicOff className="size-4" />
                    <AlertTitle>Microphone blocked</AlertTitle>
                    <AlertDescription>
                        Open your browser&apos;s site settings and allow microphone
                        access, then try again.{" "}
                        {error ? <span className="opacity-70">({error})</span> : null}
                    </AlertDescription>
                </Alert>
            )}
            <div className="flex justify-end">
                <Button type="button" onClick={onRequest} size="sm">
                    {permission === "denied" ? "Try again" : "Grant microphone access"}
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function DeviceStep({
    devices,
    selected,
    onSelect,
    level,
    db,
    peakDb,
    voiceDetected,
    onContinue,
}: {
    devices: { deviceId: string; label: string }[];
    selected: string;
    onSelect: (id: string) => void;
    level: number;
    db: number;
    peakDb: number;
    voiceDetected: boolean;
    onContinue: () => void;
}) {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Volume2 className="size-4 text-[var(--brand-ink)]" /> Input & level
            </div>
            <p className="text-sm text-muted-foreground">
                Choose your microphone and say a few words so we can confirm the
                level.
            </p>

            <div className="space-y-1.5">
                <Label htmlFor="mic-device" className="text-xs text-muted-foreground">
                    Microphone
                </Label>
                <Select value={selected} onValueChange={onSelect}>
                    <SelectTrigger id="mic-device" className="w-full">
                        <SelectValue placeholder="Select a microphone" />
                    </SelectTrigger>
                    <SelectContent>
                        {devices.length === 0 ? (
                            <SelectItem value="__none__" disabled>
                                (no inputs detected)
                            </SelectItem>
                        ) : (
                            devices.map((d) => (
                                <SelectItem key={d.deviceId} value={d.deviceId}>
                                    {d.label}
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-lg border bg-muted/40 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Input level</span>
                    <span
                        aria-live="polite"
                        className={cn(
                            voiceDetected ? "text-primary" : "text-muted-foreground"
                        )}
                    >
                        {formatDbLabel(db)}
                    </span>
                </div>
                <VuBar level={level} peakDb={peakDb} />
                <p className="mt-2 text-[11px] text-muted-foreground">
                    {voiceDetected
                        ? "Voice detected — looks good."
                        : "Try speaking at a normal volume…"}
                </p>
            </div>

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={onContinue}
                    disabled={!voiceDetected}
                    size="sm"
                >
                    Continue
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}

function VuBar({ level, peakDb }: { level: number; peakDb: number }) {
    const peakLevel = peakDb <= -60 ? 0 : peakDb >= 0 ? 1 : (peakDb + 60) / 60;
    return (
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 transition-[width]"
                style={{ width: `${Math.round(level * 100)}%` }}
            />
            <div
                className="absolute top-0 h-full w-0.5 bg-foreground/70"
                style={{ left: `${Math.round(peakLevel * 100)}%` }}
            />
        </div>
    );
}

function NoiseStep({
    state,
}: {
    state:
        | { status: "idle" }
        | { status: "measuring"; progress: number }
        | { status: "done"; noiseFloorDb: number }
        | { status: "error"; error: string };
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Volume2 className="size-4 text-[var(--brand-ink)]" /> Measuring room
            </div>
            <p className="text-sm text-muted-foreground">
                Please stay quiet for a moment so we can measure the background noise.
            </p>
            <div className="rounded-lg border bg-muted/40 p-4">
                {state.status === "measuring" && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Loader2 className="size-4 animate-spin text-[var(--brand-ink)]" />
                            Listening…
                        </div>
                        <Progress value={state.progress * 100} />
                    </div>
                )}
                {state.status === "done" && (
                    <p className="flex items-center gap-2 text-sm text-primary">
                        <Check className="size-4" /> Room sounds{" "}
                        {formatDbLabel(state.noiseFloorDb).toLowerCase()} (
                        {state.noiseFloorDb.toFixed(0)} dB).
                    </p>
                )}
                {state.status === "error" && (
                    <Alert variant="destructive">
                        <AlertTriangle className="size-4" />
                        <AlertDescription>{state.error}</AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}

function PingStep({
    status,
    error,
    onRetry,
    onSkip,
}: {
    status: "idle" | "checking" | "ok" | "error";
    error?: string;
    onRetry: () => void;
    onSkip: () => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
                <Wifi className="size-4 text-[var(--brand-ink)]" /> AI connection
            </div>

            {status === "checking" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" /> Contacting the parsing
                    service…
                </p>
            )}

            {status === "ok" && (
                <p className="flex items-center gap-2 text-sm text-primary">
                    <Check className="size-4" /> Parsing service is reachable.
                </p>
            )}

            {status === "error" && (
                <>
                    <Alert variant="destructive">
                        <AlertTriangle className="size-4" />
                        <AlertTitle>Can&apos;t reach the parsing service</AlertTitle>
                        <AlertDescription>
                            {error ||
                                "We'll retry during the session, but parsed fields may be delayed."}
                        </AlertDescription>
                    </Alert>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onSkip}>
                            Start anyway
                        </Button>
                        <Button type="button" size="sm" onClick={onRetry}>
                            Retry
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

function DoneStep() {
    return (
        <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Check className="size-6" />
            </div>
            <p className="text-base font-medium">Calibrated</p>
            <p className="mt-1 text-sm text-muted-foreground">
                Starting your live visit…
            </p>
        </div>
    );
}
