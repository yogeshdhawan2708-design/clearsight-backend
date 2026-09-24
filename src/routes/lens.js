const express = require("express");
const db = require("../db");

const router = express.Router();

// GET /api/lens-options?type=single-vision
router.get("/", (req, res) => {
  const { type } = req.query;
  let rows;
  if (type) {
    rows = db.prepare("SELECT * FROM lens_options WHERE type = ?").all(type);
  } else {
    rows = db.prepare("SELECT * FROM lens_options").all();
  }
  res.json({ lensOptions: rows });
});

module.exports = router;
