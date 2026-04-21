export function getAudioStorageBucket() {
  return process.env.STORAGE_BUCKET || "telehealth_audio";
}

export function getDocumentsStorageBucket() {
  return process.env.DOCUMENTS_STORAGE_BUCKET || "tele-med-docs";
}

/**
 * Bucket for patient profile images. Must be a PUBLIC Supabase bucket so
 * avatars can render via direct `<img src>` without per-request signing.
 *
 * Env: `AVATARS_STORAGE_BUCKET` (default `tele-med-avatars`).
 */
export function getAvatarsStorageBucket() {
  return process.env.AVATARS_STORAGE_BUCKET || "tele-med-avatars";
}
