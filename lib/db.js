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

export function isDbConfigured() {
  return Boolean(MONGODB_URI);
}
