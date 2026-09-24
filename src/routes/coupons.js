const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// POST /api/coupons/validate  { code, subtotal }
router.post("/validate", requireAuth, (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: "Coupon code is required." });

  const coupon = db
    .prepare("SELECT * FROM coupons WHERE code = ? AND active = 1")
    .get(code.toUpperCase());

  if (!coupon) {
    return res.status(404).json({ error: "Invalid or expired coupon code." });
  }
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(400).json({ error: "This coupon has expired." });
  }
  if (subtotal < coupon.min_order) {
    return res.status(400).json({ error: `Minimum order of ₹${coupon.min_order} required for this coupon.` });
  }

  const discount =
    coupon.discount_type === "percent"
      ? Math.round((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value;

  res.json({ coupon: { code: coupon.code, discountType: coupon.discount_type, discountValue: coupon.discount_value, discount } });
});

module.exports = router;
