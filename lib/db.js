import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
let cached = global._mongoClient;

function getClient() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set. Add it in Vercel → Settings → Environment Variables.');
  }
  if (!cached) {
    cached = new MongoClient(MONGODB_URI);
    global._mongoClient = cached;
  }
  return cached;
}

async function getCollection(name) {
  const client = getClient();
  const db = client.db('watermeter');
  return db.collection(name);
}

export async function getAssignments() {
  const col = await getCollection('assignments');
  const doc = await col.findOne({ _key: 'main' });
  return doc?.list || [];
}

export async function saveAssignments(list) {
  const col = await getCollection('assignments');
  await col.updateOne(
    { _key: 'main' },
    { $set: { _key: 'main', list, updatedAt: new Date() } },
    { upsert: true }
  );
}

export const DEFAULT_SETTINGS = {
  contact: {
    showEmails: true, showPhone: false, showOnLanding: true, showInFooter: true,
    adminEmail: 'satyamyadav19125@gmail.com',
    leadEmail: 'danetgar@gmail.com',
    adminPhone: '', adminWhatsapp: '',
  },
  redFlags: {
    rollback: true, reverse: true, huge_jump: true,
    growth_anomaly: true, stale_no_reading: true, stale_unchanged: true,
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
  try {
    const col = await getCollection('settings');
    const doc = await col.findOne({ _key: 'main' });
    if (!doc) return DEFAULT_SETTINGS;
    return {
      contact: { ...DEFAULT_SETTINGS.contact, ...(doc.contact || {}) },
      redFlags: { ...DEFAULT_SETTINGS.redFlags, ...(doc.redFlags || {}) },
      project: { ...DEFAULT_SETTINGS.project, ...(doc.project || {}) },
      forms: Array.isArray(doc.forms) ? doc.forms : [],
    };
  } catch { return DEFAULT_SETTINGS; }
}

export async function saveSettings(settings) {
  const col = await getCollection('settings');
  await col.updateOne(
    { _key: 'main' },
    { $set: { _key: 'main', ...settings, updatedAt: new Date() } },
    { upsert: true }
  );
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

export function isDbConfigured() {
  return Boolean(MONGODB_URI);
}
