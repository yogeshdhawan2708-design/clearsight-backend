const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function serializeProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    shape: row.shape,
    frameMaterial: row.frame_material,
    gender: row.gender,
    price: row.price,
    mrp: row.mrp,
    color: row.color,
    rating: row.rating,
    reviews: row.reviews,
    image: row.image,
    overlayImage: row.overlay_image,
    powerType: row.power_type,
    description: row.description
  };
}

function getCartForUser(userId) {
  const rows = db
    .prepare(
      `SELECT ci.id AS cart_item_id, ci.power, ci.qty, ci.lens_option_id, ci.prescription_id,
              lo.name AS lens_name, lo.price AS lens_price,
              p.*
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN lens_options lo ON lo.id = ci.lens_option_id
       WHERE ci.user_id = ?
       ORDER BY ci.created_at ASC`
    )
    .all(userId);

  const items = rows.map((row) => ({
    cartItemId: row.cart_item_id,
    power: row.power,
    qty: row.qty,
    lensOptionId: row.lens_option_id,
    lensName: row.lens_name,
    lensPrice: row.lens_price || 0,
    prescriptionId: row.prescription_id,
    product: serializeProduct(row)
  }));

  const subtotal = items.reduce((sum, i) => sum + (i.product.price + i.lensPrice) * i.qty, 0);
  const totalItems = items.reduce((sum, i) => sum + i.qty, 0);

  return { items, subtotal, totalItems };
}

// GET /api/cart
router.get("/", (req, res) => {
  res.json(getCartForUser(req.userId));
});

// POST /api/cart  { productId, power, lensOptionId, prescriptionId }
router.post("/", (req, res) => {
  const { productId, power = "Zero Power", lensOptionId = "lens-standard", prescriptionId = null } = req.body;
  if (!productId) return res.status(400).json({ error: "productId is required." });

  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (!product) return res.status(404).json({ error: "Product not found." });

  const lens = db.prepare("SELECT id FROM lens_options WHERE id = ?").get(lensOptionId);
  if (!lens) return res.status(400).json({ error: "Invalid lens option." });

  const existing = db
    .prepare("SELECT * FROM cart_items WHERE user_id = ? AND product_id = ? AND power = ? AND lens_option_id = ?")
    .get(req.userId, productId, power, lensOptionId);

  if (existing) {
    db.prepare("UPDATE cart_items SET qty = qty + 1 WHERE id = ?").run(existing.id);
  } else {
    db.prepare(
      "INSERT INTO cart_items (user_id, product_id, power, lens_option_id, prescription_id, qty) VALUES (?, ?, ?, ?, ?, 1)"
    ).run(req.userId, productId, power, lensOptionId, prescriptionId);
  }

  res.status(201).json(getCartForUser(req.userId));
});

// PATCH /api/cart/:cartItemId  { qty }
router.patch("/:cartItemId", (req, res) => {
  const { qty } = req.body;
  if (!qty || qty < 1) return res.status(400).json({ error: "qty must be at least 1." });

  const item = db
    .prepare("SELECT * FROM cart_items WHERE id = ? AND user_id = ?")
    .get(req.params.cartItemId, req.userId);
  if (!item) return res.status(404).json({ error: "Cart item not found." });

  db.prepare("UPDATE cart_items SET qty = ? WHERE id = ?").run(qty, item.id);
  res.json(getCartForUser(req.userId));
});

// DELETE /api/cart/:cartItemId
router.delete("/:cartItemId", (req, res) => {
  const result = db
    .prepare("DELETE FROM cart_items WHERE id = ? AND user_id = ?")
    .run(req.params.cartItemId, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Cart item not found." });
  res.json(getCartForUser(req.userId));
});

// DELETE /api/cart  (clear whole cart - used after checkout)
router.delete("/", (req, res) => {
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.userId);
  res.json(getCartForUser(req.userId));
});

module.exports = router;
