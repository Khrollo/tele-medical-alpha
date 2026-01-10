"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, Save, X, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePatientPersonalDetails } from "./actions";

const personalDetailsSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    dob: z.string().optional(),
    phone: z.string().optional(),
    email: z
        .string()
        .optional()
        .refine(
            (val) => !val || val === "" || z.string().email().safeParse(val).success,
            {
                message: "Invalid email address",
            }
        ),
    address: z.string().optional(),
    sexAtBirth: z.string().optional(),
    genderIdentity: z.string().optional(),
    primaryLanguage: z.string().optional(),
    preferredCommMethod: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactRelationship: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
});

type PersonalDetailsFormData = z.infer<typeof personalDetailsSchema>;

interface PersonalDetailsContentProps {
    patientData: {
        id: string;
        fullName: string;
        dob: string | Date | null;
        phone: string | null;
        email: string | null;
        address: string | null;
        sexAtBirth: string | null;
        genderIdentity: string | null;
        primaryLanguage: string | null;
        preferredCommMethod: string | null;
        emergencyContactName: string | null;
        emergencyContactRelationship: string | null;
        emergencyContactPhone: string | null;
        clinicianId: string | null;
        clinicianName: string | null;
        clinicianEmail: string | null;
        createdAt: Date | string;
        updatedAt: Date | string;
    };
    patientId: string;
}

