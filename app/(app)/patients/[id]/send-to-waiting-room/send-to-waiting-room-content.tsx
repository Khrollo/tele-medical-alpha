"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/app/_lib/utils/cn";
import { updatePatientAssignedAction, updateVisitWaitingRoomAction } from "@/app/_actions/visits";

interface SendToWaitingRoomContentProps {
    patientId: string;
    visitId: string;
    patientName: string;
}

type TriageLevel = "mild" | "urgent" | "critical";
type AppointmentType = "in-person" | "virtual";

export function SendToWaitingRoomContent({
    patientId,
    visitId,
    patientName,
}: SendToWaitingRoomContentProps) {
    const router = useRouter();
    const [triageLevel, setTriageLevel] = React.useState<TriageLevel>("mild");
    const [appointmentType, setAppointmentType] = React.useState<AppointmentType>("in-person");
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Save triage level and appointment type to visit
            // This also updates patient is_assigned to false and clinician_id to null
            await updateVisitWaitingRoomAction({
                visitId,
                triageLevel,
                appointmentType,
            });

            toast.success("Patient sent to waiting room");
            router.push(`/patients/${patientId}/visit-history`);
        } catch (error) {
            console.error("Error sending to waiting room:", error);
            toast.error("Failed to send patient to waiting room");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Send to Waiting Room</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {patientName}
                    </p>
                </div>
            </div>

            <div className="max-w-2xl space-y-6">
                {/* Triage Level */}
                <Card>
                    <CardHeader>
                        <CardTitle>Triage Level</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Set the urgency for the waiting pool.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            {(["mild", "urgent", "critical"] as TriageLevel[]).map((level) => {
                                const isSelected = triageLevel === level;
                                const colorClasses = {
                                    mild: isSelected
                                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-2 border-green-500 dark:border-green-400"
                                        : "bg-background text-foreground border-2 border-border hover:border-green-500/50",
                                    urgent: isSelected
                                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-2 border-yellow-500 dark:border-yellow-400"
                                        : "bg-background text-foreground border-2 border-border hover:border-yellow-500/50",
                                    critical: isSelected
                                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-2 border-red-500 dark:border-red-400"
                                        : "bg-background text-foreground border-2 border-border hover:border-red-500/50",
                                };
                                return (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setTriageLevel(level)}
                                        className={cn(
                                            "flex-1 px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize",
                                            colorClasses[level]
                                        )}
                                    >
                                        {level}
                                    </button>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Appointment Type */}
                <Card>
                    <CardHeader>
                        <CardTitle>Appointment Type</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                            Choose how the patient will be seen.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <button
                            type="button"
                            onClick={() => setAppointmentType("in-person")}
                            className={cn(
                                "w-full text-left p-4 rounded-lg border-2 transition-colors",
                                appointmentType === "in-person"
                                    ? "border-blue-500 bg-blue-500/10 dark:bg-blue-500/20"
                                    : "border-border hover:border-blue-500/50"
                            )}
                        >
                            <div className="font-semibold text-foreground">
                                In-Person
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Patient is placed in the in-person waiting area and will be seen on site.
                            </div>
                        </button>

                        <button
                            type="button"
                            onClick={() => setAppointmentType("virtual")}
                            className={cn(
                                "w-full text-left p-4 rounded-lg border-2 transition-colors",
                                appointmentType === "virtual"
                                    ? "border-purple-500 bg-purple-500/10 dark:bg-purple-500/20"
                                    : "border-border hover:border-purple-500/50"
                            )}
                        >
                            <div className="font-semibold text-foreground">
                                Virtual
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Patient is placed in the virtual waiting queue and can be seen via video.
                            </div>
                        </button>
                    </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex-1"
                    >
                        {isSubmitting ? "Sending..." : "Send to Waiting Room"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
