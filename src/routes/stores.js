const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/stores?city=Delhi
router.get("/", (req, res) => {
  const { city } = req.query;
  let rows;
  if (city) {
    rows = db.prepare("SELECT * FROM stores WHERE city LIKE ?").all(`%${city}%`);
  } else {
    rows = db.prepare("SELECT * FROM stores").all();
  }
  res.json({ stores: rows });
});

module.exports = router;
