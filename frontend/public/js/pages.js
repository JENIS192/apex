// Public + customer pages.
import { api, store, actions, forms, $, esc, money, date, toast, qs, parseHash, rerender, reveal, loadUserData } from './lib.js';
import { carCard, media, heart, statusBadge, stockTag, emptyState, renderChrome, PAYMENT } from './components.js';

const needLogin = () => { toast('Please sign in to continue', 'err'); location.hash = '#/login?next=' + encodeURIComponent(location.hash.slice(1)); };

/* ---------------- Home ---------------- */
export async function home() {
  const [{ cars }, { brands }] = await Promise.all([api('/cars?featured=1&limit=6'), api('/brands')]);
  const hero = cars.find((c) => /jesko/i.test(c.name)) || cars[0];
  const ticker = Array(2).fill(['Koenigsegg', 'Jesko Absolut', 'BMW M', 'M5', 'M4 CSL', 'i7 M70', 'XM'].map((t) => `<span>${t}</span>`).join('')).join('');
  return `
  ${hero ? `<section class="hero"><div class="hero-bg"></div><div class="wrap hero-grid">
    <div class="hero-copy reveal"><span class="eyebrow">Koenigsegg · ${esc(hero.name)}</span>
      <h1>Engineered <em>beyond</em> every limit.</h1>
      <p>Own the machine built to chase 300 mph — and the BMW M and electric flagships that make every road feel like a circuit. Curated, verified, delivered.</p>
      <div class="row"><a class="btn" href="#/cars/${esc(hero.slug)}">Discover the ${esc(hero.name)}</a><a class="btn ghost" href="#/cars">Browse collection</a></div>
      <div class="hero-stats"><div><b>${hero.horsepower ?? '—'}</b><span>Horsepower</span></div><div><b>${hero.top_speed_kmh ?? '—'}</b><span>km/h claimed</span></div><div><b>${hero.zero_to_100 ?? '—'}s</b><span>0–100 km/h</span></div></div></div>
    <div class="hero-media reveal" style="--i:2">${media(hero.image, hero.name)}</div></div></section>` : ''}
  <div class="marquee"><div>${ticker}</div></div>
  <section class="section"><div class="wrap"><div class="sec-head reveal"><span class="eyebrow">Marques</span><h2>Two icons. <em>One</em> standard.</h2></div>
    <div class="brands">${brands.map((b, i) => `<a class="brand-card reveal" style="--i:${i}" href="#/cars?brand=${esc(b.slug)}"><span class="muted">${esc(b.country)}</span><h3>${esc(b.name)}</h3><p>${esc(b.tagline)}</p><span style="color:var(--cyan)">${b.car_count} model${b.car_count === 1 ? '' : 's'} →</span></a>`).join('')}</div></div></section>
  <section class="section" style="padding-top:20px"><div class="wrap"><div class="sec-head row between reveal"><div><span class="eyebrow">Featured</span><h2>Selected <em>acquisitions</em></h2></div><a class="btn ghost" href="#/cars">View all</a></div>
    <div class="grid">${cars.map(carCard).join('')}</div></div></section>
  <section class="section" style="padding-top:20px"><div class="wrap features">
    ${[['✓', 'Verified provenance', 'Every vehicle is documented and inspected before it is listed.'], ['◆', 'Concierge purchasing', 'Orders are reviewed by our team and confirmed personally.'], ['⛨', 'Secure accounts', 'Encrypted credentials and protected sessions on every request.'], ['➤', 'Insured delivery', 'Enclosed transport arranged to your door once your order is confirmed.']]
      .map(([i, t, p], k) => `<div class="feature reveal" style="--i:${k}"><i>${i}</i><h3>${t}</h3><p>${p}</p></div>`).join('')}</div></section>
  <section class="section" style="padding-top:0"><div class="wrap"><div class="cta reveal"><h2>Reserve your <em>next</em> icon</h2><p>Create an account to save vehicles, build your cart and place an order in minutes.</p><div class="row" style="justify-content:center"><a class="btn" href="#/register">Create account</a><a class="btn ghost" href="#/cars">Explore cars</a></div></div></div></section>`;
}

