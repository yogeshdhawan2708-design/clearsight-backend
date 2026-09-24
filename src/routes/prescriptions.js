const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/prescriptions - list saved prescriptions for the logged-in user
router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM prescriptions WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.userId);
  res.json({ prescriptions: rows });
});

// POST /api/prescriptions - save a prescription (manual power entry and/or a photo, base64 data URL)
router.post("/", (req, res) => {
  const {
    label = "My Prescription",
    rightSph, rightCyl, rightAxis,
    leftSph, leftCyl, leftAxis,
    pd,
    imageDataUrl
  } = req.body;

  const hasManualPower = rightSph || leftSph;
  if (!hasManualPower && !imageDataUrl) {
    return res.status(400).json({ error: "Provide either power values or a prescription photo." });
  }

  const result = db
    .prepare(
      `INSERT INTO prescriptions
       (user_id, label, right_sph, right_cyl, right_axis, left_sph, left_cyl, left_axis, pd, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, label, rightSph || null, rightCyl || null, rightAxis || null, leftSph || null, leftCyl || null, leftAxis || null, pd || null, imageDataUrl || null);

  const prescription = db.prepare("SELECT * FROM prescriptions WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ prescription });
});

// DELETE /api/prescriptions/:id
router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM prescriptions WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: "Prescription not found." });
  res.json({ success: true });
});

module.exports = router;
