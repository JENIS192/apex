// Reusable UI components (functions returning HTML strings).
import { $, esc, money, store, parseHash } from './lib.js';

export const carArt = () => `<svg class="car-art" viewBox="0 0 420 130" aria-hidden="true"><defs><linearGradient id="cg" x1="0" x2="1"><stop offset="0" stop-color="#0b7f9c"/><stop offset="1" stop-color="#13c4d9"/></linearGradient></defs><path d="M12 92 46 84 118 64Q158 40 214 38Q272 38 312 60L384 74 408 88V100H12Z" fill="none" stroke="url(#cg)" stroke-width="2.5"/><path d="M130 66Q165 48 214 48Q258 48 292 64Z" fill="none" stroke="url(#cg)" stroke-opacity=".6" stroke-width="2"/><circle cx="104" cy="100" r="19" fill="#04070a" stroke="url(#cg)" stroke-width="2.5"/><circle cx="318" cy="100" r="19" fill="#04070a" stroke="url(#cg)" stroke-width="2.5"/></svg>`;
export const media = (src, alt, cls = '') => (src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy">` : `<div class="art-wrap ${cls}" role="img" aria-label="${esc(alt)}">${carArt()}</div>`);
export const heart = (id) => `<button class="icon-btn heart ${store.wishlist.has(id) ? 'on' : ''}" data-action="wish" data-id="${id}" aria-label="Toggle wishlist">♥</button>`;
export const statusBadge = (s) => `<span class="status st-${esc(s)}">${esc(s)}</span>`;
export const PAYMENT = { wire_transfer: 'Bank wire transfer', dealer_financing: 'Dealer financing' };
export const stockTag = (n) => (n <= 0 ? '<span class="tag out">Sold out</span>' : n <= 2 ? `<span class="tag warn">Only ${n} left</span>` : '<span class="tag ok">Available</span>');

export function carCard(c, i = 0) {
  const href = `#/cars/${esc(c.slug)}`;
  return `<article class="card reveal" style="--i:${i % 6}">
    <a class="thumb" href="${href}">${media(c.image, c.name)}</a>
    <div class="tags"><span class="tag">${esc(c.category)}</span>${stockTag(c.stock)}</div>${heart(c.id)}
    <div class="body"><div class="brand">${esc(c.brand_name)}</div><h3><a href="${href}">${esc(c.name)}</a></h3>
      <div class="mini"><div><b>${c.horsepower ?? '—'}</b>HP</div><div><b>${c.zero_to_100 ?? '—'}s</b>0–100</div><div><b>${c.top_speed_kmh ?? '—'}</b>km/h</div></div>
      <div class="foot"><span class="price">${money(c.price)}</span><button class="btn sm" data-action="add-cart" data-id="${c.id}" ${c.stock <= 0 ? 'disabled' : ''}>Add to cart</button></div>
    </div></article>`;
}

export const emptyState = (title, text, cta = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${cta ? `<p style="margin-top:18px">${cta}</p>` : ''}</div>`;
const logo = '<svg viewBox="0 0 64 64"><path d="M32 8 54 52H43L32 30 21 52H10Z" fill="#13c4d9"/><path d="M32 30 38 42H26Z" fill="#04070a"/></svg>';
const ICON = {
  cart: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 7H6"/></svg>',
  user: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
};

export function markActive() {
  const cur = location.hash.slice(1) || '/';
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href').slice(1) === cur));
}

export function renderChrome() {
  const u = store.user, n = store.cart.reduce((s, i) => s + i.quantity, 0), w = store.wishlist.size;
  $('#header').innerHTML = `<header class="hdr"><div class="wrap">
    <a class="logo" href="#/">${logo}APEX NOIR</a>
    <nav class="nav"><a href="#/">Home</a><a href="#/cars">Collection</a><a href="#/cars?brand=koenigsegg">Koenigsegg</a><a href="#/cars?brand=bmw">BMW</a></nav>
    <form class="hsearch" data-form="hsearch"><input name="q" placeholder="Search vehicles…" aria-label="Search vehicles" maxlength="80"></form>
    <div class="hactions">
      <a class="icon-btn relw" href="#/wishlist" aria-label="Wishlist">♥${w ? `<span class="badge">${w}</span>` : ''}</a>
      <a class="icon-btn relw" href="#/cart" aria-label="Cart">${ICON.cart}${n ? `<span class="badge">${n}</span>` : ''}</a>
      ${u ? `<div class="account"><button class="icon-btn" aria-label="Account">${ICON.user}</button><div class="account-menu">
          <div class="muted" style="padding:8px 12px;font-size:.85rem">${esc(u.name)}</div>
          <a href="#/account">My dashboard</a><a href="#/wishlist">Wishlist</a>${u.role === 'admin' ? '<a href="#/admin">Admin panel</a>' : ''}
          <button data-action="logout">Sign out</button></div></div>`
        : '<a class="btn ghost sm" href="#/login">Sign in</a><a class="btn sm" href="#/register">Join</a>'}
      <button class="icon-btn menu-btn" data-action="menu" aria-label="Menu">☰</button>
    </div></div></header>`;
  $('#footer').innerHTML = `<footer class="ftr"><div class="wrap"><div class="ftr-grid">
    <div><a class="logo" href="#/">${logo}APEX NOIR</a><p class="muted" style="margin-top:14px;max-width:320px">A private boutique for the Koenigsegg Jesko Absolut and the finest BMW M and electric flagships.</p></div>
    <div><h4>Collection</h4><a href="#/cars">All vehicles</a><a href="#/cars?brand=koenigsegg">Koenigsegg</a><a href="#/cars?brand=bmw">BMW</a><a href="#/cars?category=Electric">Electric</a></div>
    <div><h4>Account</h4><a href="#/account">Dashboard</a><a href="#/wishlist">Wishlist</a><a href="#/cart">Cart</a><a href="#/login">Sign in</a></div>
    <div><h4>Purchasing</h4><a href="#/checkout">Checkout</a><a href="#/account">Order tracking</a><span class="muted" style="font-size:.9rem;display:block;padding:4px 0">Bank wire &amp; dealer financing</span></div>
  </div><div class="copy">© ${new Date().getFullYear()} Apex Noir Motors. Brand names and marks belong to their respective owners.</div></div></footer>`;
  markActive();
}

export const crumbPath = () => parseHash().path;
