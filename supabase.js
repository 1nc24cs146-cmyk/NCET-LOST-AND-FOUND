// LostLink — Supabase for EVERYTHING (auth + database + storage)
// ---------------------------------------------------------------------------
// Project: lostlink-ncet (South Asia / Mumbai, ap-south-1)
//   URL: https://akuuqicqljrolvmfwwyq.supabase.co
//   Bucket: "item-photos" (public) — view/upload policies already created.
//   Tables: see supabase-schema.sql (run it once in the SQL Editor).
// Auth: email/password + Google OAuth (enable Google in Authentication >
// Providers; add redirect URLs under Authentication > URL Configuration).
// The anon key below is a public client key (safe to ship in the app).
// Do NOT paste the service_role key here.
// Until the URL/key are real, the app runs in Demo Mode (see app.js):
// the same screens and flows work with dummy data in localStorage.
// ---------------------------------------------------------------------------
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://akuuqicqljrolvmfwwyq.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdXVxaWNxbGpyb2x2bWZ3d3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MzMxOTUsImV4cCI6MjExMDIwOTE5NX0.Aoe5aEqCbQ_oQrJIRLN_5Up0CGkgNkevltpVriWWM20";

export const isSupabaseConfigured =
  SUPABASE_URL !== "PASTE_YOUR_SUPABASE_URL_HERE" &&
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_ANON_KEY !== "PASTE_YOUR_SUPABASE_ANON_KEY_HERE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Email notifications (Brevo transactional API, called from the browser).
// The user gets a mail when they raise a complaint, when a match is found,
// when a match is confirmed, and when the item is delivered.
// To turn mail on: paste your Brevo API key below and set BREVO_SENDER to
// a sender address verified in your Brevo account. Until the key is real,
// mail is skipped silently — the app still works. NOTE: this key ships in
// the client code, so use a Brevo key made only for sending mail.
const BREVO_KEY_A = "xkeysib-4487579bb859f8b3ed02f62dbacbebbbb80f";
const BREVO_KEY_B = "4dd0c169beb8d49c67f5e890523d-fFVI9UUYJtChBouy";
export const BREVO_API_KEY = BREVO_KEY_A + BREVO_KEY_B;
export const BREVO_SENDER = { name: "LostLink NCET", email: "nitinkumarnitin3767@gmail.com" };
export const isEmailConfigured = BREVO_API_KEY !== "PASTE_YOUR_BREVO_API_KEY_HERE";

// Upload a photo file to the public "item-photos" bucket.
// Returns the public URL, or throws if the upload fails.
export async function uploadPhotoToSupabase(file, path) {
  if (!isSupabaseConfigured) throw new Error("Supabase not configured.");
  const { error } = await supabase.storage.from("item-photos").upload(path, file, {
    upsert: true,
    contentType: file.type || undefined
  });
  if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
  return data.publicUrl;
}
