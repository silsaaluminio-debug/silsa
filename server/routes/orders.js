const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function genFolio() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `SIL-${y}${m}${d}-${rand}`;
}

// Público: crear pedido desde el carrito
router.post('/', (req, res) => {
  const { customer_name, customer_phone, notes, items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'El pedido debe incluir al menos un artículo' });
  }

  const productStmt = db.prepare('SELECT * FROM products WHERE id = ?');
  let totalKg = 0;
  let totalAmount = 0;
  let hasPrice = true;
  const resolvedItems = items.map((it) => {
    const product = it.product_id ? productStmt.get(it.product_id) : null;
    const qty = Number(it.qty_kg) || 0;
    const price = product?.price_per_kg ?? null;
    if (price == null) hasPrice = false;
    totalKg += qty;
    if (price != null) totalAmount += qty * price;
    return {
      product_id: product ? product.id : null,
      product_name: product ? product.name : (it.product_name || 'Producto'),
      qty_kg: qty,
      price_per_kg: price,
      subtotal: price != null ? qty * price : null,
    };
  });

  const folio = genFolio();
  const insertOrder = db.prepare(`
    INSERT INTO orders (folio, customer_name, customer_phone, notes, status, total_kg, total_amount)
    VALUES (@folio, @customer_name, @customer_phone, @notes, 'nuevo', @total_kg, @total_amount)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, qty_kg, price_per_kg, subtotal)
    VALUES (@order_id, @product_id, @product_name, @qty_kg, @price_per_kg, @subtotal)
  `);

  const tx = db.transaction(() => {
    const info = insertOrder.run({
      folio,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      notes: notes || null,
      total_kg: totalKg,
      total_amount: hasPrice ? totalAmount : null,
    });
    for (const it of resolvedItems) {
      insertItem.run({ order_id: info.lastInsertRowid, ...it });
    }
    return info.lastInsertRowid;
  });

  const orderId = tx();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  res.status(201).json({ ...order, items: orderItems });
});

// Admin: listar pedidos
router.get('/admin', requireAuth, (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }
  const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
  res.json(rows.map((o) => ({ ...o, items: itemsStmt.all(o.id) })));
});

router.patch('/admin/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const valid = ['nuevo', 'cotizado', 'confirmado', 'cerrado', 'cancelado'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Estatus inválido' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });

  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, order.id);

  // Al confirmar un pedido, registra salidas de inventario automáticamente
  if (status === 'confirmado' && order.status !== 'confirmado') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const insertMove = db.prepare(`
      INSERT INTO inventory_movements (product_id, type, qty_kg, reference, notes, order_id)
      VALUES (?, 'salida', ?, ?, ?, ?)
    `);
    const updateStock = db.prepare('UPDATE products SET stock_kg = stock_kg - ? WHERE id = ?');
    const tx = db.transaction(() => {
      for (const it of items) {
        if (!it.product_id) continue;
        insertMove.run(it.product_id, it.qty_kg, order.folio, 'Salida automática por confirmación de pedido', order.id);
        updateStock.run(it.qty_kg, it.product_id);
      }
    });
    tx();
  }

  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id));
});

module.exports = router;
