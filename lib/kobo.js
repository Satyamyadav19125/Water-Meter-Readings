// =====================================================================
// Kobo API client
// All calls authenticate with the API token from environment variables.
// =====================================================================

const KOBO_BASE = process.env.KOBO_BASE_URL || 'https://kf.kobotoolbox.org';
const KOBO_TOKEN = process.env.KOBO_API_TOKEN;
const ASSET_UID = process.env.KOBO_ASSET_UID;

function authHeaders() {
  if (!KOBO_TOKEN) {
    throw new Error('KOBO_API_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.');
  }
  return { Authorization: `Token ${KOBO_TOKEN}` };
}

/**
 * Fetch all submissions for the configured form.
 * Returns an array of submission objects.
 */
export async function fetchSubmissions({ limit = 5000 } = {}) {
  if (!ASSET_UID) {
    throw new Error('KOBO_ASSET_UID is not set.');
  }
  const url = `${KOBO_BASE}/api/v2/assets/${ASSET_UID}/data/?format=json&limit=${limit}`;
  const res = await fetch(url, {
    headers: authHeaders(),
    // Always fetch fresh data; Vercel will cache via the route's revalidate setting.
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kobo API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results || [];
}

/**
 * Fetch the form definition (used to know what village choices exist).
 */
export async function fetchAssetDefinition() {
  const url = `${KOBO_BASE}/api/v2/assets/${ASSET_UID}/?format=json`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Kobo asset fetch failed: ${res.status}`);
  return res.json();
}

/**
 * Given a submission and the photo field's filename, return the Kobo-hosted URL.
 * Kobo stores attachments in submission._attachments[].
 */
export function findAttachmentUrl(submission, photoFilename) {
  if (!submission?._attachments || !photoFilename) return null;
  // Kobo replaces spaces with underscores in stored filenames
  const target = String(photoFilename).replace(/\s+/g, '_');
  const att = submission._attachments.find((a) =>
    (a.filename || '').endsWith(target)
  );
  return att?.download_url || att?.download_large_url || null;
}

/**
 * Proxy-fetch a Kobo attachment (used by our /api/photo route).
 * Kobo attachments require the API token, so the browser cannot load
 * them directly. We pipe them through our server.
 */
export async function fetchAttachmentStream(downloadUrl) {
  const res = await fetch(downloadUrl, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Attachment fetch ${res.status}`);
  return res;
}
