const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const HOME_TEST_PRICE = 99;
const HOME_TEST_LISTED_PRICE = 120;

// GET /api/home-test/slots - just returns fixed slot options; no live calendar
router.get("/slots", (req, res) => {
  res.json({
    slots: ["9:00 AM - 11:00 AM", "11:00 AM - 1:00 PM", "2:00 PM - 4:00 PM", "4:00 PM - 6:00 PM", "6:00 PM - 8:00 PM"],
    price: HOME_TEST_PRICE,
    listedPrice: HOME_TEST_LISTED_PRICE
  });
});

// POST /api/home-test  { name, phone, address, city, pincode, preferredDate, preferredSlot, familyMembers, notes }
router.post("/", (req, res) => {
  const { name, phone, address, city, pincode, preferredDate, preferredSlot, familyMembers = 1, notes } = req.body;
  if (!name || !phone || !address || !city || !pincode || !preferredDate || !preferredSlot) {
    return res.status(400).json({ error: "Name, phone, address, city, pincode, date, and slot are required." });
  }

  const result = db
    .prepare(
      `INSERT INTO home_test_bookings (user_id, name, phone, address, city, pincode, preferred_date, preferred_slot, family_members, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, name, phone, address, city, pincode, preferredDate, preferredSlot, familyMembers, notes || null);

  const booking = db.prepare("SELECT * FROM home_test_bookings WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ booking });
});

// GET /api/home-test - user's own bookings
router.get("/", (req, res) => {
  const bookings = db
    .prepare("SELECT * FROM home_test_bookings WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  res.json({ bookings });
});

module.exports = router;
