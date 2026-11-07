const bcrypt = require('bcryptjs');

// Specs format per line: Group | Label | Value
const CARS = [
  { brand: 'koenigsegg', name: 'Jesko Absolut', category: 'Hypercar', year: 2025, price: 3000000, stock: 2, hp: 1600, top: 531, zero: 2.5, featured: 1,
    desc: 'The Jesko Absolut is Koenigsegg\'s ultimate expression of low-drag, high-speed engineering: a sleek, drag-optimised hypercar designed to reach a theoretical top speed beyond 300 mph. Powered by a 5.0-litre twin-turbo flat-plane V8 and the 9-speed Light Speed Transmission, it pairs astonishing power with a carbon-fibre monocoque and the removal of rear wing and aggressive aero in pursuit of the lowest possible drag.',
    specs: `Powertrain | Engine | 5.0L twin-turbo flat-plane crank V8
Powertrain | Power | 1,600 hp on E85 / 1,280 hp on 95 RON petrol
Powertrain | Torque | 1,500 Nm @ 5,100 rpm
Powertrain | Redline | 8,500 rpm
Powertrain | Transmission | 9-speed Light Speed Transmission (LST)
Powertrain | Drivetrain | Rear-wheel drive
Performance | Top speed | 531 km/h (330 mph) claimed theoretical
Performance | 0-100 km/h | 2.5 s (claimed)
Performance | Drag coefficient | 0.278 Cd
Chassis | Construction | Carbon-fibre monocoque
Chassis | Dry weight | 1,420 kg
Chassis | Wheels | Carbon-fibre, Michelin Pilot Sport Cup 2
Edition | Production | Limited series, hand-built in Ängelholm, Sweden` },
  { brand: 'bmw', name: 'M5 Competition', category: 'Sedan', year: 2025, price: 125000, stock: 6, hp: 717, top: 305, zero: 3.5, featured: 1,
    desc: 'The all-new M5 introduces M Hybrid drive: a 4.4-litre twin-turbo V8 working with an electric motor for 717 hp of combined output. It is a full-size executive sedan with supercar acceleration, adaptive M suspension and M xDrive with a selectable rear-drive mode.',
    specs: `Powertrain | Engine | 4.4L twin-turbo V8 + electric motor (M Hybrid)
Powertrain | Power | 717 hp combined
Powertrain | Torque | 1,000 Nm combined
Powertrain | Transmission | 8-speed M Steptronic
Powertrain | Drivetrain | M xDrive with 2WD mode
Performance | 0-100 km/h | 3.5 s
Performance | Top speed | 305 km/h (with M Driver's Package)
Chassis | Kerb weight | approx. 2,435 kg
Chassis | Seats | 5` },
  { brand: 'bmw', name: 'M4 CSL', category: 'Coupe', year: 2023, price: 140000, stock: 2, hp: 543, top: 307, zero: 3.7, featured: 1,
    desc: 'Born from the racetrack, the M4 CSL is a lightweight, rear-wheel-drive limited edition that returns BMW M to its Coupé Sport Leichtbau roots. Weight savings, a retuned 3.0-litre inline-six and track-focused suspension deliver razor-sharp driver engagement.',
    specs: `Powertrain | Engine | 3.0L twin-turbo inline-6 (S58)
Powertrain | Power | 543 hp
Powertrain | Torque | 650 Nm
Powertrain | Transmission | 8-speed M Steptronic
Powertrain | Drivetrain | Rear-wheel drive
Performance | 0-100 km/h | 3.7 s
Performance | Top speed | 307 km/h
Chassis | Kerb weight | approx. 1,625 kg
Edition | Production | 1,000 units worldwide` },
  { brand: 'bmw', name: 'M3 Competition xDrive', category: 'Sedan', year: 2025, price: 89000, stock: 5, hp: 503, top: 290, zero: 3.4, featured: 0,
    desc: 'The benchmark sports sedan. A 3.0-litre twin-turbo inline-six, M xDrive all-wheel drive and a track-ready chassis make the M3 Competition an everyday performance car with genuine motorsport DNA.',
    specs: `Powertrain | Engine | 3.0L twin-turbo inline-6 (S58)
Powertrain | Power | 503 hp
Powertrain | Torque | 650 Nm
Powertrain | Transmission | 8-speed M Steptronic
Powertrain | Drivetrain | M xDrive all-wheel drive
Performance | 0-100 km/h | 3.4 s
Performance | Top speed | 290 km/h (with M Driver's Package)
Chassis | Seats | 5` },
  { brand: 'bmw', name: 'XM', category: 'SUV', year: 2024, price: 159000, stock: 3, hp: 644, top: 250, zero: 4.1, featured: 0,
    desc: 'The first standalone M car since the M1, the XM is a bold plug-in-hybrid luxury performance SUV combining a 4.4-litre V8 with an electric motor, an opulent lounge-like cabin and unmistakable road presence.',
    specs: `Powertrain | Engine | 4.4L twin-turbo V8 + electric motor (PHEV)
Powertrain | Power | 644 hp combined
Powertrain | Torque | 800 Nm combined
Powertrain | Transmission | 8-speed M Steptronic
Powertrain | Drivetrain | M xDrive all-wheel drive
Performance | 0-100 km/h | 4.1 s
Performance | Top speed | 250 km/h
Chassis | Seats | 5` },
  { brand: 'bmw', name: 'i7 M70 xDrive', category: 'Electric', year: 2024, price: 168000, stock: 4, hp: 650, top: 250, zero: 3.7, featured: 1,
    desc: 'The first fully electric BMW M Performance luxury sedan. Dual motors deliver 650 hp, while the Executive Lounge cabin, Theatre Screen and Executive Drive Pro suspension set a new bar for electric flagship refinement.',
    specs: `Powertrain | Motors | Dual electric motors (front + rear)
Powertrain | Power | 650 hp
Powertrain | Torque | 1,100 Nm
Powertrain | Drivetrain | xDrive all-wheel drive
Performance | 0-100 km/h | 3.7 s
Performance | Top speed | 250 km/h (limited)
Chassis | Seats | 5` },
];

