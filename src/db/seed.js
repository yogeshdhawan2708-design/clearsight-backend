const db = require("./index");
const bcrypt = require("bcryptjs");

const products = [
  {
    id: "eg-001", name: "Aldous Round", category: "Eyeglasses", shape: "Round",
    frame_material: "Acetate", gender: "Unisex", price: 1499, mrp: 2999,
    color: "Tortoise Brown", rating: 4.4, reviews: 812,
    image: "https://images.unsplash.com/photo-1577803645773-f96470509666?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1577803645773-f96470509666?w=600&h=600&fit=crop",
    power_type: "single-vision",
    description: "A classic round acetate frame with a warm tortoise finish. Lightweight build suited for all-day wear."
  },
  {
    id: "eg-002", name: "Crestline Rectangle", category: "Eyeglasses", shape: "Rectangle",
    frame_material: "Metal", gender: "Men", price: 1799, mrp: 3499,
    color: "Gunmetal", rating: 4.2, reviews: 543,
    image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600&h=600&fit=crop",
    power_type: "single-vision",
    description: "Slim rectangular metal frame with spring hinges for a secure, comfortable fit."
  },
  {
    id: "eg-003", name: "Marlowe Cat-Eye", category: "Eyeglasses", shape: "Cat Eye",
    frame_material: "Acetate", gender: "Women", price: 1999, mrp: 3999,
    color: "Blush Pink", rating: 4.6, reviews: 1204,
    image: "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1508296695146-257a814070b4?w=600&h=600&fit=crop",
    power_type: "single-vision",
    description: "A retro-inspired cat-eye silhouette in a soft blush finish, designed for a face-flattering lift."
  },
  {
    id: "sg-001", name: "Solstice Aviator", category: "Sunglasses", shape: "Aviator",
    frame_material: "Metal", gender: "Unisex", price: 1299, mrp: 2499,
    color: "Gold / Green", rating: 4.5, reviews: 987,
    image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&h=600&fit=crop",
    power_type: "sunglasses",
    description: "UV400-protected aviator with polarized green lenses. A timeless everyday sunglass."
  },
  {
    id: "sg-002", name: "Bourbon Square", category: "Sunglasses", shape: "Square",
    frame_material: "Acetate", gender: "Men", price: 1599, mrp: 2999,
    color: "Matte Black", rating: 4.3, reviews: 421,
    image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=600&fit=crop",
    power_type: "sunglasses",
    description: "Bold matte black square sunglasses with scratch-resistant polarized lenses."
  },
  {
    id: "kd-001", name: "Tumble Flex Junior", category: "Kids", shape: "Round",
    frame_material: "TR90 Flexible", gender: "Unisex", price: 999, mrp: 1799,
    color: "Sky Blue", rating: 4.7, reviews: 265,
    image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&h=600&fit=crop",
    power_type: "single-vision",
    description: "Bendable, near-unbreakable frame built for active kids. Soft-touch temple tips."
  },
  {
    id: "cl-001", name: "ClearView Daily Lenses (30 pack)", category: "Contact Lenses", shape: "-",
    frame_material: "-", gender: "Unisex", price: 899, mrp: 1299,
    color: "Clear", rating: 4.5, reviews: 678,
    image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600&h=600&fit=crop",
    overlay_image: null,
    power_type: "contact-lens",
    description: "Daily disposable contact lenses with a high moisture retention formula."
  },
  {
    id: "eg-004", name: "Havelock Wayframe", category: "Eyeglasses", shape: "Wayframe",
    frame_material: "Acetate", gender: "Men", price: 1699, mrp: 3299,
    color: "Classic Black", rating: 4.1, reviews: 356,
    image: "https://images.unsplash.com/photo-1584036561584-dd9e0cad0a68?w=600&h=600&fit=crop",
    overlay_image: "https://images.unsplash.com/photo-1584036561584-dd9e0cad0a68?w=600&h=600&fit=crop",
    power_type: "single-vision",
    description: "Bold wayframe silhouette with a durable acetate build. A versatile daily-wear pick."
  }
];

