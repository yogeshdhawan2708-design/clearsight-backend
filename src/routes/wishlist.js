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

// GET /api/wishlist
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.* FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`
    )
    .all(req.userId);
  res.json({ products: rows.map(serializeProduct) });
});

// POST /api/wishlist/:productId  (add)
router.post("/:productId", (req, res) => {
  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.productId);
  if (!product) return res.status(404).json({ error: "Product not found." });

  db.prepare(
    "INSERT OR IGNORE INTO wishlist_items (user_id, product_id) VALUES (?, ?)"
  ).run(req.userId, req.params.productId);

  res.status(201).json({ added: true });
});

// DELETE /api/wishlist/:productId  (remove)
router.delete("/:productId", (req, res) => {
  db.prepare("DELETE FROM wishlist_items WHERE user_id = ? AND product_id = ?").run(
    req.userId,
    req.params.productId
  );
  res.json({ removed: true });
});

module.exports = router;
