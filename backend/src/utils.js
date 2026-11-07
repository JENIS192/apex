const path = require('path');
const db = require('./db');

class HttpError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details; }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const str = (v, max = 255) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, d = null) => { if (v === '' || v === null || v === undefined) return d; const n = Number(v); return Number.isFinite(n) ? n : d; };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CATEGORIES = ['Hypercar', 'Supercar', 'Sedan', 'Coupe', 'SUV', 'Electric'];
const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const UPLOAD_DIR = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
const IMG = '(SELECT url FROM car_images WHERE car_id=c.id ORDER BY is_primary DESC, sort_order, id LIMIT 1)';

async function loadOrders(where = '', params = [], limit = 500) {
  const [orders] = await db.pool.query(
    `SELECT o.*, u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id=o.user_id ${where} ORDER BY o.created_at DESC, o.id DESC LIMIT ${Number(limit)}`, params);
  if (!orders.length) return orders;
  const [items] = await db.pool.query(
    `SELECT oi.*, (SELECT url FROM car_images WHERE car_id=oi.car_id ORDER BY is_primary DESC, sort_order, id LIMIT 1) AS image
       FROM order_items oi WHERE order_id IN (?)`, [orders.map((o) => o.id)]);
  orders.forEach((o) => { o.items = items.filter((i) => i.order_id === o.id); });
  return orders;
}

// Status transition with stock restoration on cancellation (transactional).
async function changeStatus(id, status, onlyUserId = null) {
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[o]] = await conn.query(`SELECT * FROM orders WHERE id=? ${onlyUserId ? 'AND user_id=?' : ''} FOR UPDATE`, onlyUserId ? [id, onlyUserId] : [id]);
    if (!o) throw new HttpError(404, 'Order not found');
    if (['cancelled', 'delivered'].includes(o.status)) throw new HttpError(409, `Order is already ${o.status}`);
    if (onlyUserId && !(status === 'cancelled' && o.status === 'pending')) throw new HttpError(403, 'Only pending orders can be cancelled');
    if (status === 'cancelled') {
      await conn.query('UPDATE cars c JOIN order_items oi ON oi.car_id=c.id SET c.stock=c.stock+oi.quantity WHERE oi.order_id=?', [id]);
    }
    await conn.query('UPDATE orders SET status=? WHERE id=?', [status, id]);
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}

module.exports = { HttpError, wrap, slugify, str, num, EMAIL_RE, CATEGORIES, ORDER_STATUSES, UPLOAD_DIR, IMG, loadOrders, changeStatus };
