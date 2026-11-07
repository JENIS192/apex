const router = require('express').Router();
const db = require('../db');
const { HttpError, wrap, num, CATEGORIES, IMG } = require('../utils');

router.get('/brands', wrap(async (req, res) => {
  const [brands] = await db.pool.query('SELECT b.*, (SELECT COUNT(*) FROM cars WHERE brand_id=b.id) AS car_count FROM brands b ORDER BY b.name');
  res.json({ brands, categories: CATEGORIES });
}));

router.get('/cars', wrap(async (req, res) => {
  const { q, brand, category, minPrice, maxPrice, sort = 'featured', featured, inStock } = req.query;
  const where = ['1=1'], p = [];
  if (q) { const l = `%${String(q).slice(0, 80)}%`; where.push('(c.name LIKE ? OR b.name LIKE ? OR c.description LIKE ? OR c.category LIKE ?)'); p.push(l, l, l, l); }
  if (brand) { where.push('b.slug=?'); p.push(String(brand)); }
  if (category) { where.push('c.category=?'); p.push(String(category)); }
  if (num(minPrice) !== null) { where.push('c.price>=?'); p.push(num(minPrice)); }
  if (num(maxPrice) !== null) { where.push('c.price<=?'); p.push(num(maxPrice)); }
  if (featured === '1') where.push('c.featured=1');
  if (inStock === '1') where.push('c.stock>0');
  const orders = { featured: 'c.featured DESC, c.created_at DESC', newest: 'c.created_at DESC', price_asc: 'c.price ASC', price_desc: 'c.price DESC', power: 'c.horsepower DESC' };
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 12, 1), 48);
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const base = `FROM cars c JOIN brands b ON b.id=c.brand_id WHERE ${where.join(' AND ')}`;
  const [[{ total }]] = await db.pool.query(`SELECT COUNT(*) AS total ${base}`, p);
  const [cars] = await db.pool.query(
    `SELECT c.*, b.name AS brand_name, b.slug AS brand_slug, ${IMG} AS image ${base} ORDER BY ${orders[sort] || orders.featured} LIMIT ? OFFSET ?`,
    [...p, limit, (page - 1) * limit]);
  res.json({ cars, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
}));

router.get('/cars/:ref', wrap(async (req, res) => {
  const ref = req.params.ref;
  const [[car]] = await db.pool.query(
    'SELECT c.*, b.name AS brand_name, b.slug AS brand_slug, b.country AS brand_country FROM cars c JOIN brands b ON b.id=c.brand_id WHERE c.id=? OR c.slug=?', [Number(ref) || 0, ref]);
  if (!car) throw new HttpError(404, 'Vehicle not found');
  const [images] = await db.pool.query('SELECT id,url,is_primary FROM car_images WHERE car_id=? ORDER BY is_primary DESC, sort_order, id', [car.id]);
  const [specs] = await db.pool.query('SELECT spec_group,spec_key,spec_value FROM car_specs WHERE car_id=? ORDER BY sort_order, id', [car.id]);
  const [related] = await db.pool.query(
    `SELECT c.*, b.name AS brand_name, b.slug AS brand_slug, ${IMG} AS image FROM cars c JOIN brands b ON b.id=c.brand_id WHERE c.id<>? ORDER BY (c.brand_id=?) DESC, c.featured DESC LIMIT 3`, [car.id, car.brand_id]);
  res.json({ car, images, specs, related });
}));

module.exports = router;
