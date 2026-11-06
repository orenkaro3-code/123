import { getJSON, setJSON, isAdmin, hasDB } from '../lib/store.js';

const STATUSES = ['new', 'contacted', 'done', 'cancelled'];

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');
    if (!hasDB) return req.method === 'GET' ? res.status(isAdmin(req) ? 200 : 401).json(isAdmin(req) ? { orders: [], offline: true } : { error: 'הסיסמה לא נכונה' }) : res.status(200).json({ ok: true, skipped: true });
    if (req.method === 'POST') {
      const b = req.body || {};
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map(i => ({
        id: String(i.id || ''), num: parseInt(i.num, 10) || 0, name: String(i.name || '').slice(0, 80),
        size: String(i.size || '').slice(0, 12), qty: Math.min(10, Math.max(1, parseInt(i.qty, 10) || 1)),
        price: Number(i.price) || 0
      }));
      if (!items.length) return res.status(400).json({ error: 'העגלה ריקה' });
      const order = {
        id: 'o' + Date.now().toString(36), createdAt: Date.now(), status: 'new', channel: 'whatsapp',
        name: String(b.name || '').trim().slice(0, 60) || 'לא צוין שם', phone: '',
        note: String(b.note || '').slice(0, 400), items,
        total: items.reduce((s, i) => s + i.price * i.qty, 0)
      };
      const orders = await getJSON('orders', []);
      orders.unshift(order);
      await setJSON('orders', orders.slice(0, 300));
      return res.status(200).json({ ok: true });
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'הסיסמה לא נכונה' });
    const orders = await getJSON('orders', []);
    if (req.method === 'GET') return res.status(200).json({ orders });
    if (req.method === 'PATCH') {
      const { id, status } = req.body || {};
      const o = orders.find(x => x.id === id);
      if (!o || !STATUSES.includes(status)) return res.status(400).json({ error: 'הזמנה לא נמצאה' });
      o.status = status;
      await setJSON('orders', orders);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'שגיאת שרת: ' + e.message });
  }
}