export function PersonalDetailsContent({
    patientData,
    patientId,
}: PersonalDetailsContentProps) {
    const router = useRouter();
    const [isEditing, setIsEditing] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    // Split fullName into firstName and lastName
    const nameParts = patientData.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Format date for input field (YYYY-MM-DD)
    const formatDateForInput = (date: string | null | Date) => {
        if (!date) return "";
        const d = new Date(date);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().split("T")[0];
    };

    const form = useForm<PersonalDetailsFormData>({
        resolver: zodResolver(personalDetailsSchema),
        defaultValues: {
            firstName,
            lastName,
            dob: formatDateForInput(patientData.dob),
            phone: patientData.phone || "",
            email: patientData.email || "",
            address: patientData.address || "",
            sexAtBirth: patientData.sexAtBirth || undefined,
            genderIdentity: patientData.genderIdentity || "",
            primaryLanguage: patientData.primaryLanguage || "",
            preferredCommMethod: patientData.preferredCommMethod || undefined,
            emergencyContactName: patientData.emergencyContactName || "",
            emergencyContactRelationship: patientData.emergencyContactRelationship || "",
            emergencyContactPhone: patientData.emergencyContactPhone || "",
        },
    });

    const onSubmit = async (data: PersonalDetailsFormData) => {
        try {
            setIsSaving(true);

            // Combine firstName and lastName into fullName
            const fullName = [data.firstName, data.lastName]
                .filter(Boolean)
                .join(" ")
                .trim() || patientData.fullName;

            // Format dob: if empty string, set to null, otherwise keep as is
            const dobValue = data.dob && data.dob.trim() ? data.dob : null;

            // Handle email: if empty string, set to null
            const emailValue = data.email && data.email.trim() ? data.email.trim() : null;

            // Convert undefined/null/"none" to null for database
            const trimOrNull = (value: string | undefined | null) => {
                if (value === undefined || value === null || value === "none") return null;
                const trimmed = value.trim();
                return trimmed === "" ? null : trimmed;
            };

            await updatePatientPersonalDetails(patientId, {
                fullName,
                dob: dobValue,
                phone: trimOrNull(data.phone),
                email: emailValue,
                address: trimOrNull(data.address),
                sexAtBirth: trimOrNull(data.sexAtBirth),
                genderIdentity: trimOrNull(data.genderIdentity),
                primaryLanguage: trimOrNull(data.primaryLanguage),
                preferredCommMethod: trimOrNull(data.preferredCommMethod),
                emergencyContactName: trimOrNull(data.emergencyContactName),
                emergencyContactRelationship: trimOrNull(data.emergencyContactRelationship),
                emergencyContactPhone: trimOrNull(data.emergencyContactPhone),
            });

            toast.success("Patient personal details updated successfully");
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error("Error updating patient details:", error);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to update patient personal details"
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        // Reset form to original values
        form.reset({
            firstName,
            lastName,
            dob: formatDateForInput(patientData.dob),
            phone: patientData.phone || "",
            email: patientData.email || "",
            address: patientData.address || "",
            sexAtBirth: patientData.sexAtBirth || undefined,
            genderIdentity: patientData.genderIdentity || "",
            primaryLanguage: patientData.primaryLanguage || "",
            preferredCommMethod: patientData.preferredCommMethod || undefined,
            emergencyContactName: patientData.emergencyContactName || "",
            emergencyContactRelationship: patientData.emergencyContactRelationship || "",
            emergencyContactPhone: patientData.emergencyContactPhone || "",
        });
        setIsEditing(false);
    };

    const formatDate = (date: Date | string | null) => {
        if (!date) return null;
        try {
            const d = typeof date === "string" ? new Date(date) : date;
            if (isNaN(d.getTime())) return null;
            return d.toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "numeric",
            });
        } catch {
            return null;
        }
    };

    return (
        <div className="flex flex-1 flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Personal Details</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Manage demographic and medical context fields.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button
                                variant="secondary"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                            </Button>
                            <Button
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={isSaving}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {isSaving ? "Saving..." : "Save"}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setIsEditing(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    )}
                </div>
            </div>

            {/* Content Cards */}
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Personal Details Card */}
                    <Card className="rounded-2xl">
                        <CardHeader className="border-b border-border">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                PERSONAL DETAILS
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last name</Label>
                                    {isEditing ? (
                                        <>
                                            <Input
                                                id="lastName"
                                                {...form.register("lastName")}
                                                placeholder="Last name"
                                            />
                                            {form.formState.errors.lastName && (
                                                <p className="text-sm text-destructive">
                                                    {form.formState.errors.lastName.message}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-foreground">
                                            {lastName || "Not provided"}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First name</Label>
                                    {isEditing ? (
                                        <>
                                            <Input
                                                id="firstName"
                                                {...form.register("firstName")}
                                                placeholder="First name"
                                            />
                                            {form.formState.errors.firstName && (
                                                <p className="text-sm text-destructive">
                                                    {form.formState.errors.firstName.message}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-sm text-foreground">
                                            {firstName || "Not provided"}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="dob">Birthdate</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="dob"
                                            type="date"
                                            {...form.register("dob")}
                                        />
                                        {form.formState.errors.dob && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.dob.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {formatDate(patientData.dob) || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="phone"
                                            type="tel"
                                            {...form.register("phone")}
                                            placeholder="Phone number"
                                        />
                                        {form.formState.errors.phone && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.phone.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.phone || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="address"
                                            {...form.register("address")}
                                            placeholder="Address"
                                        />
                                        {form.formState.errors.address && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.address.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.address || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="email"
                                            type="email"
                                            {...form.register("email")}
                                            placeholder="Email address"
                                        />
                                        {form.formState.errors.email && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.email.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.email || "Not provided"}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Medical Information Card */}
                    <Card className="rounded-2xl">
                        <CardHeader className="border-b border-border">
                            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                MEDICAL INFORMATION
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Clinician</Label>
                                <div className="text-sm text-foreground">
                                    {patientData.clinicianId ? (
                                        <div>
                                            <span className="font-medium">Assigned</span>
                                            {patientData.clinicianName && (
                                                <div className="text-muted-foreground mt-1">
                                                    {patientData.clinicianName}
                                                    {patientData.clinicianEmail && (
                                                        <span className="block">{patientData.clinicianEmail}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        "Unassigned"
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Created</Label>
                                <div className="text-sm text-foreground">
                                    {formatDate(
                                        patientData.createdAt instanceof Date
                                            ? patientData.createdAt
                                            : typeof patientData.createdAt === "string"
                                                ? patientData.createdAt
                                                : null
                                    ) || "Not provided"}
                                </div>
                            </div>

                            {/* Medical Context Fields */}
                            <div className="space-y-2">
                                <Label htmlFor="sexAtBirth">Sex at birth</Label>
                                {isEditing ? (
                                    <>
                                        <Select
                                            value={form.watch("sexAtBirth") || undefined}
                                            onValueChange={(value) =>
                                                form.setValue("sexAtBirth", value === "none" ? undefined : value, {
                                                    shouldValidate: true,
                                                })
                                            }
                                        >
                                            <SelectTrigger id="sexAtBirth">
                                                <SelectValue placeholder="Select sex at birth" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Not specified</SelectItem>
                                                <SelectItem value="Male">Male</SelectItem>
                                                <SelectItem value="Female">Female</SelectItem>
                                                <SelectItem value="Intersex">Intersex</SelectItem>
                                                <SelectItem value="Unknown">Unknown</SelectItem>
                                                <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.sexAtBirth || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="genderIdentity">Gender identity</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="genderIdentity"
                                            {...form.register("genderIdentity")}
                                            placeholder="Gender identity"
                                        />
                                        {form.formState.errors.genderIdentity && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.genderIdentity.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.genderIdentity || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="primaryLanguage">Primary language</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="primaryLanguage"
                                            {...form.register("primaryLanguage")}
                                            placeholder="Primary language"
                                        />
                                        {form.formState.errors.primaryLanguage && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.primaryLanguage.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.primaryLanguage || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="preferredCommMethod">Preferred communication method</Label>
                                {isEditing ? (
                                    <>
                                        <Select
                                            value={form.watch("preferredCommMethod") || undefined}
                                            onValueChange={(value) =>
                                                form.setValue("preferredCommMethod", value === "none" ? undefined : value, {
                                                    shouldValidate: true,
                                                })
                                            }
                                        >
                                            <SelectTrigger id="preferredCommMethod">
                                                <SelectValue placeholder="Select method" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Not specified</SelectItem>
                                                <SelectItem value="Phone">Phone</SelectItem>
                                                <SelectItem value="SMS">SMS</SelectItem>
                                                <SelectItem value="Email">Email</SelectItem>
                                                <SelectItem value="Portal">Portal</SelectItem>
                                                <SelectItem value="Other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.preferredCommMethod || "Not provided"}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Emergency Contact Card - Full Width */}
                <Card className="rounded-2xl">
                    <CardHeader className="border-b border-border">
                        <CardTitle className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            EMERGENCY CONTACT
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="emergencyContactName">Full Name</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="emergencyContactName"
                                            {...form.register("emergencyContactName")}
                                            placeholder="Emergency contact name"
                                        />
                                        {form.formState.errors.emergencyContactName && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.emergencyContactName.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.emergencyContactName || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="emergencyContactRelationship">Relationship</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="emergencyContactRelationship"
                                            {...form.register("emergencyContactRelationship")}
                                            placeholder="e.g., Spouse, Parent, Sibling"
                                        />
                                        {form.formState.errors.emergencyContactRelationship && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.emergencyContactRelationship.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.emergencyContactRelationship || "Not provided"}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="emergencyContactPhone">Phone</Label>
                                {isEditing ? (
                                    <>
                                        <Input
                                            id="emergencyContactPhone"
                                            type="tel"
                                            {...form.register("emergencyContactPhone")}
                                            placeholder="Emergency contact phone"
                                        />
                                        {form.formState.errors.emergencyContactPhone && (
                                            <p className="text-sm text-destructive">
                                                {form.formState.errors.emergencyContactPhone.message}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-foreground">
                                        {patientData.emergencyContactPhone || "Not provided"}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}

