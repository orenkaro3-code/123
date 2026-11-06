import { getJSON, setJSON, delKeys, isAdmin, hasDB, CATEGORIES } from '../lib/store.js';
import { CATALOG } from '../lib/catalog.js';

const IMG = /^(\/api\/img\?id=[\w-]+|\/img\/[\w-]+\.jpg)$/;

function clean(p) {
  const sizes = (Array.isArray(p.sizes) ? p.sizes : [])
    .map(s => ({ size: String(s.size || '').trim().slice(0, 12), stock: Math.max(0, parseInt(s.stock, 10) || 0) }))
    .filter(s => s.size);
  return {
    id: String(p.id || 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    num: parseInt(p.num, 10) || 0,
    name: String(p.name || '').trim().slice(0, 80),
    category: CATEGORIES.includes(p.category) ? p.category : 'latin',
    price: Math.max(0, Number(p.price) || 0),
    color: String(p.color || '').trim().slice(0, 40),
    description: String(p.description || '').trim().slice(0, 600),
    sizes,
    images: (Array.isArray(p.images) ? p.images : []).filter(u => IMG.test(u)).slice(0, 4),
    hidden: !!p.hidden,
    updatedAt: Date.now()
  };
}
const imgIds = p => (p.images || []).filter(u => u.startsWith('/api/img')).map(u => 'img:' + u.split('=')[1]);

export default async function handler(req, res) {
  try {
    let products = hasDB ? await getJSON('products', null) : CATALOG;
    if (products === null) { products = CATALOG; await setJSON('products', products); }

    if (req.method === 'GET') {
      if (req.query.all) {
        if (!isAdmin(req)) return res.status(401).json({ error: 'הסיסמה לא נכונה' });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ products });
      }
      // Shared by all visitors for a few seconds so each page view does not hit the database.
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=300');
      return res.status(200).json({ products: products.filter(p => !p.hidden) });
    }
    if (!isAdmin(req)) return res.status(401).json({ error: 'הסיסמה לא נכונה' });
    if (!hasDB) return res.status(503).json({ error: 'מסד הנתונים עוד לא מחובר, אז אי אפשר לשמור שינויים כרגע' });

    const body = req.body || {};
    if (req.method === 'POST') {
      const p = clean(body.product || {});
      if (!p.name) return res.status(400).json({ error: 'חסר שם מוצר' });
      if (!p.sizes.length) return res.status(400).json({ error: 'צריך להוסיף לפחות מידה אחת' });
      const i = products.findIndex(x => x.id === p.id);
      if (i >= 0 && !p.num) p.num = products[i].num || 0;
      if (!p.num || products.some(x => x.num === p.num && x.id !== p.id)) {
        p.num = Math.max(100, ...products.map(x => x.num || 0)) + 1;
      }
      if (i >= 0) {
        const gone = imgIds(products[i]).filter(k => !imgIds(p).includes(k));
        await delKeys(...gone);
        products[i] = p;
      } else products.unshift(p);
      await setJSON('products', products);
      return res.status(200).json({ product: p });
    }
    if (req.method === 'DELETE') {
      const p = products.find(x => x.id === body.id);
      if (p) await delKeys(...imgIds(p));
      products = products.filter(x => x.id !== body.id);
      await setJSON('products', products);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    return res.status(500).json({ error: 'שגיאת שרת: ' + e.message });
  }
}
