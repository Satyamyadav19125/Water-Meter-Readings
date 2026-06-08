import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
let cached = global._mongoClient;

function getClient() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it in Vercel → Settings → Environment Variables.');
  }
  if (!cached) {
    cached = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });
    global._mongoClient = cached;
  }
  return cached;
}

async function getCollection(name) {
  const client = getClient();
  const db = client.db('watermeter');
  return db.collection(name);
}

// ---- CIRCUIT BREAKER --------------------------------------------------
// If a DB call fails, remember it for a short window so we DON'T wait for
// another 3s timeout on every subsequent call. This keeps the whole site
// fast even when the DB password is wrong / DB is unreachable.
let _mongoDownUntil = 0;
function mongoIsDown() { return Date.now() < _mongoDownUntil; }
function markMongoDown() { _mongoDownUntil = Date.now() + 15000; }
function markMongoUp() { _mongoDownUntil = 0; }

export function getMongoHealth() {
  return { configured: isDbConfigured(), down: mongoIsDown() };
}

// ---- tiny in-memory cache so settings/assignments aren't re-read constantly ----
const _cache = { assignments: null, settings: null, ts: 0 };
const CACHE_TTL = 20000;
function cacheFresh() { return Date.now() - _cache.ts < CACHE_TTL; }
function bustCache() { _cache.assignments = null; _cache.settings = null; _cache.ts = 0; }

// ---- Assignments (CRASH-SAFE + circuit breaker) ----
export async function getAssignments() {
  if (!isDbConfigured()) return [];
  if (_cache.assignments && cacheFresh()) return _cache.assignments;
  if (mongoIsDown()) return _cache.assignments || [];
  try {
    const col = await getCollection('assignments');
    const doc = await col.findOne({ _key: 'main' });
    const list = doc?.list || [];
    _cache.assignments = list;
    _cache.ts = Date.now();
    markMongoUp();
    return list;
  } catch (e) {
    console.error('getAssignments DB error:', e.message);
    markMongoDown();
    return _cache.assignments || [];
  }
}

export async function saveAssignments(list) {
  const col = await getCollection('assignments');
  await col.updateOne(
    { _key: 'main' },
    { $set: { _key: 'main', list, updatedAt: new Date() } },
    { upsert: true }
  );
  markMongoUp();
  bustCache();
}

// ---- Settings ----
export const DEFAULT_SETTINGS = {
  contact: {
    showEmails: true, showPhone: false, showOnLanding: true, showInFooter: true,
    adminEmail: 'satyamyadav19125@gmail.com',
    leadEmail: 'danetgar@gmail.com',
    adminPhone: '', adminWhatsapp: '',
  },
  redFlags: {
    rollback: true, reverse: true, huge_jump: true, growth_anomaly: true,
    stale_no_reading: true, stale_unchanged: true,
    missing_photo: false, invalid_meter_id: false, future_date: true,
    zero_consumption: false, gps_outlier: false, digit_count: false,
    out_of_sequence: true, duplicate_same_day: false,
    identical_gps: false, fabrication_speed: false, night_reading: false, village_outlier: false,
  },
  project: {
    name: 'Digital Village Project',
    tagline: 'Water meter monitoring for sustainable agriculture',
    description: 'A joint research project between Tel Aviv University (Israel) and Thapar Institute of Engineering and Technology (Patiala, India). We monitor water usage across Punjab farms to drive water-saving practices in paddy irrigation through the Alternate Wetting and Drying (AWD) method.',
    formUploadUrl: 'https://ee.kobotoolbox.org/x/DypCcCCx',
  },
  forms: [],
};

export async function getSettings() {
  if (!isDbConfigured()) return DEFAULT_SETTINGS;
  if (_cache.settings && cacheFresh()) return _cache.settings;
  if (mongoIsDown()) return _cache.settings || DEFAULT_SETTINGS;
  try {
    const col = await getCollection('settings');
    const doc = await col.findOne({ _key: 'main' });
    const merged = !doc ? DEFAULT_SETTINGS : {
      contact: { ...DEFAULT_SETTINGS.contact, ...(doc.contact || {}) },
      redFlags: { ...DEFAULT_SETTINGS.redFlags, ...(doc.redFlags || {}) },
      project: { ...DEFAULT_SETTINGS.project, ...(doc.project || {}) },
      forms: Array.isArray(doc.forms) ? doc.forms : [],
    };
    _cache.settings = merged;
    _cache.ts = Date.now();
    markMongoUp();
    return merged;
  } catch (e) {
    console.error('getSettings DB error:', e.message);
    markMongoDown();
    return _cache.settings || DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings) {
  const col = await getCollection('settings');
  await col.updateOne(
    { _key: 'main' },
    { $set: { _key: 'main', ...settings, updatedAt: new Date() } },
    { upsert: true }
  );
  markMongoUp();
  bustCache();
}

export async function getActiveForm() {
  const settings = await getSettings();
  const active = (settings.forms || []).find((f) => f.isActive);
  if (active) return active;
  return {
    name: 'Default (env vars)',
    assetUid: (process.env.KOBO_ASSET_UID || '').trim(),
    baseUrl: (process.env.KOBO_BASE_URL || 'https://kf.kobotoolbox.org').trim().replace(/\/$/, ''),
    token: process.env.KOBO_API_TOKEN || '',
    isActive: true, isEnvFallback: true,
  };
}

// ---- Media (profile photos stored IN MongoDB) ----
export async function saveMedia(base64DataUrl) {
  const col = await getCollection('media');
  const m = /^data:(.+?);base64,(.*)$/.exec(base64DataUrl || '');
  if (!m) throw new Error('Invalid image data');
  const contentType = m[1];
  const data = m[2];
  if (data.length > 350000) throw new Error('Image too large after resize (max ~250KB).');
  const res = await col.insertOne({ contentType, data, createdAt: new Date() });
  markMongoUp();
  return res.insertedId.toString();
}

export async function getMedia(id) {
  const col = await getCollection('media');
  let _id;
  try { _id = new ObjectId(id); } catch { return null; }
  const doc = await col.findOne({ _id });
  if (!doc) return null;
  return { contentType: doc.contentType, buffer: Buffer.from(doc.data, 'base64') };
}

// ---- MongoDB connectivity self-test (used by /api/diag — always does a real ping) ----
export async function testMongo() {
  if (!MONGODB_URI) return { configured: false, ok: false, error: 'MONGODB_URI not set' };
  try {
    const client = getClient();
    await client.db('watermeter').command({ ping: 1 });
    markMongoUp();
    return { configured: true, ok: true };
  } catch (e) {
    markMongoDown();
    return { configured: true, ok: false, error: e.message };
  }
}

export function isDbConfigured() {
  return Boolean(MONGODB_URI);
}
