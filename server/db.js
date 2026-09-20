const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'silsa.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  legacy_id INTEGER,
  name TEXT NOT NULL,
  cat TEXT NOT NULL DEFAULT 'Discos de aluminio',
  unit TEXT NOT NULL DEFAULT 'disco',
  weight REAL,
  diam REAL,
  thick REAL,
  temple TEXT,
  price_per_kg REAL,
  stock_kg REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  folio TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'nuevo', -- nuevo | cotizado | confirmado | cerrado | cancelado
  total_kg REAL NOT NULL DEFAULT 0,
  total_amount REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  qty_kg REAL NOT NULL,
  price_per_kg REAL,
  subtotal REAL
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- entrada | salida | ajuste
  qty_kg REAL NOT NULL,
  reference TEXT,
  notes TEXT,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

function seedIfEmpty() {
  const countProducts = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (countProducts === 0) {
    const seedPath = path.join(__dirname, 'seed-products.json');
    if (fs.existsSync(seedPath)) {
      const products = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      const insert = db.prepare(`
        INSERT INTO products (legacy_id, name, cat, unit, weight, diam, thick, temple, price_per_kg, stock_kg, active)
        VALUES (@id, @name, @cat, @unit, @weight, @diam, @thick, @temple, NULL, 0, 1)
      `);
      const insertMany = db.transaction((rows) => {
        for (const p of rows) insert.run(p);
      });
      insertMany(products);
      console.log(`Seed: ${products.length} productos cargados.`);
    }
  }

  const countAdmins = db.prepare('SELECT COUNT(*) c FROM admin_users').get().c;
  if (countAdmins === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'silsa2026';
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log(`Seed: admin creado -> usuario="${username}" password="${password}" (¡cámbiala después de iniciar sesión!)`);
  }
}

seedIfEmpty();

module.exports = db;
