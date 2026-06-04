const KOBO_BASE = (process.env.KOBO_BASE_URL || 'https://kf.kobotoolbox.org').trim().replace(/\/$/, '');
const RAW_TOKEN = process.env.KOBO_API_TOKEN || '';
const ASSET_UID = (process.env.KOBO_ASSET_UID || '').trim();

function cleanToken(raw) {
  let t = (raw || '').trim();
  if (t.toLowerCase().startsWith('token ')) t = t.slice(6).trim();
  t = t.replace(/^["']|["']$/g, '');
  return t;
}

const KOBO_TOKEN = cleanToken(RAW_TOKEN);

function authHeaders() {
  if (!KOBO_TOKEN) {
    throw new Error('KOBO_API_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.');
  }
  return { Authorization: `Token ${KOBO_TOKEN}` };
}

export async function fetchSubmissions({ limit = 5000 } = {}) {
  if (!ASSET_UID) throw new Error('KOBO_ASSET_UID is not set.');
  const url = `${KOBO_BASE}/api/v2/assets/${ASSET_UID}/data/?format=json&limit=${limit}`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kobo API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.results || [];
}

export async function fetchAssetDefinition() {
  const url = `${KOBO_BASE}/api/v2/assets/${ASSET_UID}/?format=json`;
  const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) throw new Error(`Kobo asset fetch failed: ${res.status}`);
  return res.json();
}

export function findAttachmentUrl(submission, photoFilename) {
  if (!submission?._attachments || !photoFilename) return null;
  const target = String(photoFilename).replace(/\s+/g, '_');
  const att = submission._attachments.find((a) => (a.filename || '').endsWith(target));
  return att?.download_url || att?.download_large_url || null;
}

export async function fetchAttachmentStream(downloadUrl) {
  const res = await fetch(downloadUrl, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Attachment fetch ${res.status}`);
  return res;
}
