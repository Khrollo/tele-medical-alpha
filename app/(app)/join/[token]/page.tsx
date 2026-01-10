import { redirect, notFound } from "next/navigation";
import { verifyPatientJoinToken } from "@/app/_lib/twilio/video";
import { getVisitById } from "@/app/_lib/db/drizzle/queries/visit";
import { JoinCallContent } from "./join-call-content";

export default async function JoinCallPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Verify token
  const tokenData = verifyPatientJoinToken(token);
  if (!tokenData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
          <p className="text-muted-foreground">
            This join link has expired or is invalid.
          </p>
        </div>
      </div>
    );
  }

  // Get visit
  const visit = await getVisitById(tokenData.visitId);
  if (!visit) {
    notFound();
  }

  // Verify it's a virtual appointment
  if (visit.appointmentType?.toLowerCase() !== "virtual") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground">
            This link is not for a virtual appointment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <JoinCallContent
      visitId={visit.id}
      roomName={visit.twilioRoomName || ""}
      joinToken={token}
    />
  );
}

