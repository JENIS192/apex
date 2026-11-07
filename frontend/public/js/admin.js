// Admin panel: dashboard, vehicles CRUD + image uploads, inventory, orders, customers.
import { api, actions, forms, $, esc, money, date, toast, rerender, parseHash } from './lib.js';
import { media, statusBadge, emptyState, PAYMENT } from './components.js';

const STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
const shell = (active, title, body, actionHtml = '') => `<div class="wrap admin">
  <aside class="side">${[['/admin', 'Dashboard'], ['/admin/cars', 'Vehicles'], ['/admin/inventory', 'Inventory'], ['/admin/orders', 'Orders'], ['/admin/users', 'Customers']].map(([h, l]) => `<a href="#${h}" class="${active === h ? 'active' : ''}">${l}</a>`).join('')}</aside>
  <section><div class="row between" style="margin-bottom:24px"><h2>${title}</h2>${actionHtml}</div>${body}</section></div>`;

/* ---------- Dashboard ---------- */
export async function dashboard() {
  const s = await api('/admin/stats'), t = s.totals, max = Math.max(1, ...s.byStatus.map((x) => x.n));
  return shell('/admin', 'Dashboard', `
    <div class="stats">${[['Revenue', money(t.revenue)], ['Orders', t.orders], ['Pending', t.pending], ['Vehicles', t.cars], ['Units in stock', t.units], ['Customers', t.customers]].map(([l, v]) => `<div class="stat"><span>${l}</span><b>${v}</b></div>`).join('')}</div>
    <div class="split"><div><h3 style="margin-bottom:12px">Recent orders</h3>${s.recent.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${s.recent.map((o) => `<tr><td><b>${esc(o.order_number)}</b><br><span class="muted">${date(o.created_at)}</span></td><td>${esc(o.customer_name)}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No orders yet', 'Orders will appear here as customers check out.')}</div>
    <div class="panel"><h3 style="margin-bottom:14px">Orders by status</h3>${s.byStatus.length ? s.byStatus.map((x) => `<div class="row between"><span>${statusBadge(x.status)}</span><b>${x.n}</b></div><div class="bar"><i style="width:${(x.n / max) * 100}%"></i></div>`).join('') : '<p class="muted">No data yet.</p>'}
      <h3 style="margin:22px 0 12px">Low stock</h3>${s.lowStock.length ? s.lowStock.map((c) => `<div class="row between" style="padding:6px 0"><a href="#/admin/cars/${c.id}">${esc(c.name)}</a><span class="status ${c.stock ? 'st-pending' : 'st-cancelled'}">${c.stock ? c.stock + ' left' : 'sold out'}</span></div>`).join('') : '<p class="muted">All vehicles are well stocked.</p>'}</div></div>`);
}

/* ---------- Vehicles list ---------- */
export async function cars() {
  const { cars: list } = await api('/admin/cars');
  return shell('/admin/cars', 'Vehicles', list.length ? `<div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Brand</th><th>Price</th><th>Stock</th><th>Featured</th><th></th></tr></thead><tbody>${list.map((c) => `<tr>
    <td><div class="row"><span class="thumb-sm">${media(c.image, c.name)}</span><div><b>${esc(c.name)}</b><br><span class="muted">${esc(c.category)} · ${c.year}</span></div></div></td><td>${esc(c.brand_name)}</td><td>${money(c.price)}</td><td>${c.stock}</td><td>${c.featured ? '★' : '—'}</td>
    <td class="right"><a class="btn ghost sm" href="#/admin/cars/${c.id}">Edit</a> <button class="btn danger sm" data-action="del-car" data-id="${c.id}" data-name="${esc(c.name)}">Delete</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('No vehicles', 'Add your first vehicle.'),
  '<a class="btn" href="#/admin/cars/new">+ Add vehicle</a>');
}
actions['del-car'] = async (el) => {
  if (!confirm(`Delete "${el.dataset.name}" and all its images? Existing orders keep their records.`)) return;
  await api('/admin/cars/' + el.dataset.id, { method: 'DELETE' }); toast('Vehicle deleted'); rerender();
};

/* ---------- Vehicle form + images ---------- */
export async function carForm(ctx) {
  const id = ctx.params[0];
  const [{ brands, categories }, existing] = await Promise.all([api('/brands'), id ? api('/cars/' + id) : null]);
  const c = existing?.car || { year: new Date().getFullYear(), stock: 1, featured: 0 };
  const specs = (existing?.specs || []).map((s) => `${s.spec_group} | ${s.spec_key} | ${s.spec_value}`).join('\n');
  const v = (x) => esc(x ?? '');
  return shell('/admin/cars', id ? `Edit ${esc(c.name)}` : 'Add vehicle', `
  <form class="panel" data-form="car" ${id ? `data-id="${id}"` : ''}>
    <div class="grid2"><div class="field"><label>Name</label><input name="name" required maxlength="150" value="${v(c.name)}"></div>
      <div class="field"><label>Brand</label><select name="brand_id" required>${brands.map((b) => `<option value="${b.id}" ${b.id === c.brand_id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div></div>
    <div class="grid3"><div class="field"><label>Category</label><select name="category">${categories.map((x) => `<option ${x === c.category ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Year</label><input name="year" type="number" min="1900" max="2100" required value="${v(c.year)}"></div>
      <div class="field"><label>Price (USD)</label><input name="price" type="number" min="1" step="0.01" required value="${v(c.price)}"></div></div>
    <div class="grid3"><div class="field"><label>Stock</label><input name="stock" type="number" min="0" step="1" required value="${v(c.stock)}"></div>
      <div class="field"><label>Horsepower</label><input name="horsepower" type="number" min="0" value="${v(c.horsepower)}"></div>
      <div class="field"><label>Top speed (km/h)</label><input name="top_speed_kmh" type="number" min="0" value="${v(c.top_speed_kmh)}"></div></div>
    <div class="grid2"><div class="field"><label>0–100 km/h (seconds)</label><input name="zero_to_100" type="number" min="0" step="0.01" value="${v(c.zero_to_100)}"></div>
      <div class="field" style="display:flex;align-items:end"><label class="check"><input type="checkbox" name="featured" ${c.featured ? 'checked' : ''}> Feature on homepage</label></div></div>
    <div class="field"><label>Description</label><textarea name="description" maxlength="5000">${v(c.description)}</textarea></div>
    <div class="field"><label>Specifications — one per line as <code>Group | Label | Value</code></label><textarea name="specs" style="min-height:200px;font-family:ui-monospace,Consolas,monospace;font-size:.88rem" placeholder="Powertrain | Engine | 5.0L twin-turbo V8">${esc(specs)}</textarea></div>
    <div class="field"><label>Upload images (JPG, PNG, WEBP, AVIF · max 8 MB each · up to 10)</label><input name="images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple></div>
    <div class="form-error" data-error></div><div class="row"><button class="btn" type="submit">${id ? 'Save changes' : 'Create vehicle'}</button><a class="btn ghost" href="#/admin/cars">Cancel</a></div>
  </form>
  ${id ? `<div class="panel" style="margin-top:24px"><h3>Images</h3><p class="muted">The primary image is shown on cards and as the main gallery photo.</p>
    ${existing.images.length ? `<div class="img-grid">${existing.images.map((im) => `<div class="img-item ${im.is_primary ? 'primary' : ''}"><img src="${esc(im.url)}" alt=""><div class="row">${im.is_primary ? '<span class="tag ok">Primary</span>' : `<button class="btn ghost sm" data-action="img-primary" data-id="${im.id}">Set primary</button>`}<button class="btn danger sm" data-action="img-del" data-id="${im.id}">Delete</button></div></div>`).join('')}</div>` : '<p class="muted" style="margin-top:12px">No images uploaded yet.</p>'}</div>` : ''}`);
}
forms.car = async (f, d) => {
  const id = f.dataset.id, files = [...f.elements.images.files];
  delete d.images;
  if (files.length > 10) throw new Error('You can upload at most 10 images at a time');
  const carId = id || (await api('/admin/cars', { method: 'POST', body: d })).id;
  if (id) await api('/admin/cars/' + id, { method: 'PUT', body: d });
  if (files.length) {
    const fd = new FormData(); files.forEach((x) => fd.append('images', x));
    try { await api(`/admin/cars/${carId}/images`, { method: 'POST', form: fd }); } catch (e) { toast('Saved, but image upload failed: ' + e.message, 'err'); }
  }
  toast('Vehicle saved');
  if (id) rerender(); else location.hash = '#/admin/cars/' + carId;
};
actions['img-primary'] = async (el) => { await api(`/admin/images/${el.dataset.id}/primary`, { method: 'PUT' }); rerender(); };
actions['img-del'] = async (el) => { if (confirm('Delete this image?')) { await api('/admin/images/' + el.dataset.id, { method: 'DELETE' }); rerender(); } };

/* ---------- Inventory ---------- */
export async function inventory() {
  const { cars: list } = await api('/admin/cars');
  return shell('/admin/inventory', 'Inventory', `<div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Brand</th><th>Price</th><th>Status</th><th>Units</th><th></th></tr></thead><tbody>${list.map((c) => `<tr>
    <td><b>${esc(c.name)}</b></td><td>${esc(c.brand_name)}</td><td>${money(c.price)}</td><td><span class="status ${c.stock === 0 ? 'st-cancelled' : c.stock <= 1 ? 'st-pending' : 'st-delivered'}">${c.stock === 0 ? 'Sold out' : c.stock <= 1 ? 'Low stock' : 'In stock'}</span></td>
    <td style="width:120px"><input id="stock-${c.id}" type="number" min="0" step="1" value="${c.stock}" aria-label="Stock for ${esc(c.name)}"></td><td class="right"><button class="btn sm" data-action="save-stock" data-id="${c.id}">Update</button></td></tr>`).join('')}</tbody></table></div>`);
}
actions['save-stock'] = async (el) => {
  await api(`/admin/cars/${el.dataset.id}/stock`, { method: 'PUT', body: { stock: $('#stock-' + el.dataset.id).value } });
  toast('Inventory updated'); rerender();
};

/* ---------- Orders ---------- */
export async function orders(ctx) {
  const st = ctx.query.status || '';
  const { orders: list } = await api('/admin/orders' + (st ? '?status=' + encodeURIComponent(st) : ''));
  return shell('/admin/orders', 'Orders', `
    <div class="row" style="margin-bottom:18px"><a class="btn ${st ? 'ghost' : ''} sm" href="#/admin/orders">All</a>${STATUSES.map((s) => `<a class="btn ${st === s ? '' : 'ghost'} sm" href="#/admin/orders?status=${s}">${s}</a>`).join('')}</div>
    ${list.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Vehicles</th><th>Total</th><th>Status</th></tr></thead><tbody>${list.map((o) => `<tr>
      <td><b>${esc(o.order_number)}</b><br><span class="muted">${date(o.created_at)}</span></td>
      <td>${esc(o.customer_name)}<br><span class="muted">${esc(o.customer_email)}</span>
        <details style="margin-top:6px"><summary class="muted" style="cursor:pointer;font-size:.82rem">Delivery &amp; payment</summary><div class="muted" style="font-size:.85rem;margin-top:6px">${esc(o.ship_name)} · ${esc(o.ship_phone)}<br>${esc(o.ship_address)}, ${esc(o.ship_city)} ${esc(o.ship_postal)}, ${esc(o.ship_country)}<br>Payment: ${PAYMENT[o.payment_method]}${o.notes ? `<br>Notes: ${esc(o.notes)}` : ''}</div></details></td>
      <td>${o.items.map((i) => `${esc(i.car_name)} ×${i.quantity}`).join('<br>')}</td><td>${money(o.total)}</td>
      <td>${['cancelled', 'delivered'].includes(o.status) ? statusBadge(o.status) : `<select data-change="order-status" data-id="${o.id}" aria-label="Order status">${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No orders', 'No orders match this filter.')}`);
}
actions['order-status'] = async (el) => {
  if (el.value === 'cancelled' && !confirm('Cancel this order and return the vehicles to stock? This cannot be undone.')) return rerender();
  try { await api(`/admin/orders/${el.dataset.id}/status`, { method: 'PUT', body: { status: el.value } }); toast('Order updated'); } finally { rerender(); }
};

/* ---------- Customers ---------- */
export async function users() {
  const { users: list } = await api('/admin/users');
  return shell('/admin/users', 'Customers', `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Orders</th><th>Spent</th><th>Joined</th></tr></thead><tbody>${list.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.phone || '—')}</td><td>${u.role === 'admin' ? '<span class="status st-confirmed">admin</span>' : 'customer'}</td><td>${u.orders}</td><td>${money(u.spent)}</td><td>${date(u.created_at)}</td></tr>`).join('')}</tbody></table></div>`);
}
