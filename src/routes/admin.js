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
     (id, name, category, shape, frame_material, gender, price, mrp, color, rating, reviews, image, overlay_image, power_type, description)
     VALUES (@id, @name, @category, @shape, @frame_material, @gender, @price, @mrp, @color, @rating, @reviews, @image, @overlay_image, @power_type, @description)`
  ).run({
    shape: null, frame_material: null, gender: null, color: null, rating: 0, reviews: 0,
    image: null, overlay_image: null, power_type: null, description: null,
    ...p
  });
  res.status(201).json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(p.id) });
});

router.patch("/products/:id", (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found." });
  const merged = { ...existing, ...req.body, id: req.params.id };
  db.prepare(
    `UPDATE products SET name=@name, category=@category, shape=@shape, frame_material=@frame_material,
     gender=@gender, price=@price, mrp=@mrp, color=@color, image=@image, overlay_image=@overlay_image,
     power_type=@power_type, description=@description WHERE id=@id`
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

module.exports = router;
