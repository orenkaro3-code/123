import { setRaw, isAdmin } from '../lib/store.js';

export const config = { api: { bodyParser: { sizeLimit: '3mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!isAdmin(req)) return res.status(401).json({ error: 'הסיסמה לא נכונה' });
  try {
    const data = String((req.body || {}).data || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return res.status(400).json({ error: 'הקובץ צריך להיות תמונה' });
    if (data.length > 1_500_000) return res.status(400).json({ error: 'התמונה גדולה מדי' });
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await setRaw('img:' + id, data);
    return res.status(200).json({ url: '/api/img?id=' + id });
  } catch (e) {
    return res.status(500).json({ error: 'ההעלאה נכשלה: ' + e.message });
  }
}