module.exports = async function seed(pool) {
  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM brands');
  if (n === 0) {
    await pool.query('INSERT INTO brands (name,slug,country,tagline) VALUES ?', [[
      ['Koenigsegg', 'koenigsegg', 'Sweden', 'Hand-built hypercars that rewrite the limits of speed.'],
      ['BMW', 'bmw', 'Germany', 'The ultimate driving machine, perfected by M.'],
    ]]);
    const [brands] = await pool.query('SELECT id,slug FROM brands');
    const bid = Object.fromEntries(brands.map((b) => [b.slug, b.id]));
    for (const c of CARS) {
      const slug = `${c.brand}-${c.name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
      const [r] = await pool.query('INSERT INTO cars SET ?', [{ brand_id: bid[c.brand], name: c.name, slug, category: c.category, year: c.year, price: c.price, stock: c.stock, horsepower: c.hp, top_speed_kmh: c.top, zero_to_100: c.zero, description: c.desc, featured: c.featured }]);
      const specs = c.specs.split('\n').map((l, i) => { const p = l.split('|').map((s) => s.trim()); return [r.insertId, p[0], p[1], p.slice(2).join('|').trim(), i]; });
      await pool.query('INSERT INTO car_specs (car_id,spec_group,spec_key,spec_value,sort_order) VALUES ?', [specs]);
    }
    console.log('🌱 Seeded brands and vehicle catalogue (upload photos from the admin panel).');
  }

  const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
  if (email && process.env.ADMIN_PASSWORD) {
    const [[a]] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (!a) {
      await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)', [process.env.ADMIN_NAME || 'Administrator', email, await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), 'admin']);
      console.log(`🔐 Admin account created: ${email}`);
    }
  }
};
