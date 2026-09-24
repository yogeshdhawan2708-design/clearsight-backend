const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// POST /api/returns  { orderId, orderItemId, type: 'return'|'exchange', reason }
router.post("/", (req, res) => {
  const { orderId, orderItemId, type = "return", reason } = req.body;
  if (!orderId || !orderItemId || !reason) {
    return res.status(400).json({ error: "orderId, orderItemId, and reason are required." });
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?").get(orderId, req.userId);
  if (!order) return res.status(404).json({ error: "Order not found." });

  const item = db.prepare("SELECT * FROM order_items WHERE id = ? AND order_id = ?").get(orderItemId, orderId);
  if (!item) return res.status(404).json({ error: "Order item not found." });

  const result = db
    .prepare("INSERT INTO returns (order_id, order_item_id, user_id, type, reason) VALUES (?, ?, ?, ?, ?)")
    .run(orderId, orderItemId, req.userId, type, reason);

  const created = db.prepare("SELECT * FROM returns WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ return: created });
});

// GET /api/returns - the user's own return/exchange requests
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM returns WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  res.json({ returns: rows });
});

module.exports = router;
