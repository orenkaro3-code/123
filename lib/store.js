// Upstash Redis over its REST API (no extra packages needed).
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const NS = 'shop:';
export const hasDB = !!(URL_ && TOKEN);

export async function cmd(...args) {
  if (!URL_ || !TOKEN) throw new Error('מסד הנתונים עוד לא מחובר לפרויקט');
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export async function getJSON(key, fallback) {
  const v = await cmd('GET', NS + key);
  return v == null ? fallback : JSON.parse(v);
}
export const setJSON = (key, val) => cmd('SET', NS + key, JSON.stringify(val));
export const getRaw = key => cmd('GET', NS + key);
export const setRaw = (key, val) => cmd('SET', NS + key, val);
export const delKeys = (...keys) => keys.length ? cmd('DEL', ...keys.map(k => NS + k)) : 0;

export function isAdmin(req) {
  const key = req.headers['x-admin-key'] || '';
  return !!process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD;
}

export const CATEGORIES = ['latin', 'standard', 'shoes-latin', 'shoes-standard'];

