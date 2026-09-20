const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

// Público: catálogo activo para el storefront
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY thick, diam').all();
  res.json(rows.map(toPublic));
});

// Admin: catálogo completo (incluye inactivos, precio, stock)
router.get('/admin', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY thick, diam').all();
  res.json(rows);
});

router.post('/admin', requireAuth, (req, res) => {
  const p = req.body || {};
  if (!p.name) return res.status(400).json({ error: 'El nombre es requerido' });
  const stmt = db.prepare(`
    INSERT INTO products (name, cat, unit, weight, diam, thick, temple, price_per_kg, stock_kg, active)
    VALUES (@name, @cat, @unit, @weight, @diam, @thick, @temple, @price_per_kg, @stock_kg, @active)
  `);
  const info = stmt.run({
    name: p.name,
    cat: p.cat || 'Discos de aluminio',
    unit: p.unit || 'disco',
    weight: p.weight ?? null,
    diam: p.diam ?? null,
    thick: p.thick ?? null,
    temple: p.temple ?? null,
    price_per_kg: p.price_per_kg ?? null,
    stock_kg: p.stock_kg ?? 0,
    active: p.active === undefined ? 1 : (p.active ? 1 : 0),
  });
  const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/admin/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  const p = { ...existing, ...req.body };
  db.prepare(`
    UPDATE products SET name=@name, cat=@cat, unit=@unit, weight=@weight, diam=@diam, thick=@thick,
      temple=@temple, price_per_kg=@price_per_kg, stock_kg=@stock_kg, active=@active, updated_at=datetime('now')
    WHERE id=@id
  `).run({
    id: existing.id,
    name: p.name,
    cat: p.cat,
    unit: p.unit,
    weight: p.weight,
    diam: p.diam,
    thick: p.thick,
    temple: p.temple,
    price_per_kg: p.price_per_kg,
    stock_kg: p.stock_kg,
    active: p.active ? 1 : 0,
  });
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id));
});

router.delete('/admin/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

function toPublic(p) {
  return {
    id: p.id,
    name: p.name,
    cat: p.cat,
    unit: p.unit,
    weight: p.weight,
    diam: p.diam,
    thick: p.thick,
    temple: p.temple,
    price_per_kg: p.price_per_kg,
  };
}

module.exports = router;