const insert = db.prepare(`
  INSERT OR REPLACE INTO products
  (id, name, category, shape, frame_material, gender, price, mrp, color, rating, reviews, image, overlay_image, power_type, description)
  VALUES (@id, @name, @category, @shape, @frame_material, @gender, @price, @mrp, @color, @rating, @reviews, @image, @overlay_image, @power_type, @description)
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) insert.run(row);
});

insertMany(products);
console.log(`Seeded ${products.length} products.`);

const lensOptions = [
  { id: "lens-standard", name: "Standard Single Vision", type: "single-vision", price: 0, description: "Basic clear lenses, included with frame price." },
  { id: "lens-bluecut", name: "Blue Light Block", type: "single-vision", price: 499, description: "Filters blue-violet light from screens, reduces digital eye strain." },
  { id: "lens-antiglare", name: "Anti-Glare / Anti-Reflective", type: "single-vision", price: 399, description: "Cuts down glare and reflections for night driving and screen use." },
  { id: "lens-thin", name: "Thin & Light (1.6 index)", type: "single-vision", price: 899, description: "Thinner, lighter lenses for higher power prescriptions." },
  { id: "lens-progressive", name: "Progressive (No-Line Bifocal)", type: "progressive", price: 2499, description: "Seamless near, intermediate, and distance vision in one lens." },
  { id: "lens-sunglass-polarized", name: "Polarized Sun Lens", type: "sunglasses", price: 0, description: "Polarized coating included with sunglass frames." }
];
const insertLens = db.prepare(`INSERT OR REPLACE INTO lens_options (id, name, type, price, description) VALUES (@id, @name, @type, @price, @description)`);
db.transaction((rows) => { for (const r of rows) insertLens.run(r); })(lensOptions);
console.log(`Seeded ${lensOptions.length} lens options.`);

const coupons = [
  { code: "WELCOME200", discount_type: "flat", discount_value: 200, min_order: 999, active: 1, expires_at: null },
  { code: "SAVE15", discount_type: "percent", discount_value: 15, min_order: 1500, active: 1, expires_at: null },
  { code: "KIDS100", discount_type: "flat", discount_value: 100, min_order: 500, active: 1, expires_at: null }
];
const insertCoupon = db.prepare(`INSERT OR REPLACE INTO coupons (code, discount_type, discount_value, min_order, active, expires_at) VALUES (@code, @discount_type, @discount_value, @min_order, @active, @expires_at)`);
db.transaction((rows) => { for (const r of rows) insertCoupon.run(r); })(coupons);
console.log(`Seeded ${coupons.length} coupons.`);

const stores = [
  { name: "Clearsight Connaught Place", city: "Delhi", address: "Shop 14, Inner Circle, Connaught Place, New Delhi", phone: "011-4000-1234", hours: "10:00 AM - 9:00 PM", lat: 28.6315, lng: 77.2167 },
  { name: "Clearsight Cyber Hub", city: "Gurgaon", address: "Ground Floor, Cyber Hub, DLF Phase 2, Gurgaon", phone: "0124-400-5678", hours: "11:00 AM - 10:00 PM", lat: 28.4949, lng: 77.0890 },
  { name: "Clearsight Indiranagar", city: "Bengaluru", address: "100 Feet Road, Indiranagar, Bengaluru", phone: "080-4000-9012", hours: "10:30 AM - 9:30 PM", lat: 12.9716, lng: 77.6412 }
];
const insertStore = db.prepare(`INSERT INTO stores (name, city, address, phone, hours, lat, lng) VALUES (@name, @city, @address, @phone, @hours, @lat, @lng)`);
db.transaction((rows) => { for (const r of rows) insertStore.run(r); })(stores);
console.log(`Seeded ${stores.length} stores.`);

const adminEmail = "admin@clearsight.test";
const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync("Admin@123", 10);
  db.prepare("INSERT INTO users (name, email, password_hash, is_admin) VALUES (?, ?, ?, 1)").run("Store Admin", adminEmail, hash);
  console.log(`Seeded admin user: ${adminEmail} / Admin@123`);
} else {
  db.prepare("UPDATE users SET is_admin = 1 WHERE email = ?").run(adminEmail);
  console.log(`Admin user already exists: ${adminEmail}`);
}
