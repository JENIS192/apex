const router = require('express').Router();
const db = require('../db');
const { auth } = require('../auth');
const { HttpError, wrap, str, num, IMG, loadOrders, changeStatus } = require('../utils');

router.use(['/wishlist', '/cart', '/orders'], auth);

/* ---------- Wishlist ---------- */
router.get('/wishlist', wrap(async (req, res) => {
  const [items] = await db.pool.query(
    `SELECT c.*, b.name AS brand_name, b.slug AS brand_slug, ${IMG} AS image
       FROM wishlist_items w JOIN cars c ON c.id=w.car_id JOIN brands b ON b.id=c.brand_id WHERE w.user_id=? ORDER BY w.created_at DESC`, [req.user.id]);
  res.json({ items });
}));
router.post('/wishlist/:carId', wrap(async (req, res) => {
  const [[car]] = await db.pool.query('SELECT id FROM cars WHERE id=?', [num(req.params.carId, 0)]);
  if (!car) throw new HttpError(404, 'Vehicle not found');
  await db.pool.query('INSERT IGNORE INTO wishlist_items (user_id,car_id) VALUES (?,?)', [req.user.id, car.id]);
  res.status(201).json({ ok: true });
}));
router.delete('/wishlist/:carId', wrap(async (req, res) => {
  await db.pool.query('DELETE FROM wishlist_items WHERE user_id=? AND car_id=?', [req.user.id, num(req.params.carId, 0)]);
  res.json({ ok: true });
}));

/* ---------- Cart ---------- */
const MAX_QTY = 10;
const cartItems = async (uid) => (await db.pool.query(
  `SELECT ci.quantity, c.id AS car_id, c.name, c.slug, c.price, c.stock, b.name AS brand_name, ${IMG} AS image
     FROM cart_items ci JOIN cars c ON c.id=ci.car_id JOIN brands b ON b.id=c.brand_id WHERE ci.user_id=? ORDER BY ci.updated_at DESC`, [uid]))[0];

router.get('/cart', wrap(async (req, res) => res.json({ items: await cartItems(req.user.id) })));
router.post('/cart', wrap(async (req, res) => {
  const carId = num(req.body.carId, 0), qty = Math.max(parseInt(req.body.quantity) || 1, 1);
  const [[car]] = await db.pool.query('SELECT id,stock,name FROM cars WHERE id=?', [carId]);
  if (!car) throw new HttpError(404, 'Vehicle not found');
  if (car.stock < 1) throw new HttpError(409, `${car.name} is currently sold out`);
  const [[ex]] = await db.pool.query('SELECT quantity FROM cart_items WHERE user_id=? AND car_id=?', [req.user.id, carId]);
  const q = Math.min((ex ? ex.quantity : 0) + qty, car.stock, MAX_QTY);
  await db.pool.query('INSERT INTO cart_items (user_id,car_id,quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity=VALUES(quantity)', [req.user.id, carId, q]);
  res.status(201).json({ items: await cartItems(req.user.id) });
}));
router.put('/cart/:carId', wrap(async (req, res) => {
  const carId = num(req.params.carId, 0), qty = parseInt(req.body.quantity);
  const [[car]] = await db.pool.query('SELECT stock FROM cars WHERE id=?', [carId]);
  if (!car) throw new HttpError(404, 'Vehicle not found');
  if (!(qty >= 1)) throw new HttpError(400, 'Quantity must be at least 1');
  if (qty > Math.min(car.stock, MAX_QTY)) throw new HttpError(409, `Only ${Math.min(car.stock, MAX_QTY)} unit(s) can be ordered`);
  await db.pool.query('UPDATE cart_items SET quantity=? WHERE user_id=? AND car_id=?', [qty, req.user.id, carId]);
  res.json({ items: await cartItems(req.user.id) });
}));
router.delete('/cart/:carId', wrap(async (req, res) => {
  await db.pool.query('DELETE FROM cart_items WHERE user_id=? AND car_id=?', [req.user.id, num(req.params.carId, 0)]);
  res.json({ items: await cartItems(req.user.id) });
}));

/* ---------- Orders / Checkout ---------- */
router.post('/orders', wrap(async (req, res) => {
  const b = req.body;
  const f = { ship_name: str(b.ship_name, 100), ship_phone: str(b.ship_phone, 30), ship_address: str(b.ship_address, 255), ship_city: str(b.ship_city, 100), ship_postal: str(b.ship_postal, 20), ship_country: str(b.ship_country, 100), notes: str(b.notes, 500) || null };
  const errs = Object.entries({ ship_name: 'Full name', ship_phone: 'Phone', ship_address: 'Address', ship_city: 'City', ship_postal: 'Postal code', ship_country: 'Country' }).filter(([k]) => !f[k]).map(([, l]) => `${l} is required`);
  if (!['wire_transfer', 'dealer_financing'].includes(b.payment_method)) errs.push('Select a payment method');
  if (errs.length) throw new HttpError(400, 'Validation failed', errs);

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    const [items] = await conn.query(
      'SELECT ci.quantity, c.id AS car_id, c.name, c.price, c.stock FROM cart_items ci JOIN cars c ON c.id=ci.car_id WHERE ci.user_id=? FOR UPDATE', [req.user.id]);
    if (!items.length) throw new HttpError(400, 'Your cart is empty');
    let total = 0;
    for (const it of items) {
      if (it.stock < it.quantity) throw new HttpError(409, `${it.name}: only ${it.stock} unit(s) left in stock`);
      total += it.price * it.quantity;
    }
    const [o] = await conn.query('INSERT INTO orders SET ?', [{ ...f, order_number: `TMP-${Date.now()}-${req.user.id}`, user_id: req.user.id, payment_method: b.payment_method, total }]);
    const orderNumber = `AN-${new Date().getFullYear()}-${String(o.insertId).padStart(6, '0')}`;
    await conn.query('UPDATE orders SET order_number=? WHERE id=?', [orderNumber, o.insertId]);
    await conn.query('INSERT INTO order_items (order_id,car_id,car_name,unit_price,quantity) VALUES ?', [items.map((i) => [o.insertId, i.car_id, i.name, i.price, i.quantity])]);
    for (const it of items) await conn.query('UPDATE cars SET stock=stock-? WHERE id=?', [it.quantity, it.car_id]);
    await conn.query('DELETE FROM cart_items WHERE user_id=?', [req.user.id]);
    await conn.commit();
    res.status(201).json({ order: { id: o.insertId, order_number: orderNumber, total } });
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
}));

router.get('/orders', wrap(async (req, res) => res.json({ orders: await loadOrders('WHERE o.user_id=?', [req.user.id]) })));
router.get('/orders/:id', wrap(async (req, res) => {
  const [order] = await loadOrders('WHERE o.id=? AND o.user_id=?', [num(req.params.id, 0), req.user.id], 1);
  if (!order) throw new HttpError(404, 'Order not found');
  res.json({ order });
}));
router.put('/orders/:id/cancel', wrap(async (req, res) => {
  await changeStatus(num(req.params.id, 0), 'cancelled', req.user.id);
  res.json({ ok: true });
}));

module.exports = router;
