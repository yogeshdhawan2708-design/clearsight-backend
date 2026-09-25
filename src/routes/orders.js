const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const FREE_SHIPPING_THRESHOLD = 999;
const SHIPPING_FEE = 79;

// POST /api/orders  { name, phone, address, city, pincode, paymentMethod, couponCode, insuranceOpted, redeemLkCash }
// Reads the user's current cart, creates an order snapshot, clears the cart.
router.post("/", (req, res) => {
  const { name, phone, address, city, pincode, paymentMethod = "cod", couponCode, insuranceOpted = false, redeemLkCash = false } = req.body;

  if (!name || !phone || !address || !city || !pincode) {
    return res.status(400).json({ error: "Full delivery address is required." });
  }

  const cartRows = db
    .prepare(
      `SELECT ci.power, ci.qty, ci.lens_option_id, ci.prescription_id,
              lo.name AS lens_name, lo.price AS lens_price,
              p.id as product_id, p.name as product_name, p.price, p.category
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN lens_options lo ON lo.id = ci.lens_option_id
       WHERE ci.user_id = ?`
    )
    .all(req.userId);

  if (cartRows.length === 0) {
    return res.status(400).json({ error: "Your cart is empty." });
  }

  const subtotal = cartRows.reduce((sum, r) => sum + (r.price + (r.lens_price || 0)) * r.qty, 0);

  let discount = 0;
  let appliedCouponCode = null;
  if (couponCode) {
    const coupon = db.prepare("SELECT * FROM coupons WHERE code = ? AND active = 1").get(couponCode.toUpperCase());
    if (coupon && subtotal >= coupon.min_order && (!coupon.expires_at || new Date(coupon.expires_at) >= new Date())) {
      discount = coupon.discount_type === "percent" ? Math.round((subtotal * coupon.discount_value) / 100) : coupon.discount_value;
      appliedCouponCode = coupon.code;
    }
  }

  // Membership: BOGO on eyeglasses/sunglasses (cheapest eligible unit made free)
  const membership = db
    .prepare(
      `SELECT um.*, mp.bogo, mp.cashback_first_pct, mp.cashback_after_pct
       FROM user_memberships um JOIN membership_plans mp ON mp.id = um.plan_id
       WHERE um.user_id = ? AND um.status = 'active' AND um.expires_at > datetime('now')
       ORDER BY um.purchased_at DESC LIMIT 1`
    )
    .get(req.userId);

  let bogoDiscount = 0;
  if (membership && membership.bogo) {
    const eligibleUnits = [];
    for (const r of cartRows) {
      if (r.category === "Eyeglasses" || r.category === "Sunglasses") {
        for (let i = 0; i < r.qty; i++) eligibleUnits.push(r.price + (r.lens_price || 0));
      }
    }
    if (eligibleUnits.length >= 2) {
      bogoDiscount = Math.min(...eligibleUnits);
      discount += bogoDiscount;
    }
  }

  // LK Cash redemption: up to 10% of subtotal, capped by balance
  let lkCashRedeemed = 0;
  if (redeemLkCash) {
    const user = db.prepare("SELECT lk_cash_balance FROM users WHERE id = ?").get(req.userId);
    lkCashRedeemed = Math.min(user.lk_cash_balance, Math.floor(subtotal * 0.1));
  }

  const insuranceAmount = insuranceOpted ? 199 : 0;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
  const total = Math.max(subtotal + shipping + insuranceAmount - discount - lkCashRedeemed, 0);

  const createOrder = db.transaction(() => {
    const orderResult = db
      .prepare(
        `INSERT INTO orders
         (user_id, subtotal, shipping, discount, coupon_code, insurance_opted, insurance_amount, total, payment_method, ship_name, ship_phone, ship_address, ship_city, ship_pincode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.userId, subtotal, shipping, discount, appliedCouponCode, insuranceOpted ? 1 : 0, insuranceAmount, total, paymentMethod, name, phone, address, city, pincode);

    const orderId = orderResult.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, product_name, power, qty, price_at_purchase, lens_option_id, lens_name, lens_price, prescription_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of cartRows) {
      insertItem.run(orderId, row.product_id, row.product_name, row.power, row.qty, row.price, row.lens_option_id, row.lens_name, row.lens_price || 0, row.prescription_id);
    }

    db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.userId);

    // Deduct redeemed LK Cash, then credit membership cashback on the final total (simplified: credited immediately, not after 30 days as in the real Lenskart policy)
    if (lkCashRedeemed > 0) {
      db.prepare("UPDATE users SET lk_cash_balance = lk_cash_balance - ? WHERE id = ?").run(lkCashRedeemed, req.userId);
    }
    if (membership && (membership.cashback_first_pct > 0 || membership.cashback_after_pct > 0)) {
      const priorOrderCount = db.prepare("SELECT COUNT(*) as c FROM orders WHERE user_id = ? AND id != ?").get(req.userId, orderId).c;
      const pct = priorOrderCount === 0 ? membership.cashback_first_pct : membership.cashback_after_pct;
      const cashbackAmount = Math.round((total * pct) / 100);
      if (cashbackAmount > 0) {
        db.prepare("UPDATE users SET lk_cash_balance = lk_cash_balance + ? WHERE id = ?").run(cashbackAmount, req.userId);
      }
    }

    return orderId;
  });

  const orderId = createOrder();
  const order = getOrderById(orderId, req.userId);

  res.status(201).json({ order, bogoDiscount, lkCashRedeemed });
});

function getOrderById(orderId, userId) {
  const order = db
    .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
    .get(orderId, userId);
  if (!order) return null;

  const items = db
    .prepare("SELECT * FROM order_items WHERE order_id = ?")
    .all(orderId);

  return {
    id: order.id,
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount,
    couponCode: order.coupon_code,
    insuranceOpted: !!order.insurance_opted,
    insuranceAmount: order.insurance_amount,
    total: order.total,
    paymentMethod: order.payment_method,
    status: order.status,
    shipping_address: {
      name: order.ship_name,
      phone: order.ship_phone,
      address: order.ship_address,
      city: order.ship_city,
      pincode: order.ship_pincode
    },
    createdAt: order.created_at,
    items: items.map((i) => ({
      id: i.id,
      productId: i.product_id,
      name: i.product_name,
      power: i.power,
      qty: i.qty,
      price: i.price_at_purchase,
      lensOptionId: i.lens_option_id,
      lensName: i.lens_name,
      lensPrice: i.lens_price
    }))
  };
}

// GET /api/orders
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT id FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  const orders = rows.map((r) => getOrderById(r.id, req.userId));
  res.json({ orders });
});

// GET /api/orders/:id
router.get("/:id", (req, res) => {
  const order = getOrderById(req.params.id, req.userId);
  if (!order) return res.status(404).json({ error: "Order not found." });
  res.json({ order });
});

module.exports = router;
