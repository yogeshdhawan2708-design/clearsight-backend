const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const ISSUE_TYPES = [
  "discoloration", "bent_frame", "hinge_issue", "coating_peel_off",
  "spotting", "wrong_power", "lens_crazing", "other"
];

// POST /api/warranty/claims  { orderId, orderItemId, issueType, description, photoDataUrl }
router.post("/claims", (req, res) => {
  const { orderId, orderItemId, issueType, description, photoDataUrl } = req.body;
  if (!orderId || !orderItemId || !issueType || !description) {
    return res.status(400).json({ error: "orderId, orderItemId, issueType, and description are required." });
  }
  if (!ISSUE_TYPES.includes(issueType)) {
    return res.status(400).json({ error: `issueType must be one of: ${ISSUE_TYPES.join(", ")}` });
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(orderId, req.userId);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const item = db.prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?").get(orderItemId, orderId);
  if (!item) return res.status(404).json({ error: "Order item not found." });

  const result = db
    .prepare(
      "INSERT INTO warranty_claims (order_id, order_item_id, user_id, issue_type, description, photo_data_url) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(orderId, orderItemId, req.userId, issueType, description, photoDataUrl || null);

  const claim = db.prepare("SELECT * FROM warranty_claims WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ claim });
});

// GET /api/warranty/claims - user's own claims
router.get("/claims", (req, res) => {
  const claims = db
    .prepare("SELECT * FROM warranty_claims WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  res.json({ claims });
});

module.exports = router;
