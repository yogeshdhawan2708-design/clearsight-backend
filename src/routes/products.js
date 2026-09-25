const express = require("express");
const db = require("../db");

const router = express.Router();

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    shape: row.shape,
    frameMaterial: row.frame_material,
    gender: row.gender,
    price: row.price,
    mrp: row.mrp,
    color: row.color,
    rating: row.rating,
    reviews: row.reviews,
    image: row.image,
    overlayImage: row.overlay_image,
    powerType: row.power_type,
    description: row.description,
    sizes: row.sizes ? row.sizes.split(",").map((s) => s.trim()).filter(Boolean) : [],
    colorVariants: row.color_variants ? JSON.parse(row.color_variants) : [],
    stockStatus: row.stock_status || "in_stock"
  };
}

// GET /api/products?category=Eyeglasses&shape=Round&gender=Men&q=aviator&sort=price-low
router.get("/", (req, res) => {
  const { category, shape, gender, q, sort } = req.query;

  let sql = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  if (shape) {
    sql += " AND shape = ?";
    params.push(shape);
  }
  if (gender) {
    sql += " AND gender = ?";
    params.push(gender);
  }
  if (q) {
    sql += " AND LOWER(name) LIKE ?";
    params.push(`%${q.toLowerCase()}%`);
  }

  if (sort === "price-low") sql += " ORDER BY price ASC";
  else if (sort === "price-high") sql += " ORDER BY price DESC";
  else if (sort === "rating") sql += " ORDER BY rating DESC";

  const rows = db.prepare(sql).all(...params);
  res.json({ products: rows.map(serialize) });
});

router.get("/categories", (req, res) => {
  const rows = db.prepare("SELECT DISTINCT category FROM products").all();
  res.json({ categories: rows.map((r) => r.category) });
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Product not found." });
  res.json({ product: serialize(row) });
});

module.exports = router;
