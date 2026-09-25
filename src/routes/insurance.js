const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// POST /api/insurance/claims  { orderId, description, photoDataUrl }
router.post("/claims", (req, res) => {
  const { orderId, description, photoDataUrl } = req.body;
  if (!orderId || !description) {
    return res.status(400).json({ error: "orderId and description are required." });
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(orderId, req.userId);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (!order.insurance_opted) {
    return res.status(400).json({ error: "This order does not have vision insurance." });
  }

  const result = db
    .prepare("INSERT INTO insurance_claims (order_id, user_id, description, photo_data_url) VALUES (?, ?, ?, ?)")
    .run(orderId, req.userId, description, photoDataUrl || null);

  const claim = db.prepare("SELECT * FROM insurance_claims WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ claim });
});

// GET /api/insurance/claims - user's own claims
router.get("/claims", (req, res) => {
  const claims = db
    .prepare("SELECT * FROM insurance_claims WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  res.json({ claims });
});

module.exports = router;
