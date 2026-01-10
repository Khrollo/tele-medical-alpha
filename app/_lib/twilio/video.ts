import twilio from "twilio";
import jwt from "jsonwebtoken";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const JWT_SECRET: string =
  process.env.JWT_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "your-secret-key-change-in-production";

if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
  console.warn(
    "Twilio credentials not configured. Video features will not work."
  );
}

/**
 * Generate Twilio Video Access Token
 */
export function generateTwilioToken(
  roomName: string,
  participantIdentity: string,
  role: "doctor" | "patient" = "doctor"
): string {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY || !TWILIO_API_SECRET) {
    throw new Error("Twilio credentials not configured");
  }

  const AccessToken = twilio.jwt.AccessToken;

  const token = new AccessToken(
    TWILIO_ACCOUNT_SID,
    TWILIO_API_KEY,
    TWILIO_API_SECRET,
    {
      identity: participantIdentity,
    }
  );

  const videoGrant = new AccessToken.VideoGrant({
    room: roomName,
  });

  token.addGrant(videoGrant);

  return token.toJwt();
}

/**
 * Generate patient join token (JWT)
 */
export function generatePatientJoinToken(
  visitId: string,
  expiresIn: string = "24h"
): string {
  const secret: jwt.Secret = JWT_SECRET;
  // @ts-ignore - expiresIn as string is valid for jsonwebtoken
  return jwt.sign(
    {
      visitId,
      type: "patient_join",
    },
    secret,
    { expiresIn }
  );
}

/**
 * Verify patient join token
 */
export function verifyPatientJoinToken(
  token: string
): { visitId: string; type: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      visitId: string;
      type: string;
    };
    if (decoded.type === "patient_join") {
      return decoded;
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Create or get Twilio Video Room
 */
export async function ensureTwilioRoom(
  roomName: string
): Promise<{ roomSid: string; roomName: string }> {
  // Use AUTH_TOKEN for REST API calls (required for room creation)
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error(
      "Twilio credentials not configured (need ACCOUNT_SID and AUTH_TOKEN)"
    );
  }

  // Use Twilio REST API to create/fetch room
  // Check if room exists
  const listUrl = `https://video.twilio.com/v1/Rooms?UniqueName=${encodeURIComponent(
    roomName
  )}`;
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const listResponse = await fetch(listUrl, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  let finalRoomName = roomName;

  if (listResponse.ok) {
    const data = (await listResponse.json()) as {
      rooms: Array<{
        sid: string;
        unique_name: string;
        type: string;
        status: string;
      }>;
    };
    if (data.rooms && data.rooms.length > 0) {
      const existingRoom = data.rooms[0];
      // Only return existing room if it's a group room and in-progress (not completed)
      if (
        existingRoom.type === "group" &&
        existingRoom.status === "in-progress"
      ) {
        return {
          roomSid: existingRoom.sid,
          roomName: existingRoom.unique_name,
        };
      }
      // If room exists but is not a group room or is completed, generate new unique name
      // Twilio won't let us create a room with the same UniqueName
      if (
        existingRoom.type !== "group" ||
        existingRoom.status === "completed"
      ) {
        finalRoomName = `${roomName}-group-${Date.now()}`;
      }
    }
  }

  // Create new room as GROUP type with automatic recording on connect
  const createUrl = "https://video.twilio.com/v1/Rooms";
  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      UniqueName: finalRoomName,
      Type: "group", // Group rooms for multi-participant calls
    }),
  });

  if (!createResponse.ok) {
    const errorData = await createResponse
      .json()
      .catch(() => ({ message: "Unknown error" }));
    const errorMessage =
      errorData.message ||
      (await createResponse.text().catch(() => "Unknown error"));
    throw new Error(`Failed to create Twilio room: ${errorMessage}`);
  }

  const roomData = (await createResponse.json()) as {
    sid: string;
    unique_name: string;
    type: string;
  };

  // Verify the room was created as group type
  if (roomData.type !== "group") {
    throw new Error(
      `Room created but type is ${roomData.type}, expected 'group' for recording support`
    );
  }

  return {
    roomSid: roomData.sid,
    roomName: roomData.unique_name,
  };
}

/**
 * Start Twilio Room Recording
 * Note: For REST API calls, Twilio requires Account SID and Auth Token.
 * API Key/Secret are only for generating access tokens, not REST API calls.
 * If you don't have an Auth Token, get it from: https://console.twilio.com/
 *
 * IMPORTANT: Recording must be enabled in your Twilio account:
 * 1. Go to Twilio Console > Video > Settings
 * 2. Enable "Recordings" feature
 * 3. Configure recording settings as needed
 */
export async function startRoomRecording(roomSid: string): Promise<string> {
  // Twilio REST API requires Auth Token, not API Secret
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error(
      "Twilio Auth Token required for recording. Please set TWILIO_AUTH_TOKEN in your environment variables. " +
        "You can find your Auth Token in the Twilio Console: https://console.twilio.com/"
    );
  }

  // Use direct REST API call with proper authentication
  const url = `https://video.twilio.com/v1/Rooms/${roomSid}/Recordings`;
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const formData = new URLSearchParams({
    Type: "audio",
    StatusCallback: `${
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }/api/twilio/webhooks/recording`,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "Unknown error", code: null }));
      const errorMessage =
        errorData.message || `HTTP ${response.status}: ${response.statusText}`;

      // Handle specific error codes
      if (errorData.code === 20004 || response.status === 405) {
        throw new Error(
          "Room recording is not enabled for your Twilio account. " +
            "Please enable it in Twilio Console > Video > Settings > Recordings. " +
            "You may need to contact Twilio support to enable this feature."
        );
      }

      if (errorData.code === 20404) {
        throw new Error(
          `Room ${roomSid} not found. Ensure the room exists and is active.`
        );
      }

      throw new Error(`Failed to start recording: ${errorMessage}`);
    }

    const data = (await response.json()) as { sid: string };
    return data.sid;
  } catch (error: any) {
    // Re-throw if it's already our formatted error
    if (error instanceof Error && error.message.includes("Room recording")) {
      throw error;
    }
    // Handle network errors
    if (
      error?.message?.includes("Invalid URL") ||
      error?.code === "ENOTFOUND"
    ) {
      throw new Error(
        `Invalid URL or network error. Check your NEXT_PUBLIC_APP_URL environment variable.`
      );
    }
    throw new Error(
      error?.message || `Failed to start recording: Unknown error`
    );
  }
}

/**
 * Get Twilio Recording Media URL
 */
export async function getRecordingMediaUrl(
  recordingSid: string
): Promise<string> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    throw new Error(
      "Twilio credentials not configured (need ACCOUNT_SID and AUTH_TOKEN)"
    );
  }

  const url = `https://video.twilio.com/v1/Recordings/${recordingSid}`;
  const auth = Buffer.from(
    `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
  ).toString("base64");

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch recording");
  }

  const data = (await response.json()) as { uri: string };
  // Get the media URL - Twilio provides a .mp3 or .wav URL
  // The URI format is: /2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}.json
  // Media URL is: /2010-04-01/Accounts/{AccountSid}/Recordings/{RecordingSid}
  const mediaUrl = data.uri.replace(".json", "");
  return `https://api.twilio.com${mediaUrl}`;
}
