const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = require('express').Router();
const db = require('../db');
const { auth, adminOnly } = require('../auth');
const { HttpError, wrap, str, num, slugify, CATEGORIES, ORDER_STATUSES, UPLOAD_DIR, IMG, loadOrders, changeStatus } = require('../utils');

router.use(auth, adminOnly);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Only JPG, PNG, WEBP or AVIF images are allowed'))),
});
const removeFile = (url) => { if (url && url.startsWith('/uploads/')) fs.unlink(path.join(UPLOAD_DIR, path.basename(url)), () => {}); };

/* ---------- Dashboard ---------- */
router.get('/stats', wrap(async (req, res) => {
  const [[totals]] = await db.pool.query(
    `SELECT (SELECT COUNT(*) FROM users WHERE role='customer') AS customers, (SELECT COUNT(*) FROM cars) AS cars,
            (SELECT COALESCE(SUM(stock),0) FROM cars) AS units, (SELECT COUNT(*) FROM orders) AS orders,
            (SELECT COUNT(*) FROM orders WHERE status='pending') AS pending,
            (SELECT COALESCE(SUM(total),0) FROM orders WHERE status<>'cancelled') AS revenue`);
  const [byStatus] = await db.pool.query('SELECT status, COUNT(*) AS n FROM orders GROUP BY status');
  const [lowStock] = await db.pool.query('SELECT c.id,c.name,c.stock,b.name AS brand_name FROM cars c JOIN brands b ON b.id=c.brand_id WHERE c.stock<=1 ORDER BY c.stock, c.name LIMIT 8');
  res.json({ totals, byStatus, lowStock, recent: await loadOrders('', [], 6) });
}));

