const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function refreshProductRating(productId) {
  const agg = db
    .prepare("SELECT COUNT(*) as count, AVG(rating) as avg FROM reviews WHERE product_id = ?")
    .get(productId);
  db.prepare("UPDATE products SET rating = ?, reviews = ? WHERE id = ?").run(
    agg.avg ? Math.round(agg.avg * 10) / 10 : 0,
    agg.count,
    productId
  );
}

// GET /api/reviews/:productId
router.get("/:productId", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC")
    .all(req.params.productId);
  res.json({ reviews: rows });
});

// POST /api/reviews/:productId  { rating, comment } (auth required, one review per user per product)
router.post("/:productId", requireAuth, (req, res) => {
  const { rating, comment } = req.body;
  const productId = req.params.productId;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5." });
  }
  const product = db.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (!product) return res.status(404).json({ error: "Product not found." });

  const user = db.prepare("SELECT name FROM users WHERE id = ?").get(req.userId);

  const existing = db
    .prepare("SELECT id FROM reviews WHERE product_id = ? AND user_id = ?")
    .get(productId, req.userId);

  if (existing) {
    db.prepare("UPDATE reviews SET rating = ?, comment = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?").run(rating, comment || null, existing.id);
  } else {
    db.prepare(
      "INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)"
    ).run(productId, req.userId, user.name, rating, comment || null);
  }

  refreshProductRating(productId);

  const reviews = db.prepare("SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC").all(productId);
  res.status(201).json({ reviews });
});

// DELETE /api/reviews/:productId (own review only)
router.delete("/:productId", requireAuth, (req, res) => {
  const productId = req.params.productId;
  const result = db
    .prepare("DELETE FROM reviews WHERE product_id = ? AND user_id = ?")
    .run(productId, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Review not found." });
  refreshProductRating(productId);
  res.json({ success: true });
});

module.exports = router;
