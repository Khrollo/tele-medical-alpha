"use client";

import * as React from "react";
import { X, Pill, Syringe, Users, History, Stethoscope, FileText, AlertCircle, Calendar, CheckCircle2, Activity, User, Phone, Mail, MapPin, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar } from "@/components/ui/clearing";
import { cn } from "@/app/_lib/utils/cn";
import type { PatientBasics } from "@/app/_lib/db/drizzle/queries/patient";
import Link from "next/link";

interface MedicalInfoPanelProps {
  patientBasics: PatientBasics;
  sectionId: string;
  onClose: () => void;
}

export function MedicalInfoPanel({
  patientBasics,
  sectionId,
  onClose,
}: MedicalInfoPanelProps) {
  const renderContent = () => {
    switch (sectionId) {
      case "overview":
        return <OverviewView patientBasics={patientBasics} />;
      case "personalDetails":
        return <PersonalDetailsView patientBasics={patientBasics} />;
      case "visitHistory":
        return <VisitHistoryView visits={patientBasics.recentVisits || []} patientId={patientBasics.id} />;
      case "socialHistory":
        return <SocialHistoryView data={patientBasics.socialHistory} />;
      case "medications":
        return <MedicationsView data={patientBasics.currentMedications} />;
      case "vaccines":
        return <VaccinesView data={patientBasics.vaccines} />;
      case "familyHistory":
        return <FamilyHistoryView data={patientBasics.familyHistory} />;
      case "surgicalHistory":
        return <SurgicalHistoryView data={patientBasics.surgicalHistory} />;
      case "pastMedicalHistory":
        return <PastMedicalHistoryView data={patientBasics.pastMedicalHistory} />;
      case "allergies":
        return <AllergiesView data={patientBasics.allergies} />;
      case "vitals":
        return <VitalsView data={patientBasics.vitals} />;
      case "orders":
        return <OrdersView />;
      default:
        return <div className="text-muted-foreground">No information available</div>;
    }
  };

  const getSectionTitle = () => {
    const titles: Record<string, string> = {
      overview: "Overview",
      personalDetails: "Personal Details",
      visitHistory: "Visit History",
      socialHistory: "Social History",
      medications: "Current Medications",
      vaccines: "Vaccines",
      familyHistory: "Family History",
      surgicalHistory: "Surgical History",
      pastMedicalHistory: "Past Medical History",
      allergies: "Allergies",
      vitals: "Vitals",
      orders: "Orders",
    };
    return titles[sectionId] || "Medical Information";
  };

  const getSectionIcon = () => {
    const icons: Record<string, React.ReactNode> = {
      overview: <Info className="h-5 w-5" />,
      personalDetails: <User className="h-5 w-5" />,
      visitHistory: <Clock className="h-5 w-5" />,
      socialHistory: <Users className="h-5 w-5" />,
      medications: <Pill className="h-5 w-5" />,
      vaccines: <Syringe className="h-5 w-5" />,
      familyHistory: <Users className="h-5 w-5" />,
      surgicalHistory: <Stethoscope className="h-5 w-5" />,
      pastMedicalHistory: <History className="h-5 w-5" />,
      allergies: <AlertCircle className="h-5 w-5" />,
      vitals: <Activity className="h-5 w-5" />,
      orders: <FileText className="h-5 w-5" />,
    };
    return icons[sectionId] || null;
  };

  return (
    <Card>
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          {getSectionIcon()}
          <CardTitle className="text-lg">{getSectionTitle()}</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      {/* Content */}
      <CardContent className="p-0">
        <ScrollArea className="max-h-[600px]">
          <div className="p-4">
            {renderContent()}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Medications View
function MedicationsView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No medications recorded</p>
      </div>
    );
  }

  const medications = Array.isArray(data) ? data : [];
  
  if (medications.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Pill className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No medications recorded</p>
      </div>
    );
  }

  // Helper function to get medication display name
  const getMedicationDisplayName = (med: any) => {
    if (med.brandName && med.genericName) {
      return `${med.brandName} (${med.genericName})`;
    }
    if (med.brandName) {
      return med.brandName;
    }
    if (med.genericName) {
      return med.genericName;
    }
    // Legacy fields for backwards compatibility
    if (med.name) {
      return med.name;
    }
    if (med.medication) {
      return med.medication;
    }
    return "Unknown Medication";
  };

  return (
    <div className="space-y-3">
      {medications.map((med: any, index: number) => (
        <Card key={med.id || index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{getMedicationDisplayName(med)}</h3>
                {med.strength && (
                  <p className="text-sm text-muted-foreground mt-1">Strength: {med.strength}</p>
                )}
                {med.dosage && (
                  <p className="text-sm text-muted-foreground mt-1">Dosage: {med.dosage}</p>
                )}
                {med.frequency && (
                  <p className="text-sm text-muted-foreground">Frequency: {med.frequency}</p>
                )}
                {med.instructions && (
                  <p className="text-sm text-muted-foreground mt-2">{med.instructions}</p>
                )}
                {med.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{med.notes}</p>
                )}
              </div>
              {med.status && (
                <Badge variant={med.status === "Active" ? "default" : "secondary"}>
                  {med.status}
                </Badge>
              )}
            </div>
            {med.startDate && (
              <p className="text-xs text-muted-foreground mt-2">
                Started: {new Date(med.startDate).toLocaleDateString()}
              </p>
            )}
            {med.createdAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Added: {new Date(med.createdAt).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Vaccines View
function VaccinesView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Syringe className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No vaccines recorded</p>
      </div>
    );
  }

  let history: any[] = [];
  let scheduled: any[] = [];

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const vaccineData = data as { history?: any[]; scheduled?: any[] };
    history = Array.isArray(vaccineData.history) ? vaccineData.history : [];
    scheduled = Array.isArray(vaccineData.scheduled) ? vaccineData.scheduled : [];
  } else if (Array.isArray(data)) {
    history = data.filter((v: any) => v.dateAdministered);
    scheduled = data.filter((v: any) => v.scheduledDate);
  }

  if (history.length === 0 && scheduled.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Syringe className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No vaccines recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {history.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Vaccine History
          </h3>
          <div className="space-y-2">
            {history.map((vaccine: any, index: number) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{vaccine.name || vaccine.vaccine || "Unknown"}</p>
                      {vaccine.dateAdministered && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(vaccine.dateAdministered).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">
                      Administered
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {scheduled.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            Scheduled Vaccines
          </h3>
          <div className="space-y-2">
            {scheduled.map((vaccine: any, index: number) => (
              <Card key={index}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{vaccine.name || vaccine.vaccine || "Unknown"}</p>
                      {vaccine.scheduledDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Scheduled: {new Date(vaccine.scheduledDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge variant="outline">Scheduled</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Family History View
function FamilyHistoryView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No family history recorded</p>
      </div>
    );
  }

  const entries = Array.isArray(data) ? data : [];
  
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No family history recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry: any, index: number) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{entry.condition || entry.relation || "Unknown"}</h3>
                {entry.relation && entry.condition && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {entry.relation}: {entry.condition}
                  </p>
                )}
                {entry.ageOfOnset && (
                  <p className="text-sm text-muted-foreground">Age of Onset: {entry.ageOfOnset}</p>
                )}
                {entry.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Surgical History View
function SurgicalHistoryView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No surgical history recorded</p>
      </div>
    );
  }

  const entries = Array.isArray(data) ? data : [];
  
  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No surgical history recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry: any, index: number) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{entry.procedure || "Unknown Procedure"}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {entry.date && (
                    <Badge variant="outline" className="text-xs">
                      {entry.date}
                    </Badge>
                  )}
                  {entry.laterality && (
                    <Badge variant="outline" className="text-xs">
                      {entry.laterality}
                    </Badge>
                  )}
                  {entry.site && (
                    <Badge variant="outline" className="text-xs">
                      {entry.site}
                    </Badge>
                  )}
                </div>
                {entry.surgeon && (
                  <p className="text-sm text-muted-foreground mt-2">Surgeon: {entry.surgeon}</p>
                )}
                {entry.hospital && (
                  <p className="text-sm text-muted-foreground">Hospital: {entry.hospital}</p>
                )}
                {entry.outcome && (
                  <p className="text-sm text-muted-foreground mt-2">Outcome: {entry.outcome}</p>
                )}
                {entry.complications && (
                  <p className="text-sm text-muted-foreground text-red-600 dark:text-red-400">
                    Complications: {entry.complications}
                  </p>
                )}
                {entry.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                )}
                {entry.source && (
                  <p className="text-xs text-muted-foreground mt-2">Source: {entry.source}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Past Medical History View
function PastMedicalHistoryView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No past medical history recorded</p>
      </div>
    );
  }

  let entries: any[] = [];
  let noSignificantPMH = false;

  if (typeof data === "object" && data !== null) {
    if ("entries" in data) {
      const pmhData = data as { entries?: any[]; noSignificantPMH?: boolean };
      entries = Array.isArray(pmhData.entries) ? pmhData.entries : [];
      noSignificantPMH = pmhData.noSignificantPMH || false;
    } else if (Array.isArray(data)) {
      entries = data;
    }
  }

  if (noSignificantPMH) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No significant past medical history</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No past medical history recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry: any, index: number) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{entry.condition || "Unknown Condition"}</h3>
                <div className="flex items-center gap-2 mt-2">
                  {entry.status && (
                    <Badge
                      variant={
                        entry.status === "Active" || entry.status === "Chronic"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {entry.status}
                    </Badge>
                  )}
                  {entry.impact && (
                    <Badge variant="outline">{entry.impact} Impact</Badge>
                  )}
                </div>
                {entry.diagnosedDate && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Diagnosed: {new Date(entry.diagnosedDate).toLocaleDateString()}
                  </p>
                )}
                {entry.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Allergies View
function AllergiesView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No allergies recorded</p>
      </div>
    );
  }

  const allergies = Array.isArray(data) ? data : [];
  
  if (allergies.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No allergies recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {allergies.map((allergy: any, index: number) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{allergy.allergen || allergy.name || "Unknown Allergen"}</h3>
                {allergy.reaction && (
                  <p className="text-sm text-muted-foreground mt-1">Reaction: {allergy.reaction}</p>
                )}
                {allergy.severity && (
                  <Badge variant={allergy.severity === "Severe" ? "destructive" : "secondary"} className="mt-2">
                    {allergy.severity}
                  </Badge>
                )}
                {allergy.notes && (
                  <p className="text-sm text-muted-foreground mt-2">{allergy.notes}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Vitals View
function VitalsView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No vitals recorded</p>
      </div>
    );
  }

  const vitals = Array.isArray(data) ? data : [];
  
  if (vitals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No vitals recorded</p>
      </div>
    );
  }

  // Sort by date, most recent first
  const sortedVitals = [...vitals].sort((a: any, b: any) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="space-y-3">
      {sortedVitals.slice(0, 10).map((vital: any, index: number) => (
        <Card key={index}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="font-semibold text-sm">
                {vital.date ? new Date(vital.date).toLocaleDateString() : "No date"}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {vital.bp && (
                <div>
                  <span className="text-muted-foreground">BP:</span> <span className="font-medium">{vital.bp}</span>
                </div>
              )}
              {vital.hr && (
                <div>
                  <span className="text-muted-foreground">HR:</span> <span className="font-medium">{vital.hr}</span>
                </div>
              )}
              {vital.temp && (
                <div>
                  <span className="text-muted-foreground">Temp:</span> <span className="font-medium">{vital.temp}</span>
                </div>
              )}
              {vital.weight && (
                <div>
                  <span className="text-muted-foreground">Weight:</span> <span className="font-medium">{vital.weight}</span>
                </div>
              )}
              {vital.height && (
                <div>
                  <span className="text-muted-foreground">Height:</span> <span className="font-medium">{vital.height}</span>
                </div>
              )}
              {vital.bmi && (
                <div>
                  <span className="text-muted-foreground">BMI:</span> <span className="font-medium">{vital.bmi}</span>
                </div>
              )}
              {vital.spo2 && (
                <div>
                  <span className="text-muted-foreground">SpO2:</span> <span className="font-medium">{vital.spo2}</span>
                </div>
              )}
              {vital.rr && (
                <div>
                  <span className="text-muted-foreground">RR:</span> <span className="font-medium">{vital.rr}</span>
                </div>
              )}
            </div>
            {vital.notes && (
              <p className="text-sm text-muted-foreground mt-2">{vital.notes}</p>
            )}
          </CardContent>
        </Card>
      ))}
      {sortedVitals.length > 10 && (
        <p className="text-xs text-muted-foreground text-center">Showing 10 most recent entries</p>
      )}
    </div>
  );
}

// Overview View
function OverviewView({ patientBasics }: { patientBasics: PatientBasics }) {
  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(patientBasics.dob);
  const allergies = Array.isArray(patientBasics.allergies) ? patientBasics.allergies : [];
  const medications = Array.isArray(patientBasics.currentMedications) ? patientBasics.currentMedications : [];
  const vitals = Array.isArray(patientBasics.vitals) ? patientBasics.vitals : [];
  const latestVital = vitals.length > 0 ? vitals.sort((a: any, b: any) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  })[0] : null;

  return (
    <div className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Avatar
                name={patientBasics.fullName}
                src={patientBasics.avatarUrl}
                size={24}
              />
              <h3 className="font-semibold text-sm">Patient Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Age:</span>{" "}
                <span className="font-medium">{age !== null ? `${age} years` : "N/A"}</span>
              </div>
              {patientBasics.sexAtBirth && (
                <div>
                  <span className="text-muted-foreground">Sex at Birth:</span>{" "}
                  <span className="font-medium">{patientBasics.sexAtBirth}</span>
                </div>
              )}
              {patientBasics.genderIdentity && (
                <div>
                  <span className="text-muted-foreground">Gender:</span>{" "}
                  <span className="font-medium">{patientBasics.genderIdentity}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{allergies.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Allergies</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-center">
              <div className="text-2xl font-bold">{medications.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Medications</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Vitals */}
      {latestVital && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2">Latest Vitals</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {latestVital.bp && (
                <div>
                  <span className="text-muted-foreground">BP:</span>{" "}
                  <span className="font-medium">{latestVital.bp}</span>
                </div>
              )}
              {latestVital.hr && (
                <div>
                  <span className="text-muted-foreground">HR:</span>{" "}
                  <span className="font-medium">{latestVital.hr}</span>
                </div>
              )}
              {latestVital.temp && (
                <div>
                  <span className="text-muted-foreground">Temp:</span>{" "}
                  <span className="font-medium">{latestVital.temp}°F</span>
                </div>
              )}
              {latestVital.weight && (
                <div>
                  <span className="text-muted-foreground">Weight:</span>{" "}
                  <span className="font-medium">{latestVital.weight} lbs</span>
                </div>
              )}
            </div>
            {latestVital.date && (
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(latestVital.date).toLocaleDateString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contact Info */}
      {(patientBasics.phone || patientBasics.email || patientBasics.address) && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold text-sm mb-2">Contact Information</h3>
            <div className="space-y-1 text-sm">
              {patientBasics.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  <span>{patientBasics.phone}</span>
                </div>
              )}
              {patientBasics.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>{patientBasics.email}</span>
                </div>
              )}
              {patientBasics.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-muted-foreground mt-0.5" />
                  <span>{patientBasics.address}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Personal Details View
function PersonalDetailsView({ patientBasics }: { patientBasics: PatientBasics }) {
  const calculateAge = (dob: string | null) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(patientBasics.dob);
  const emergencyContact = patientBasics.emergencyContact && typeof patientBasics.emergencyContact === "object"
    ? patientBasics.emergencyContact as Record<string, unknown>
    : null;

  return (
    <div className="space-y-4">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-muted-foreground">Full Name:</span>
              <p className="font-medium">{patientBasics.fullName}</p>
            </div>
            {patientBasics.dob && (
              <div>
                <span className="text-muted-foreground">Date of Birth:</span>
                <p className="font-medium">
                  {new Date(patientBasics.dob).toLocaleDateString()}
                  {age !== null && ` (${age} years)`}
                </p>
              </div>
            )}
            {patientBasics.sexAtBirth && (
              <div>
                <span className="text-muted-foreground">Sex at Birth:</span>
                <p className="font-medium">{patientBasics.sexAtBirth}</p>
              </div>
            )}
            {patientBasics.genderIdentity && (
              <div>
                <span className="text-muted-foreground">Gender Identity:</span>
                <p className="font-medium">{patientBasics.genderIdentity}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      {(patientBasics.phone || patientBasics.email || patientBasics.address) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patientBasics.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{patientBasics.phone}</span>
              </div>
            )}
            {patientBasics.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{patientBasics.email}</span>
              </div>
            )}
            {patientBasics.address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Address:</span>
                  <p className="font-medium">{patientBasics.address}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Emergency Contact */}
      {emergencyContact && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {typeof emergencyContact.name === "string" && emergencyContact.name.trim() && (
              <div>
                <span className="text-muted-foreground">Name:</span>
                <p className="font-medium">{emergencyContact.name}</p>
              </div>
            )}
            {typeof emergencyContact.relationship === "string" && emergencyContact.relationship.trim() && (
              <div>
                <span className="text-muted-foreground">Relationship:</span>
                <p className="font-medium">{emergencyContact.relationship}</p>
              </div>
            )}
            {typeof emergencyContact.phone === "string" && emergencyContact.phone.trim() && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{emergencyContact.phone}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Language & Communication */}
      {(patientBasics.primaryLanguage || patientBasics.preferredCommMethod) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Language & Communication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {patientBasics.primaryLanguage && (
              <div>
                <span className="text-muted-foreground">Primary Language:</span>
                <p className="font-medium">{patientBasics.primaryLanguage}</p>
              </div>
            )}
            {patientBasics.preferredCommMethod && (
              <div>
                <span className="text-muted-foreground">Preferred Communication:</span>
                <p className="font-medium">{patientBasics.preferredCommMethod}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Visit History View
function VisitHistoryView({ visits, patientId }: { visits: Array<{ id: string; status: string | null; createdAt: Date; notesStatus: string | null; appointmentType: string | null }>; patientId: string }) {
  if (!visits || visits.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No visits recorded</p>
      </div>
    );
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary">Unknown</Badge>;
    switch (status.toLowerCase()) {
      case "completed":
        return <Badge variant="default" className="bg-green-500/10 text-green-700 dark:text-green-400">Completed</Badge>;
      case "in_progress":
        return <Badge variant="default" className="bg-blue-500/10 text-blue-700 dark:text-blue-400">In Progress</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {visits.map((visit) => (
        <Link key={visit.id} href={`/patients/${patientId}/visit-history/${visit.id}`}>
          <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-sm">
                      {new Date(visit.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h3>
                    {visit.appointmentType && (
                      <Badge variant="outline" className="text-xs">
                        {visit.appointmentType}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(visit.status)}
                    {visit.notesStatus && visit.notesStatus !== "draft" && (
                      <Badge variant="outline" className="text-xs">
                        Notes: {visit.notesStatus}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(visit.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

// Social History View
function SocialHistoryView({ data }: { data: unknown }) {
  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No social history recorded</p>
      </div>
    );
  }

  const socialHistory = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};

  if (Object.keys(socialHistory).length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No social history recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3 text-sm">
            {Object.entries(socialHistory).map(([key, value]) => {
              if (!value || value === "" || value === null) return null;
              
              // Skip internal metadata fields
              if (key === "preferredName" || key === "primaryCareProvider") return null;
              
              const formattedKey = key
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (str) => str.toUpperCase())
                .trim();
              
              return (
                <div key={key}>
                  <span className="text-muted-foreground font-medium">{formattedKey}:</span>{" "}
                  <span>{String(value)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Orders View
function OrdersView() {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p>No orders recorded</p>
      <p className="text-xs mt-2">Orders will appear here when added to the visit note</p>
    </div>
  );
}