/* ---------- Cars (CRUD) ---------- */
const optNum = (v, label, errs, int = false) => {
  const n = num(v); if (n === null) return null;
  if (n < 0 || (int && !Number.isInteger(n))) errs.push(`${label} must be a valid positive number`);
  return n;
};
async function parseCar(b) {
  const errs = [];
  const name = str(b.name, 150); if (name.length < 2) errs.push('Name is required');
  const [[brand]] = await db.pool.query('SELECT id,name FROM brands WHERE id=?', [num(b.brand_id, 0)]); if (!brand) errs.push('Select a valid brand');
  const category = str(b.category, 40); if (!CATEGORIES.includes(category)) errs.push('Select a valid category');
  const year = num(b.year); if (!(Number.isInteger(year) && year >= 1900 && year <= 2100)) errs.push('Enter a valid year');
  const price = num(b.price); if (!(price > 0 && price < 1e10)) errs.push('Price must be greater than 0');
  const stock = num(b.stock, 0); if (!(Number.isInteger(stock) && stock >= 0)) errs.push('Stock must be a whole number (0 or more)');
  const horsepower = optNum(b.horsepower, 'Horsepower', errs, true), top_speed_kmh = optNum(b.top_speed_kmh, 'Top speed', errs, true), zero_to_100 = optNum(b.zero_to_100, '0-100 time', errs);
  if (errs.length) throw new HttpError(400, 'Validation failed', errs);
  const specs = String(b.specs || '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p.length >= 3 && p[0] && p[1] && p[2])
    .slice(0, 60).map((p, i) => [p[0].slice(0, 60), p[1].slice(0, 80), p.slice(2).join(' | ').slice(0, 255), i]);
  return {
    brand, specs,
    data: { brand_id: brand.id, name, category, year, price, stock, horsepower, top_speed_kmh, zero_to_100, description: str(b.description, 5000) || null, featured: [true, 'on', '1', 1, 'true'].includes(b.featured) ? 1 : 0 },
  };
}
const saveSpecs = async (carId, specs) => {
  await db.pool.query('DELETE FROM car_specs WHERE car_id=?', [carId]);
  if (specs.length) await db.pool.query('INSERT INTO car_specs (car_id,spec_group,spec_key,spec_value,sort_order) VALUES ?', [specs.map((s) => [carId, ...s])]);
};

router.get('/cars', wrap(async (req, res) => {
  const [cars] = await db.pool.query(`SELECT c.*, b.name AS brand_name, ${IMG} AS image FROM cars c JOIN brands b ON b.id=c.brand_id ORDER BY b.name, c.name`);
  res.json({ cars });
}));
router.post('/cars', wrap(async (req, res) => {
  const { brand, data, specs } = await parseCar(req.body);
  let slug = slugify(`${brand.name} ${data.name}`);
  const [[ex]] = await db.pool.query('SELECT id FROM cars WHERE slug=?', [slug]);
  if (ex) slug += `-${Date.now().toString(36)}`;
  const [r] = await db.pool.query('INSERT INTO cars SET ?', [{ ...data, slug }]);
  await saveSpecs(r.insertId, specs);
  res.status(201).json({ id: r.insertId, slug });
}));
router.put('/cars/:id', wrap(async (req, res) => {
  const id = num(req.params.id, 0);
  const [[car]] = await db.pool.query('SELECT id FROM cars WHERE id=?', [id]);
  if (!car) throw new HttpError(404, 'Vehicle not found');
  const { data, specs } = await parseCar(req.body);
  await db.pool.query('UPDATE cars SET ? WHERE id=?', [data, id]);
  await saveSpecs(id, specs);
  res.json({ ok: true });
}));
router.delete('/cars/:id', wrap(async (req, res) => {
  const id = num(req.params.id, 0);
  const [imgs] = await db.pool.query('SELECT url FROM car_images WHERE car_id=?', [id]);
  const [r] = await db.pool.query('DELETE FROM cars WHERE id=?', [id]);
  if (!r.affectedRows) throw new HttpError(404, 'Vehicle not found');
  imgs.forEach((i) => removeFile(i.url));
  res.json({ ok: true });
}));

/* ---------- Inventory ---------- */
router.put('/cars/:id/stock', wrap(async (req, res) => {
  const stock = num(req.body.stock);
  if (!(Number.isInteger(stock) && stock >= 0 && stock < 100000)) throw new HttpError(400, 'Stock must be a whole number (0 or more)');
  const [r] = await db.pool.query('UPDATE cars SET stock=? WHERE id=?', [stock, num(req.params.id, 0)]);
  if (!r.affectedRows) throw new HttpError(404, 'Vehicle not found');
  res.json({ ok: true });
}));

/* ---------- Image uploads ---------- */
router.post('/cars/:id/images', upload.array('images', 10), wrap(async (req, res) => {
  const id = num(req.params.id, 0), files = req.files || [];
  const [[car]] = await db.pool.query('SELECT id FROM cars WHERE id=?', [id]);
  if (!car) { files.forEach((f) => removeFile(`/uploads/${f.filename}`)); throw new HttpError(404, 'Vehicle not found'); }
  if (!files.length) throw new HttpError(400, 'No images were uploaded');
  const [[{ n }]] = await db.pool.query('SELECT COUNT(*) AS n FROM car_images WHERE car_id=?', [id]);
  await db.pool.query('INSERT INTO car_images (car_id,url,is_primary,sort_order) VALUES ?', [files.map((f, i) => [id, `/uploads/${f.filename}`, n === 0 && i === 0 ? 1 : 0, n + i])]);
  res.status(201).json({ uploaded: files.length });
}));
router.put('/images/:imageId/primary', wrap(async (req, res) => {
  const [[img]] = await db.pool.query('SELECT id,car_id FROM car_images WHERE id=?', [num(req.params.imageId, 0)]);
  if (!img) throw new HttpError(404, 'Image not found');
  await db.pool.query('UPDATE car_images SET is_primary=(id=?) WHERE car_id=?', [img.id, img.car_id]);
  res.json({ ok: true });
}));
router.delete('/images/:imageId', wrap(async (req, res) => {
  const [[img]] = await db.pool.query('SELECT * FROM car_images WHERE id=?', [num(req.params.imageId, 0)]);
  if (!img) throw new HttpError(404, 'Image not found');
  await db.pool.query('DELETE FROM car_images WHERE id=?', [img.id]);
  removeFile(img.url);
  if (img.is_primary) await db.pool.query('UPDATE car_images SET is_primary=1 WHERE car_id=? ORDER BY sort_order, id LIMIT 1', [img.car_id]);
  res.json({ ok: true });
}));

/* ---------- Orders & customers ---------- */
router.get('/orders', wrap(async (req, res) => {
  const s = req.query.status;
  res.json({ orders: ORDER_STATUSES.includes(s) ? await loadOrders('WHERE o.status=?', [s]) : await loadOrders() });
}));
router.put('/orders/:id/status', wrap(async (req, res) => {
  if (!ORDER_STATUSES.includes(req.body.status)) throw new HttpError(400, 'Invalid status');
  await changeStatus(num(req.params.id, 0), req.body.status);
  res.json({ ok: true });
}));
router.get('/users', wrap(async (req, res) => {
  const [users] = await db.pool.query(
    `SELECT u.id,u.name,u.email,u.phone,u.role,u.created_at, (SELECT COUNT(*) FROM orders WHERE user_id=u.id) AS orders,
            (SELECT COALESCE(SUM(total),0) FROM orders WHERE user_id=u.id AND status<>'cancelled') AS spent FROM users u ORDER BY u.created_at DESC`);
  res.json({ users });
}));

module.exports = router;
