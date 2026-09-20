const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Admin: Kardex completo o filtrado por producto
router.get('/', requireAuth, (req, res) => {
  const { product_id } = req.query;
  let rows;
  if (product_id) {
    rows = db.prepare(`
      SELECT m.*, p.name as product_name FROM inventory_movements m
      JOIN products p ON p.id = m.product_id
      WHERE m.product_id = ? ORDER BY m.created_at DESC
    `).all(product_id);
  } else {
    rows = db.prepare(`
      SELECT m.*, p.name as product_name FROM inventory_movements m
      JOIN products p ON p.id = m.product_id
      ORDER BY m.created_at DESC LIMIT 300
    `).all();
  }
  res.json(rows);
});

// Admin: registrar movimiento manual (entrada / salida / ajuste)
router.post('/', requireAuth, (req, res) => {
  const { product_id, type, qty_kg, reference, notes } = req.body || {};
  const validTypes = ['entrada', 'salida', 'ajuste'];
  if (!product_id || !validTypes.includes(type) || !qty_kg) {
    return res.status(400).json({ error: 'product_id, type (entrada|salida|ajuste) y qty_kg son requeridos' });
  }
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const qty = Number(qty_kg);
  const delta = type === 'salida' ? -Math.abs(qty) : Math.abs(qty);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO inventory_movements (product_id, type, qty_kg, reference, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(product_id, type, qty, reference || null, notes || null);
    db.prepare('UPDATE products SET stock_kg = stock_kg + ? WHERE id = ?').run(delta, product_id);
  });
  tx();

  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(product_id));
});

// Admin: resumen / dashboard
router.get('/summary', requireAuth, (req, res) => {
  const totalStockKg = db.prepare('SELECT COALESCE(SUM(stock_kg),0) v FROM products').get().v;
  const productCount = db.prepare('SELECT COUNT(*) c FROM products WHERE active = 1').get().c;
  const ordersByStatus = db.prepare('SELECT status, COUNT(*) c FROM orders GROUP BY status').all();
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all();
  const lowStock = db.prepare('SELECT * FROM products WHERE active = 1 AND stock_kg <= 5 ORDER BY stock_kg ASC LIMIT 10').all();
  res.json({ totalStockKg, productCount, ordersByStatus, recentOrders, lowStock });
});

module.exports = router;
