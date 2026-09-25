const express = require("express");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireAdmin);

// ---- Products ----

router.get("/products", (req, res) => {
  res.json({ products: db.prepare("SELECT * FROM products").all() });
});

router.post("/products", (req, res) => {
  const p = req.body;
  if (!p.id || !p.name || !p.category || p.price == null || p.mrp == null) {
    return res.status(400).json({ error: "id, name, category, price, and mrp are required." });
  }
  db.prepare(
    `INSERT OR REPLACE INTO products
     (id, name, category, shape, frame_material, gender, price, mrp, color, rating, reviews, image, overlay_image, power_type, description, sizes, color_variants, stock_status)
     VALUES (@id, @name, @category, @shape, @frame_material, @gender, @price, @mrp, @color, @rating, @reviews, @image, @overlay_image, @power_type, @description, @sizes, @color_variants, @stock_status)`
  ).run({
    shape: null, frame_material: null, gender: null, color: null, rating: 0, reviews: 0,
    image: null, overlay_image: null, power_type: null, description: null,
    sizes: "S,M,L", stock_status: "in_stock",
    ...p,
    stock_status: p.stockStatus || p.stock_status || "in_stock",
    color_variants: p.colorVariants ? JSON.stringify(p.colorVariants) : null
  });
  res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(p.id) });
});

router.patch("/products/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  const merged = {
    ...existing,
    ...req.body,
    id: req.params.id,
    stock_status: req.body.stockStatus || req.body.stock_status || existing.stock_status,
    color_variants: req.body.colorVariants ? JSON.stringify(req.body.colorVariants) : existing.color_variants
  };
  db.prepare(
    `UPDATE products SET name=@name, category=@category, shape=@shape, frame_material=@frame_material,
     gender=@gender, price=@price, mrp=@mrp, color=@color, image=@image, overlay_image=@overlay_image,
     power_type=@power_type, description=@description, sizes=@sizes, color_variants=@color_variants,
     stock_status=@stock_status WHERE id=@id`
  ).run(merged);
  res.json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) });
});

router.delete("/products/:id", (req, res) => {
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Product not found." });
  res.json({ success: true });
});

// ---- Orders ----

router.get("/orders", (req, res) => {
  const orders = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  const withItems = orders.map((o) => ({
    ...o,
    items: db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id)
  }));
  res.json({ orders: withItems });
});

const VALID_STATUSES = ["placed", "confirmed", "shipped", "out_for_delivery", "delivered", "cancelled"];

router.patch("/orders/:id/status", (req, res) => {
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
  }
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found." });
  res.json({ order: db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id) });
});

// ---- Returns/Exchanges ----

router.get("/returns", (req, res) => {
  res.json({ returns: db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all() });
});

const VALID_RETURN_STATUSES = ["requested", "approved", "rejected", "picked_up", "refunded", "completed"];

router.patch("/returns/:id/status", (req, res) => {
  const { status } = req.body;
  if (!VALID_RETURN_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_RETURN_STATUSES.join(", ")}` });
  }
  const result = db.prepare("UPDATE returns SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Return request not found." });
  res.json({ return: db.prepare("SELECT * FROM returns WHERE id = ?").get(req.params.id) });
});

// ---- Coupons ----

router.get("/coupons", (req, res) => {
  res.json({ coupons: db.prepare("SELECT * FROM coupons").all() });
});

router.post("/coupons", (req, res) => {
  const { code, discountType, discountValue, minOrder = 0, active = 1, expiresAt = null } = req.body;
  if (!code || !discountType || discountValue == null) {
    return res.status(400).json({ error: "code, discountType, and discountValue are required." });
  }
  db.prepare(
    "INSERT OR REPLACE INTO coupons (code, discount_type, discount_value, min_order, active, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(code.toUpperCase(), discountType, discountValue, minOrder, active ? 1 : 0, expiresAt);
  res.status(201).json({ coupon: db.prepare("SELECT * FROM coupons WHERE code = ?").get(code.toUpperCase()) });
});

router.delete("/coupons/:code", (req, res) => {
  const result = db.prepare("DELETE FROM coupons WHERE code = ?").run(req.params.code.toUpperCase());
  if (result.changes === 0) return res.status(404).json({ error: "Coupon not found." });
  res.json({ success: true });
});

// ---- Memberships ----

router.get("/memberships", (req, res) => {
  const rows = db
    .prepare(
      `SELECT um.*, u.name as user_name, u.email as user_email, mp.name as plan_name
       FROM user_memberships um
       JOIN users u ON u.id = um.user_id
       JOIN membership_plans mp ON mp.id = um.plan_id
       ORDER BY um.purchased_at DESC`
    )
    .all();
  res.json({ memberships: rows });
});

// ---- Home Eye Test bookings ----

const BOOKING_STATUSES = ["requested", "confirmed", "completed", "cancelled"];

router.get("/home-test", (req, res) => {
  const rows = db
    .prepare(
      `SELECT htb.*, u.email as user_email
       FROM home_test_bookings htb
       JOIN users u ON u.id = htb.user_id
       ORDER BY htb.created_at DESC`
    )
    .all();
  res.json({ bookings: rows });
});

router.patch("/home-test/:id/status", (req, res) => {
  const { status } = req.body;
  if (!BOOKING_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${BOOKING_STATUSES.join(", ")}` });
  }
  const result = db.prepare("UPDATE home_test_bookings SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Booking not found." });
  res.json({ booking: db.prepare("SELECT * FROM home_test_bookings WHERE id = ?").get(req.params.id) });
});

// ---- Insurance claims ----

const CLAIM_STATUSES = ["submitted", "approved", "rejected", "settled"];

router.get("/insurance-claims", (req, res) => {
  const rows = db
    .prepare(
      `SELECT ic.*, u.email as user_email
       FROM insurance_claims ic
       JOIN users u ON u.id = ic.user_id
       ORDER BY ic.created_at DESC`
    )
    .all();
  res.json({ claims: rows });
});

router.patch("/insurance-claims/:id/status", (req, res) => {
  const { status } = req.body;
  if (!CLAIM_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${CLAIM_STATUSES.join(", ")}` });
  }
  const result = db.prepare("UPDATE insurance_claims SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Claim not found." });
  res.json({ claim: db.prepare("SELECT * FROM insurance_claims WHERE id = ?").get(req.params.id) });
});

// ---- Warranty claims ----

router.get("/warranty-claims", (req, res) => {
  const rows = db
    .prepare(
      `SELECT wc.*, u.email as user_email
       FROM warranty_claims wc
       JOIN users u ON u.id = wc.user_id
       ORDER BY wc.created_at DESC`
    )
    .all();
  res.json({ claims: rows });
});

router.patch("/warranty-claims/:id/status", (req, res) => {
  const { status } = req.body;
  if (!CLAIM_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${CLAIM_STATUSES.join(", ")}` });
  }
  const result = db.prepare("UPDATE warranty_claims SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Claim not found." });
  res.json({ claim: db.prepare("SELECT * FROM warranty_claims WHERE id = ?").get(req.params.id) });
});

module.exports = router;
