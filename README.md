# APEX NOIR — Koenigsegg Jesko Absolut & BMW luxury car store

Full-stack e-commerce application · **Node.js + Express (port 5000)** · **MySQL** · vanilla JS component frontend · black / dark-cyan theme.

```
apex-noir/
├── backend/            Express API (port 5000) + MySQL schema + seed + uploads
│   ├── server.js       app entry, health check, security middleware
│   ├── sql/schema.sql  tables & relationships
│   ├── src/            db.js, auth.js, utils.js, seed.js, routes/{auth,cars,shop,admin}.js
│   └── .env            backend configuration
├── frontend/           Storefront + admin SPA
│   ├── server.js       zero-dependency static server + reverse proxy (/api, /uploads → backend)
│   ├── public/         index.html, css/, js/ (lib, components, pages, admin, app)
│   └── .env            frontend configuration
└── deploy/             nginx.conf (web tier), ecosystem.config.js (PM2, app tier)
```

## Run locally

Requirements: Node.js ≥ 20.6, MySQL 8 (or MariaDB 10.6+).

```bash
# 1. Backend
cd backend
# edit .env  → set DB_USER / DB_PASSWORD, a real JWT_SECRET and ADMIN_* credentials
npm install
npm start          # creates the database + tables, seeds the catalogue and the admin user
#   ✅ MySQL connected successfully → localhost:3306/apex_noir
#   🚀 Apex Noir API listening on port 5000

# 2. Frontend (second terminal)
cd frontend
npm start          # http://localhost:3000
```

Health check: `curl http://localhost:5000/api/hell/health` (also reachable through the frontend at `/api/hell/health`).

Sign in to the admin panel with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`, then open **Admin panel → Vehicles → Edit** to upload photos for each car (JPG/PNG/WEBP/AVIF). Until photos are uploaded, cards show a styled placeholder illustration. Photos are not bundled because the Koenigsegg and BMW imagery is copyrighted — upload images you are licensed to use.

## How frontend ↔ backend works without CORS

The browser only ever talks to the **frontend origin**. The frontend server (locally) or Nginx (AWS) forwards `/api/*` and `/uploads/*` to the backend, so every request is same-origin. No CORS middleware or headers exist anywhere. Auth uses an `HttpOnly; SameSite=Strict` JWT cookie, which also provides CSRF protection.

## Features

* **Storefront:** animated home page, collection with debounced search, brand / category / price / stock filters, sorting and pagination, detail pages with image gallery and grouped specification tables, related cars.
* **Accounts:** registration, login/logout, profile + password change, wishlist, persistent cart, checkout (transactional, row-locked stock check), order history, order detail and cancel (pending only, stock restored).
* **Admin panel:** dashboard (revenue, orders, status breakdown, low stock), vehicle CRUD with multi-image upload / primary / delete, inventory editor, order management (status workflow, delivery & payment details), customer list.
* **Security:** bcrypt (cost 12), JWT in HttpOnly cookie, role guard on all `/api/admin/*`, parameterised SQL everywhere, input validation, rate limiting (global + login/register), Helmet, strict CSP on the frontend, MIME-whitelisted uploads with random filenames and size limits, HTML-escaped rendering.
* **Payments:** checkout supports *bank wire* and *dealer financing*. No card data is collected: orders are created as `pending` and an admin confirms them and issues payment instructions — appropriate for six- and seven-figure vehicles. Plug a payment provider into `POST /api/orders` if you need online card capture.

## API summary

| Area | Endpoints |
|---|---|
| Health | `GET /api/hell/health` |
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `PUT /api/auth/profile` |
| Catalogue | `GET /api/brands` · `GET /api/cars?q&brand&category&minPrice&maxPrice&sort&inStock&page&limit` · `GET /api/cars/:idOrSlug` |
| Wishlist | `GET /api/wishlist` · `POST/DELETE /api/wishlist/:carId` |
| Cart | `GET/POST /api/cart` · `PUT/DELETE /api/cart/:carId` |
| Orders | `POST /api/orders` · `GET /api/orders` · `GET /api/orders/:id` · `PUT /api/orders/:id/cancel` |
| Admin | `GET /api/admin/stats` · `GET/POST /api/admin/cars` · `PUT/DELETE /api/admin/cars/:id` · `PUT /api/admin/cars/:id/stock` · `POST /api/admin/cars/:id/images` (multipart `images`) · `PUT /api/admin/images/:id/primary` · `DELETE /api/admin/images/:id` · `GET /api/admin/orders` · `PUT /api/admin/orders/:id/status` · `GET /api/admin/users` |

## Database (MySQL, InnoDB, utf8mb4)

`users` ─< `orders` ─< `order_items` >─ `cars` >─ `brands` · `cars` ─< `car_images`, `car_specs` · `users` ─< `wishlist_items` >─ `cars` · `users` ─< `cart_items` >─ `cars`.
Foreign keys cascade where children are meaningless without the parent; order history is preserved (`order_items.car_name` snapshot, `car_id` → `SET NULL`).

## AWS 3-tier deployment

```
Internet ─► Public ALB (HTTPS, ACM cert) ─► WEB tier: Nginx on EC2 ASG (public/private subnets)
                                              ├─ serves frontend/public
                                              └─ /api, /uploads ─► Internal ALB ─► APP tier: Node/Express on EC2 ASG (private subnets, port 5000)
                                                                                      └─► DB tier: RDS MySQL 8 (private subnets, Multi-AZ)
```

1. **Network:** VPC with 2+ AZs; public subnets (public ALB, NAT), private app subnets, private DB subnets.
2. **Security groups:** Public ALB: 80/443 from internet → Web SG: 80 from ALB → Internal ALB SG: 80 from Web SG → App SG: 5000 from Internal ALB SG → DB SG: 3306 from App SG only.
3. **DB tier:** create an RDS MySQL 8 instance in the DB subnets. Create the database user with privileges on `apex_noir` (the app creates tables on first start, or run `backend/sql/schema.sql` yourself). Keep credentials in SSM Parameter Store / Secrets Manager.
4. **App tier:** on each EC2 instance (Node 20): copy `backend/`, create `backend/.env` with
   `DB_HOST=<rds-endpoint>`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=apex_noir`, a 48-byte random `JWT_SECRET`, `COOKIE_SECURE=true`, **`TRUST_PROXY=3`** (public ALB → Nginx → internal ALB), `UPLOAD_DIR=/mnt/efs/uploads`. Then `npm ci --omit=dev && pm2 start deploy/ecosystem.config.js`. Internal ALB target group health check: **`/api/hell/health`** (HTTP 200).
5. **Uploads across instances:** mount one **Amazon EFS** file system at `/mnt/efs/uploads` on every app instance so images are shared (S3 is the alternative if you swap the multer storage engine).
6. **Web tier:** install Nginx, copy `frontend/public/*` to `/var/www/apex-noir`, install `deploy/nginx.conf` (replace `INTERNAL_APP_ALB_DNS_NAME`). Public ALB health check: `/healthz`. Terminate TLS at the public ALB with an ACM certificate.
7. **Alternative web tier:** `frontend/server.js` can run instead of Nginx — set `BACKEND_URL=http://<internal-alb-dns>` in `frontend/.env` and run it under PM2/systemd.

Rotate the seeded admin password after first login, and remove `ADMIN_PASSWORD` from the production `.env` once the account exists.
