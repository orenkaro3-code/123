import { getJSON, setJSON, isAdmin, hasDB } from '../lib/store.js';

const STATUSES = ['new', 'contacted', 'done', 'cancelled'];
const OWNER_PHONE = process.env.OWNER_WHATSAPP || '+972585974771';
const CALLMEBOT_KEY = process.env.CALLMEBOT_KEY || '';

// Forward an order to Oren's own WhatsApp through CallMeBot (free, personal use).
async function notifyOwner(o) {
  if (!CALLMEBOT_KEY) return false;
  const lines = [
    `🛍️ הזמנה חדשה ${o.channel === 'site' ? 'מהאתר' : 'ב-WhatsApp'}`,
    `שם: ${o.name}`,
    o.phone ? `טלפון: ${o.phone}` : '',
    ...o.items.map((i, k) => `${k + 1}) ${i.num ? 'מס׳ ' + i.num + ' – ' : ''}${i.name} | מידה ${i.size}${i.qty > 1 ? ' | ×' + i.qty : ''}`),
    o.note ? `הערה: ${o.note}` : '',
    'כל ההזמנות: oren-ballroom-shop.vercel.app/admin.html'
  ].filter(Boolean).join('\n');
  try {
    const u = 'https://api.callmebot.com/whatsapp.php?phone=' + encodeURIComponent(OWNER_PHONE) +
      '&text=' + encodeURIComponent(lines) + '&apikey=' + encodeURIComponent(CALLMEBOT_KEY);
    const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch (e) {
    return false;
  }
}

const cleanPhone = s => String(s || '').replace(/[^\d+]/g, '').slice(0, 16);

export default async function handler(req, res) {
  try {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'POST') {
      const b = req.body || {};
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map(i => ({
        id: String(i.id || ''), num: parseInt(i.num, 10) || 0, name: String(i.name || '').slice(0, 80),
        size: String(i.size || '').slice(0, 12), qty: Math.min(10, Math.max(1, parseInt(i.qty, 10) || 1)),
        price: Number(i.price) || 0
      }));
      if (!items.length) return res.status(400).json({ error: 'העגלה ריקה' });
      const channel = b.channel === 'site' ? 'site' : 'whatsapp';
      const phone = cleanPhone(b.phone);
      if (channel === 'site' && phone.replace(/\D/g, '').length < 9) return res.status(400).json({ error: 'צריך מספר טלפון כדי שאורן יוכל לחזור אליכם' });
      const order = {
        id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), createdAt: Date.now(), status: 'new', channel,
        name: String(b.name || '').trim().slice(0, 60) || 'לא צוין שם', phone,
        note: String(b.note || '').slice(0, 400), lang: String(b.lang || 'he').slice(0, 2), items,
        total: items.reduce((s, i) => s + i.price * i.qty, 0)
      };

      let saved = false;
      if (hasDB) {
        const orders = await getJSON('orders', []);
        orders.unshift(order);
        await setJSON('orders', orders.slice(0, 500));
        saved = true;
      }
      // WhatsApp orders already reach Oren in his chat; only orders sent through the site are forwarded.
      const notified = channel === 'site' ? await notifyOwner(order) : false;
      if (channel === 'site' && !saved && !notified) return res.status(503).json({ error: 'offline' });
      return res.status(200).json({ ok: true, saved, notified });
    }

    if (!isAdmin(req)) return res.status(401).json({ error: 'הסיסמה לא נכונה' });
    const setup = { db: hasDB, whatsapp: !!CALLMEBOT_KEY };
    if (!hasDB) return res.status(200).json({ orders: [], offline: true, setup });
    const orders = await getJSON('orders', []);
    if (req.method === 'GET') return res.status(200).json({ orders, setup });
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
