import { MongoClient } from 'mongodb';

// Self-contained chat store. Own client + short timeout so a slow DB can never
// freeze the chat page. Independent of lib/db.js.
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'watermeter';
const COLLECTION = 'messages';

let _clientPromise = null;
function getClientPromise() {
  if (!MONGODB_URI) return null;
  if (!_clientPromise) {
    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 3000, connectTimeoutMS: 3000 });
    _clientPromise = client.connect().catch((e) => { _clientPromise = null; throw e; });
  }
  return _clientPromise;
}
async function getCollection() {
  const cp = getClientPromise();
  if (!cp) return null;
  const client = await cp;
  return client.db(DB_NAME).collection(COLLECTION);
}

function toPlain(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...rest };
}

// Returns oldest-first, capped to the most recent `limit`.
export async function getMessages(channel, limit = 200) {
  if (!channel) return [];
  try {
    const col = await getCollection();
    if (!col) return [];
    const docs = await col.find({ channel }).sort({ ts: -1 }).limit(limit).toArray();
    return docs.map(toPlain).reverse();
  } catch { return []; }
}

export async function sendMessage({ channel, senderId, senderName, senderRole, text, imageUrl }) {
  try {
    const col = await getCollection();
    if (!col) return null;
    const clean = String(text || '').slice(0, 4000).trim();
    const img = typeof imageUrl === 'string' && imageUrl.startsWith('/api/media/') ? imageUrl : '';
    if (!clean && !img) return null;
    const doc = {
      channel: String(channel),
      senderId: String(senderId || ''),
      senderName: String(senderName || 'Unknown'),
      senderRole: senderRole === 'admin' ? 'admin' : 'user',
      text: clean,
      imageUrl: img,
      ts: new Date().toISOString(),
    };
    const res = await col.insertOne(doc);
    return { id: res.insertedId.toString(), ...doc };
  } catch { return null; }
}
