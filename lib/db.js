const URL_BASE = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function checkConfigured() {
  if (!URL_BASE || !TOKEN) {
    throw new Error(
      'Upstash Redis is not configured. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to your Vercel environment variables.'
    );
  }
}

async function command(args) {
  checkConfigured();
  const res = await fetch(URL_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upstash error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.result;
}

export async function dbGet(key) {
  const val = await command(['GET', key]);
  if (val === null || val === undefined) return null;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export async function dbSet(key, value) {
  return command(['SET', key, JSON.stringify(value)]);
}

export async function dbDelete(key) {
  return command(['DEL', key]);
}

const ASSIGNMENTS_KEY = 'assignments:v1';

export async function getAssignments() {
  const data = await dbGet(ASSIGNMENTS_KEY);
  return Array.isArray(data) ? data : [];
}

export async function saveAssignments(list) {
  return dbSet(ASSIGNMENTS_KEY, list);
}

export function isDbConfigured() {
  return Boolean(URL_BASE && TOKEN);
}
