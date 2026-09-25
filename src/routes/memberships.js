const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function serializePlan(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    bogo: !!p.bogo,
    cashbackFirstPct: p.cashback_first_pct,
    cashbackAfterPct: p.cashback_after_pct,
    freeLensReplacement: !!p.free_lens_replacement,
    description: p.description
  };
}

// GET /api/memberships/plans - public
router.get("/plans", (req, res) => {
  const plans = db.prepare("SELECT * FROM membership_plans").all();
  res.json({ plans: plans.map(serializePlan) });
});

// GET /api/memberships/me - the logged-in user's current active membership, if any
router.get("/me", requireAuth, (req, res) => {
  const membership = db
    .prepare(
      `SELECT um.*, mp.name as plan_name, mp.bogo, mp.cashback_first_pct, mp.cashback_after_pct, mp.free_lens_replacement
       FROM user_memberships um
       JOIN membership_plans mp ON mp.id = um.plan_id
       WHERE um.user_id = ? AND um.status = 'active' AND um.expires_at > datetime('now')
       ORDER BY um.purchased_at DESC LIMIT 1`
    )
    .get(req.userId);

  const user = db.prepare("SELECT lk_cash_balance FROM users WHERE id = ?").get(req.userId);

  res.json({
    membership: membership || null,
    lkCashBalance: user.lk_cash_balance
  });
});

// POST /api/memberships/subscribe  { planId }
router.post("/subscribe", requireAuth, (req, res) => {
  const { planId } = req.body;
  const plan = db.prepare("SELECT * FROM membership_plans WHERE id = ?").get(planId);
  if (!plan) return res.status(404).json({ error: "Membership plan not found." });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 365);

  db.prepare(
    "INSERT INTO user_memberships (user_id, plan_id, expires_at) VALUES (?, ?, ?)"
  ).run(req.userId, planId, expiresAt.toISOString());

  res.status(201).json({ success: true, expiresAt: expiresAt.toISOString() });
});

module.exports = router;
