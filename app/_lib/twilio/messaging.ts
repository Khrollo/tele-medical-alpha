import { getPatientPersonalDetails } from "@/app/_lib/db/drizzle/queries/patient-personal-details";

/**
 * Send SMS to patient with join link
 */
export async function sendPatientSMS(patientId: string, joinUrl: string): Promise<boolean> {
  try {
    const patient = await getPatientPersonalDetails(patientId);
    
    if (!patient?.phone) {
      return false;
    }

    // TODO: Integrate with Twilio SMS API or your SMS provider
    // For now, this is a placeholder
    const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
    
    if (!TWILIO_PHONE_NUMBER) {
      console.warn("Twilio phone number not configured. SMS not sent.");
      return false;
    }

    // Use Twilio SMS API
    const { default: fetch } = await import("node-fetch");
    const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
    const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET;
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.warn("Twilio credentials not configured. SMS not sent.");
      return false;
    }

    const message = `Your virtual appointment is ready. Join here: ${joinUrl}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER,
        To: patient.phone,
        Body: message,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error sending SMS:", error);
    return false;
  }
}

/**
 * Send Email to patient with join link
 */
export async function sendPatientEmail(patientId: string, joinUrl: string): Promise<boolean> {
  try {
    const patient = await getPatientPersonalDetails(patientId);
    
    if (!patient?.email) {
      return false;
    }

    // TODO: Integrate with your email service (SendGrid, Resend, etc.)
    // For now, this is a placeholder
    console.log(`Would send email to ${patient.email} with join link: ${joinUrl}`);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}

