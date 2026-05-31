/**
 * Database client — supports both local SQLite (dev) and Turso (production).
 *
 * Local dev:  DATABASE_URL=file:./tigre.db  (default)
 * Production: DATABASE_URL=libsql://...  DATABASE_AUTH_TOKEN=...
 *
 * All db methods are ASYNC — use await.
 */
import { createClient } from '@libsql/client';

let _client = null;

function getClient() {
  if (_client) return _client;
  _client = createClient({
    url:       process.env.DATABASE_URL       || 'file:./tigre.db',
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  return _client;
}

// ── Compatibility wrapper (mirrors better-sqlite3 API but async) ─────────────
class Stmt {
  constructor(client, sql) {
    this._client = client;
    this._sql    = sql;
  }

  async all(...args) {
    const r = await this._client.execute({ sql: this._sql, args: args.flat() });
    return r.rows.map(row => Object.fromEntries(Object.entries(row)));
  }

  async get(...args) {
    const r = await this._client.execute({ sql: this._sql, args: args.flat() });
    if (!r.rows[0]) return null;
    return Object.fromEntries(Object.entries(r.rows[0]));
  }

  async run(...args) {
    const r = await this._client.execute({ sql: this._sql, args: args.flat() });
    return { lastInsertRowid: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected };
  }
}

class Db {
  constructor(client) {
    this._client = client;
  }

  prepare(sql) {
    return new Stmt(this._client, sql);
  }

  async exec(sql) {
    // executeMultiple handles multi-statement DDL strings
    await this._client.executeMultiple(sql);
  }

  /** Run multiple statements in a transaction (array of {sql, args} objects) */
  async batch(statements) {
    return this._client.batch(statements, 'write');
  }
}

// ── Singleton DB instance ────────────────────────────────────────────────────
let _db = null;

export function getDb() {
  if (!_db) _db = new Db(getClient());
  return _db;
}

// ── Schema init (idempotent — safe to run every cold start) ──────────────────
let _initialized = false;

export async function initSchema() {
  if (_initialized) return;
  _initialized = true;

  const db = getDb();

  // Run DDL one statement at a time (libsql limitation with some multi-stmt strings)
  const tables = [
    `CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      status TEXT DEFAULT 'frio',
      monto REAL,
      moneda TEXT DEFAULT 'USD',
      notas TEXT,
      ultimo_contacto TEXT,
      sitio_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      tipo TEXT,
      monto REAL,
      moneda TEXT DEFAULT 'MXN',
      fecha TEXT,
      status TEXT DEFAULT 'pendiente',
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS gastos_fijos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      monto REAL NOT NULL,
      dia_vencimiento TEXT DEFAULT '',
      frecuencia TEXT DEFAULT 'mensual',
      notas TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS deudas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      monto REAL NOT NULL,
      tipo TEXT DEFAULT 'unica',
      pagada INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ingresos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto TEXT NOT NULL,
      descripcion TEXT,
      monto REAL NOT NULL,
      moneda TEXT DEFAULT 'MXN',
      fecha TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      texto TEXT NOT NULL,
      tag TEXT DEFAULT 'pendiente',
      proyecto TEXT DEFAULT 'personal',
      completada INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS gastos_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL,
      monto REAL NOT NULL,
      categoria TEXT DEFAULT 'Otros',
      nota TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS pagos_gastos_fijos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gasto_id INTEGER NOT NULL,
      periodo TEXT NOT NULL,
      pagado INTEGER DEFAULT 0,
      fecha_pago TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(gasto_id, periodo),
      FOREIGN KEY(gasto_id) REFERENCES gastos_fijos(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sitios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      monto REAL,
      moneda TEXT DEFAULT 'MXN',
      status TEXT DEFAULT 'en_proceso',
      notas TEXT,
      contacto TEXT DEFAULT '',
      whatsapp TEXT DEFAULT '',
      fecha_demo TEXT DEFAULT '',
      hora_demo TEXT DEFAULT '',
      paquete TEXT DEFAULT 'por_elegir',
      link_demo TEXT DEFAULT '',
      link_sitio TEXT DEFAULT '',
      etapa TEXT DEFAULT 'demo_agendado',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sitio_tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      completada INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(sitio_id) REFERENCES sitios(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sitios_usa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      contacto TEXT DEFAULT '',
      telefono TEXT DEFAULT '',
      ciudad TEXT DEFAULT '',
      estado TEXT DEFAULT '',
      fecha_demo TEXT DEFAULT '',
      paquete TEXT DEFAULT 'por_elegir',
      link_demo TEXT DEFAULT '',
      link_sitio TEXT DEFAULT '',
      etapa TEXT DEFAULT 'lead_nuevo',
      monto REAL,
      stripe_link TEXT DEFAULT '',
      notas TEXT DEFAULT '',
      follow_up_fecha TEXT,
      follow_up_nota TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS sitios_usa_tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      completada INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(sitio_id) REFERENCES sitios_usa(id) ON DELETE CASCADE
    )`,
  ];

  for (const sql of tables) {
    try { await db.prepare(sql).run(); } catch (e) {
      console.warn('Schema warn:', e.message?.slice(0, 80));
    }
  }
}
