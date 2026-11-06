import { getRaw } from '../lib/store.js';

export default async function handler(req, res) {
  const id = String(req.query.id || '');
  if (!/^[\w-]+$/.test(id)) return res.status(404).end();
  try {
    const data = await getRaw('img:' + id);
    const m = data && data.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return res.status(404).end();
    // Each image id never changes, so the CDN can keep it for a year.
    res.setHeader('Content-Type', m[1]);
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    return res.status(200).send(Buffer.from(m[2], 'base64'));
  } catch (e) {
    return res.status(500).end();
  }
}