/* ---------------- Collection ---------------- */
export async function cars(ctx) {
  const [{ brands, categories }] = [await api('/brands')];
  const q = ctx.query, sel = (a, b) => (a === b ? 'selected' : '');
  ctx.after = () => loadCars(+q.page || 1);
  return `<div class="wrap"><div class="page-head reveal"><span class="eyebrow">Collection</span><h1 style="font-size:clamp(2rem,5vw,3.6rem)">The <em>showroom</em></h1></div>
  <div class="layout" style="padding-bottom:80px">
    <form id="filters" class="filters" data-form="filters" autocomplete="off">
      <div class="field"><label for="f-q">Search</label><input id="f-q" name="q" value="${esc(q.q)}" placeholder="Model, brand, keyword" data-input="filter" maxlength="80"></div>
      <div class="field"><label>Brand</label><select name="brand" data-change="filter"><option value="">All brands</option>${brands.map((b) => `<option value="${esc(b.slug)}" ${sel(q.brand, b.slug)}>${esc(b.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Category</label><select name="category" data-change="filter"><option value="">All categories</option>${categories.map((c) => `<option ${sel(q.category, c)}>${c}</option>`).join('')}</select></div>
      <div class="grid2"><div class="field"><label>Min price</label><input name="minPrice" type="number" min="0" step="1000" value="${esc(q.minPrice)}" data-input="filter"></div><div class="field"><label>Max price</label><input name="maxPrice" type="number" min="0" step="1000" value="${esc(q.maxPrice)}" data-input="filter"></div></div>
      <div class="field"><label>Sort by</label><select name="sort" data-change="filter">${[['featured', 'Featured'], ['newest', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['power', 'Most powerful']].map(([v, l]) => `<option value="${v}" ${sel(q.sort, v)}>${l}</option>`).join('')}</select></div>
      <div class="field"><label class="check"><input type="checkbox" name="inStock" value="1" data-change="filter" ${q.inStock ? 'checked' : ''}> In stock only</label></div>
      <button type="button" class="btn ghost block" data-action="reset-filters">Reset filters</button>
    </form>
    <div><div id="results"><div class="loader"><i></i></div></div></div></div></div>`;
}
async function loadCars(page = 1) {
  const f = $('#filters'); if (!f) return;
  const d = Object.fromEntries(new FormData(f));
  history.replaceState(null, '', '#/cars' + (qs({ ...d, page: page > 1 ? page : '' }) ? '?' + qs({ ...d, page: page > 1 ? page : '' }) : ''));
  const box = $('#results'); box.style.opacity = '.5';
  try {
    const r = await api('/cars?' + qs({ ...d, page, limit: 9 }));
    box.style.opacity = '1';
    box.innerHTML = `<div class="results-bar"><span>${r.total} vehicle${r.total === 1 ? '' : 's'} found</span></div>` +
      (r.cars.length ? `<div class="grid">${r.cars.map(carCard).join('')}</div>` : emptyState('No vehicles match', 'Try adjusting your search or clearing some filters.')) +
      (r.pages > 1 ? `<div class="pager">${Array.from({ length: r.pages }, (_, i) => `<button class="${i + 1 === r.page ? 'on' : ''}" data-action="page" data-p="${i + 1}">${i + 1}</button>`).join('')}</div>` : '');
    reveal();
  } catch (e) { box.style.opacity = '1'; box.innerHTML = emptyState('Could not load vehicles', e.message); }
}
forms.filters = () => loadCars(1);
actions.filter = () => loadCars(1);
actions.page = (el) => { loadCars(+el.dataset.p); window.scrollTo({ top: 0, behavior: 'smooth' }); };
actions['reset-filters'] = () => { $('#filters').reset(); [...$('#filters').elements].forEach((e) => { if (e.name && e.type !== 'button') { e.type === 'checkbox' ? (e.checked = false) : (e.value = ''); } }); loadCars(1); };
forms.hsearch = (f, d) => { location.hash = '#/cars?' + qs({ q: d.q.trim() }); f.reset(); };

/* ---------------- Details ---------------- */
export async function carDetail(ctx) {
  const { car, images, specs, related } = await api('/cars/' + encodeURIComponent(ctx.params[0]));
  document.title = `${car.name} — APEX NOIR`;
  const groups = specs.reduce((a, s) => ((a[s.spec_group] ||= []).push(s), a), {});
  return `<div class="wrap"><div class="detail">
    <div class="gallery reveal"><div class="main">${media(images[0]?.url, car.name, 'big')}</div>
      ${images.length > 1 ? `<div class="thumbs">${images.map((im) => `<button data-action="thumb" data-src="${esc(im.url)}" aria-label="View image"><img src="${esc(im.url)}" alt=""></button>`).join('')}</div>` : ''}</div>
    <div class="info reveal" style="--i:1">
      <div class="crumbs"><a href="#/cars">Collection</a> / <a href="#/cars?brand=${esc(car.brand_slug)}">${esc(car.brand_name)}</a></div>
      <span class="eyebrow" style="margin:0">${esc(car.category)} · ${car.year}</span><h1>${esc(car.name)}</h1>
      <div class="row">${stockTag(car.stock)}<span class="muted">${esc(car.brand_name)} · ${esc(car.brand_country)}</span></div>
      <div class="price">${money(car.price)}</div>
      <div class="keystats"><div><b>${car.horsepower ?? '—'}</b><span>HP</span></div><div><b>${car.zero_to_100 ?? '—'}s</b><span>0–100</span></div><div><b>${car.top_speed_kmh ?? '—'}</b><span>km/h</span></div><div><b>${car.year}</b><span>Year</span></div></div>
      <p class="muted" style="white-space:pre-line">${esc(car.description || '')}</p>
      <div class="row" style="margin-top:28px"><button class="btn" data-action="buy-now" data-id="${car.id}" ${car.stock <= 0 ? 'disabled' : ''}>Reserve now</button>
        <button class="btn ghost" data-action="add-cart" data-id="${car.id}" ${car.stock <= 0 ? 'disabled' : ''}>Add to cart</button>${heart(car.id)}</div></div></div>
  ${Object.keys(groups).length ? `<section class="section" style="padding-top:50px"><div class="sec-head reveal"><span class="eyebrow">Specifications</span><h2>Technical <em>data</em></h2></div>
    <div class="specs">${Object.entries(groups).map(([g, rows], i) => `<div class="spec-group reveal" style="--i:${i}"><h4>${esc(g)}</h4><dl>${rows.map((r) => `<div><dt>${esc(r.spec_key)}</dt><dd>${esc(r.spec_value)}</dd></div>`).join('')}</dl></div>`).join('')}</div></section>` : ''}
  ${related.length ? `<section class="section" style="padding-top:20px"><div class="sec-head reveal"><h2>You may also <em>like</em></h2></div><div class="grid">${related.map(carCard).join('')}</div></section>` : ''}</div>`;
}
actions.thumb = (el) => { const m = $('.gallery .main'); m.innerHTML = `<img src="${esc(el.dataset.src)}" alt="">`; };

/* ---------------- Wishlist / cart actions ---------------- */
actions.wish = async (el) => {
  if (!store.user) return needLogin();
  const id = +el.dataset.id, on = store.wishlist.has(id);
  await api('/wishlist/' + id, { method: on ? 'DELETE' : 'POST' });
  on ? store.wishlist.delete(id) : store.wishlist.add(id);
  document.querySelectorAll(`.heart[data-id="${id}"]`).forEach((b) => b.classList.toggle('on', !on));
  renderChrome();
  if (parseHash().path === '/wishlist') rerender();
  toast(on ? 'Removed from wishlist' : 'Saved to wishlist');
};
async function addToCart(id) {
  if (!store.user) { needLogin(); return false; }
  store.cart = (await api('/cart', { method: 'POST', body: { carId: id, quantity: 1 } })).items;
  renderChrome();
  return true;
}
actions['add-cart'] = async (el) => { if (await addToCart(+el.dataset.id)) toast('Added to your cart'); };
actions['buy-now'] = async (el) => { if (await addToCart(+el.dataset.id)) location.hash = '#/checkout'; };
actions.qty = async (el) => {
  const id = +el.dataset.id, it = store.cart.find((x) => x.car_id === id), q = it.quantity + +el.dataset.d;
  if (q < 1) return;
  store.cart = (await api('/cart/' + id, { method: 'PUT', body: { quantity: q } })).items; renderChrome(); rerender();
};
actions['remove-cart'] = async (el) => { store.cart = (await api('/cart/' + el.dataset.id, { method: 'DELETE' })).items; renderChrome(); rerender(); };

export async function wishlist() {
  const { items } = await api('/wishlist');
  store.wishlist = new Set(items.map((c) => c.id));
  return `<div class="wrap section"><div class="sec-head"><span class="eyebrow">Saved</span><h2>Your <em>wishlist</em></h2></div>${items.length ? `<div class="grid">${items.map(carCard).join('')}</div>` : emptyState('Nothing saved yet', 'Tap the heart on any vehicle to keep it here.', '<a class="btn" href="#/cars">Browse collection</a>')}</div>`;
}

const cartTotal = () => store.cart.reduce((s, i) => s + i.price * i.quantity, 0);
export async function cart() {
  store.cart = (await api('/cart')).items; renderChrome();
  if (!store.cart.length) return `<div class="wrap section">${emptyState('Your cart is empty', 'Add a vehicle to begin your order.', '<a class="btn" href="#/cars">Browse collection</a>')}</div>`;
  return `<div class="wrap section"><div class="sec-head"><span class="eyebrow">Cart</span><h2>Your <em>selection</em></h2></div><div class="split"><div>
    ${store.cart.map((i) => `<div class="cart-row"><a class="thumb-sm" style="width:120px" href="#/cars/${esc(i.slug)}">${media(i.image, i.name)}</a>
      <div><div class="muted" style="font-size:.8rem;letter-spacing:.16em;text-transform:uppercase">${esc(i.brand_name)}</div><h3>${esc(i.name)}</h3><div class="muted">${money(i.price)} each · ${i.stock} in stock</div></div>
      <div class="qty"><button data-action="qty" data-id="${i.car_id}" data-d="-1" aria-label="Decrease">−</button><span>${i.quantity}</span><button data-action="qty" data-id="${i.car_id}" data-d="1" aria-label="Increase">+</button></div>
      <div class="right"><b>${money(i.price * i.quantity)}</b><br><button class="btn danger sm" style="margin-top:8px" data-action="remove-cart" data-id="${i.car_id}">Remove</button></div></div>`).join('')}</div>
    <aside class="panel"><h3 style="margin-bottom:14px">Order summary</h3><div class="sumrow"><span>Subtotal</span><span>${money(cartTotal())}</span></div><div class="sumrow"><span>Delivery</span><span>Quoted on confirmation</span></div><div class="sumrow total"><span>Total</span><span>${money(cartTotal())}</span></div>
    <a class="btn block" style="margin-top:18px" href="#/checkout">Proceed to checkout</a></aside></div></div>`;
}

export async function checkout() {
  store.cart = (await api('/cart')).items; renderChrome();
  if (!store.cart.length) return `<div class="wrap section">${emptyState('Your cart is empty', 'Add a vehicle before checking out.', '<a class="btn" href="#/cars">Browse collection</a>')}</div>`;
  const u = store.user;
  return `<div class="wrap section"><div class="sec-head"><span class="eyebrow">Checkout</span><h2>Complete your <em>order</em></h2></div>
  <form class="split" data-form="checkout"><div class="panel"><h3 style="margin-bottom:18px">Delivery details</h3>
    <div class="grid2"><div class="field"><label>Full name</label><input name="ship_name" required maxlength="100" value="${esc(u.name)}"></div><div class="field"><label>Phone</label><input name="ship_phone" required maxlength="30" value="${esc(u.phone || '')}"></div></div>
    <div class="field"><label>Address</label><input name="ship_address" required maxlength="255"></div>
    <div class="grid3"><div class="field"><label>City</label><input name="ship_city" required maxlength="100"></div><div class="field"><label>Postal code</label><input name="ship_postal" required maxlength="20"></div><div class="field"><label>Country</label><input name="ship_country" required maxlength="100"></div></div>
    <h3 style="margin:10px 0 14px">Payment method</h3>
    <label class="radio"><input type="radio" name="payment_method" value="wire_transfer" checked><span><b>Bank wire transfer</b><small>Wire instructions are issued by our team once your order is confirmed.</small></span></label>
    <label class="radio"><input type="radio" name="payment_method" value="dealer_financing"><span><b>Dealer financing</b><small>A specialist will contact you with financing options after confirmation.</small></span></label>
    <div class="field" style="margin-top:16px"><label>Notes (optional)</label><textarea name="notes" maxlength="500" style="min-height:80px"></textarea></div></div>
  <aside class="panel"><h3 style="margin-bottom:14px">Your order</h3>${store.cart.map((i) => `<div class="sumrow"><span>${esc(i.name)} × ${i.quantity}</span><span>${money(i.price * i.quantity)}</span></div>`).join('')}
    <div class="sumrow total"><span>Total</span><span>${money(cartTotal())}</span></div><div class="form-error" data-error style="margin-top:12px"></div>
    <button class="btn block" type="submit">Place order</button><p class="muted" style="font-size:.82rem;margin-top:12px">No payment is taken online. Your order is reserved and our team confirms it personally.</p></aside></form></div>`;
}
forms.checkout = async (f, d) => {
  const r = await api('/orders', { method: 'POST', body: d });
  store.cart = []; renderChrome(); toast('Order placed — ' + r.order.order_number);
  location.hash = `#/orders/${r.order.id}?placed=1`;
};

/* ---------------- Auth ---------------- */
const authShell = (title, sub, name, fields, btn, foot) => `<div class="wrap"><div class="narrow panel auth-card reveal"><h2>${title}</h2><p class="sub">${sub}</p><form data-form="${name}" novalidate>${fields}<div class="form-error" data-error></div><button class="btn block" type="submit">${btn}</button></form><p class="muted center" style="margin-top:20px">${foot}</p></div></div>`;
export const login = (ctx) => (store.user ? ((location.hash = '#/account'), '') : authShell('Welcome back', 'Sign in to access your garage.', 'login',
  `<input type="hidden" name="next" value="${esc(ctx.query.next || '')}"><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Password</label><input name="password" type="password" required autocomplete="current-password"></div>`,
  'Sign in', 'New here? <a href="#/register" style="color:var(--cyan)">Create an account</a>'));
export const register = () => (store.user ? ((location.hash = '#/account'), '') : authShell('Create account', 'Join Apex Noir to buy, save and track.', 'register',
  `<div class="field"><label>Full name</label><input name="name" required autocomplete="name"></div><div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div class="field"><label>Phone (optional)</label><input name="phone" autocomplete="tel"></div><div class="field"><label>Password</label><input name="password" type="password" required minlength="8" autocomplete="new-password"><small class="muted">At least 8 characters with letters and numbers.</small></div>`,
  'Create account', 'Already a member? <a href="#/login" style="color:var(--cyan)">Sign in</a>'));
const afterAuth = async (user, next) => {
  store.user = user; await loadUserData(); renderChrome();
  toast(`Welcome, ${user.name.split(' ')[0]}`);
  location.hash = '#' + (next && next.startsWith('/') && !next.startsWith('//') ? next : user.role === 'admin' ? '/admin' : '/account');
};
forms.login = async (f, d) => afterAuth((await api('/auth/login', { method: 'POST', body: { email: d.email, password: d.password } })).user, d.next);
forms.register = async (f, d) => afterAuth((await api('/auth/register', { method: 'POST', body: d })).user, '');
actions.logout = async () => {
  await api('/auth/logout', { method: 'POST' }); store.user = null; store.cart = []; store.wishlist = new Set();
  renderChrome(); toast('You have been signed out'); location.hash = '#/';
};
actions.menu = () => $('.hdr').classList.toggle('open');

/* ---------------- Customer dashboard ---------------- */
export async function account() {
  const { orders } = await api('/orders'), u = store.user;
  const spent = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  return `<div class="wrap section"><div class="sec-head"><span class="eyebrow">Dashboard</span><h2>Welcome, <em>${esc(u.name.split(' ')[0])}</em></h2></div>
  <div class="stats"><div class="stat"><span>Orders</span><b>${orders.length}</b></div><div class="stat"><span>Total spent</span><b>${money(spent)}</b></div><div class="stat"><span>Wishlist</span><b>${store.wishlist.size}</b></div><div class="stat"><span>Cart items</span><b>${store.cart.length}</b></div></div>
  <div class="split"><div><h3 style="margin-bottom:14px">Order history</h3>${orders.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Date</th><th>Vehicles</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${orders.map((o) => `<tr><td><b>${esc(o.order_number)}</b></td><td>${date(o.created_at)}</td><td>${o.items.map((i) => esc(i.car_name) + ' ×' + i.quantity).join('<br>')}</td><td>${money(o.total)}</td><td>${statusBadge(o.status)}</td><td><a class="btn ghost sm" href="#/orders/${o.id}">View</a></td></tr>`).join('')}</tbody></table></div>` : emptyState('No orders yet', 'Your orders will appear here.', '<a class="btn" href="#/cars">Browse collection</a>')}</div>
  <form class="panel" data-form="profile"><h3 style="margin-bottom:16px">Profile &amp; security</h3>
    <div class="field"><label>Name</label><input name="name" required value="${esc(u.name)}" maxlength="100"></div><div class="field"><label>Email</label><input value="${esc(u.email)}" disabled></div><div class="field"><label>Phone</label><input name="phone" value="${esc(u.phone || '')}" maxlength="30"></div>
    <div class="field"><label>Current password</label><input name="currentPassword" type="password" autocomplete="current-password"></div><div class="field"><label>New password</label><input name="newPassword" type="password" autocomplete="new-password"></div>
    <div class="form-error" data-error></div><button class="btn block" type="submit">Save changes</button></form></div></div>`;
}
forms.profile = async (f, d) => {
  if (!d.newPassword) { delete d.newPassword; delete d.currentPassword; }
  store.user = { ...store.user, ...(await api('/auth/profile', { method: 'PUT', body: d })).user };
  renderChrome(); toast('Profile updated'); f.querySelectorAll('[type=password]').forEach((i) => (i.value = ''));
};

export async function orderDetail(ctx) {
  const { order: o } = await api('/orders/' + ctx.params[0]);
  return `<div class="wrap section">${ctx.query.placed ? '<div class="notice">Thank you — your order has been placed. Our team will confirm it and contact you with next steps.</div>' : ''}
  <div class="sec-head row between"><div><span class="eyebrow">Order</span><h2>${esc(o.order_number)}</h2><p>${date(o.created_at)} · ${statusBadge(o.status)}</p></div><a class="btn ghost" href="#/account">← Dashboard</a></div>
  <div class="split"><div class="table-wrap"><table><thead><tr><th>Vehicle</th><th>Unit price</th><th>Qty</th><th>Subtotal</th></tr></thead><tbody>${o.items.map((i) => `<tr><td><div class="row"><span class="thumb-sm">${media(i.image, i.car_name)}</span><b>${esc(i.car_name)}</b></div></td><td>${money(i.unit_price)}</td><td>${i.quantity}</td><td>${money(i.unit_price * i.quantity)}</td></tr>`).join('')}</tbody></table></div>
  <aside class="panel"><h3 style="margin-bottom:12px">Summary</h3><div class="sumrow total" style="border:0;margin:0;padding-top:0"><span>Total</span><span>${money(o.total)}</span></div>
    <p class="muted" style="margin-top:14px"><b style="color:var(--text)">Payment</b><br>${PAYMENT[o.payment_method]}</p>
    <p class="muted" style="margin-top:14px"><b style="color:var(--text)">Delivery</b><br>${esc(o.ship_name)}<br>${esc(o.ship_address)}<br>${esc(o.ship_city)}, ${esc(o.ship_postal)}<br>${esc(o.ship_country)}<br>${esc(o.ship_phone)}</p>
    ${o.notes ? `<p class="muted" style="margin-top:14px"><b style="color:var(--text)">Notes</b><br>${esc(o.notes)}</p>` : ''}
    ${o.status === 'pending' ? `<button class="btn danger block" style="margin-top:18px" data-action="cancel-order" data-id="${o.id}">Cancel order</button>` : ''}</aside></div></div>`;
}
actions['cancel-order'] = async (el) => {
  if (!confirm('Cancel this order? The vehicle will be released back to stock.')) return;
  await api(`/orders/${el.dataset.id}/cancel`, { method: 'PUT' }); toast('Order cancelled'); rerender();
};

export const notFound = () => `<div class="wrap section">${emptyState('Page not found', 'The page you are looking for does not exist.', '<a class="btn" href="#/">Back to home</a>')}</div>`;
