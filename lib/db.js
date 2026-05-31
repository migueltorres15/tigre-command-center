import Database from 'better-sqlite3';
import path from 'path';

let db;

export function getDb() {
  if (!db) {
    const dbPath = path.join(process.cwd(), 'tigre.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      status TEXT DEFAULT 'frio',
      monto REAL,
      moneda TEXT DEFAULT 'USD',
      notas TEXT,
      ultimo_contacto TEXT,
      sitio_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sitios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      monto REAL,
      moneda TEXT DEFAULT 'MXN',
      status TEXT DEFAULT 'en_proceso',
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente TEXT NOT NULL,
      tipo TEXT,
      monto REAL,
      moneda TEXT DEFAULT 'MXN',
      fecha TEXT,
      status TEXT DEFAULT 'pendiente',
      notas TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gastos_fijos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      monto REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deudas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      monto REAL NOT NULL,
      tipo TEXT DEFAULT 'unica',
      pagada INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ingresos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proyecto TEXT NOT NULL,
      descripcion TEXT,
      monto REAL NOT NULL,
      moneda TEXT DEFAULT 'MXN',
      fecha TEXT DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      texto TEXT NOT NULL,
      tag TEXT DEFAULT 'pendiente',
      proyecto TEXT DEFAULT 'personal',
      completada INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS gastos_variables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      concepto TEXT NOT NULL,
      monto REAL NOT NULL,
      categoria TEXT DEFAULT 'Otros',
      nota TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pagos_gastos_fijos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gasto_id INTEGER NOT NULL,
      periodo TEXT NOT NULL,
      pagado INTEGER DEFAULT 0,
      fecha_pago TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(gasto_id, periodo),
      FOREIGN KEY(gasto_id) REFERENCES gastos_fijos(id) ON DELETE CASCADE
    );
  `);

  // Migrate sitios — add new columns if not exist
  try { db.exec(`ALTER TABLE sitios ADD COLUMN contacto TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE sitios ADD COLUMN whatsapp TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE sitios ADD COLUMN fecha_demo TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE sitios ADD COLUMN paquete TEXT DEFAULT 'por_elegir'`); } catch {}
  try { db.exec(`ALTER TABLE sitios ADD COLUMN link_demo TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE sitios ADD COLUMN link_sitio TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE sitios ADD COLUMN etapa TEXT DEFAULT 'demo_agendado'`); } catch {}

  // Sitio tareas — per-project task list
  db.exec(`
    CREATE TABLE IF NOT EXISTS sitio_tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      completada INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(sitio_id) REFERENCES sitios(id) ON DELETE CASCADE
    );
  `);

  // Sitios USA pipeline
  db.exec(`
    CREATE TABLE IF NOT EXISTS sitios_usa (
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
    );
    CREATE TABLE IF NOT EXISTS sitios_usa_tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      texto TEXT NOT NULL,
      completada INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(sitio_id) REFERENCES sitios_usa(id) ON DELETE CASCADE
    );
  `);

  // Migrate sitios — hora_demo column
  try { db.exec(`ALTER TABLE sitios ADD COLUMN hora_demo TEXT DEFAULT ''`); } catch {}

  // Migrate gastos_fijos — add new columns if not exist
  try { db.exec(`ALTER TABLE gastos_fijos ADD COLUMN dia_vencimiento TEXT DEFAULT ''`); } catch {}
  try { db.exec(`ALTER TABLE gastos_fijos ADD COLUMN frecuencia TEXT DEFAULT 'mensual'`); } catch {}
  try { db.exec(`ALTER TABLE gastos_fijos ADD COLUMN notas TEXT DEFAULT ''`); } catch {}

  // Seed due-date metadata for existing gastos_fijos (idempotent — only fills if blank)
  const setMeta = db.prepare(`UPDATE gastos_fijos SET dia_vencimiento=?, frecuencia=?, notas=? WHERE LOWER(nombre)=LOWER(?) AND (dia_vencimiento IS NULL OR dia_vencimiento='')`);
  setMeta.run('Día 8–10', 'mensual', '', 'Renta');
  setMeta.run('Día 1–5', 'mensual', '', 'Internet');
  setMeta.run('Día 1–5', 'mensual', '', 'Teléfono');
  setMeta.run('Día 1–10', 'mensual', '', 'Luz');
  setMeta.run('Día 1–10', 'mensual', '', 'Gas');
  setMeta.run('Día 1–5', 'mensual', '', 'Nómina YAO');
  setMeta.run('Días variables', 'mensual', '', 'DJs YAO');
  // Personal gastos — match by actual stored names (case-insensitive)
  setMeta.run('Día 8–10', 'mensual', 'Entre el 8 y 10 de cada mes', 'Renta Casa');
  setMeta.run('Lun o Mar', 'semanal', 'Pago semanal cada lunes o martes', 'Pension Alimenticia');
  setMeta.run('Lun o Mar', 'semanal', 'Pago semanal cada lunes o martes', 'Pensión alimenticia');
  setMeta.run('Día 1–5', 'mensual', 'Principios de mes', 'Escuela Azul');
}

export function seed() {
  const db = getDb();

  // Seed gastos_fijos
  const gastosCount = db.prepare('SELECT COUNT(*) as c FROM gastos_fijos').get();
  if (gastosCount.c === 0) {
    const insertGasto = db.prepare('INSERT INTO gastos_fijos (nombre, monto) VALUES (?, ?)');
    const gastos = [
      ['Renta', 18000],
      ['Nómina YAO', 8000],
      ['DJs YAO', 6000],
      ['Luz', 1700],
      ['Gas', 1200],
      ['Internet', 500],
      ['Teléfono', 500],
      ['Gasolina', 2000],
      ['Comida', 2500],
      ['Otros', 1850],
    ];
    const insertMany = db.transaction((items) => {
      for (const [nombre, monto] of items) {
        insertGasto.run(nombre, monto);
      }
    });
    insertMany(gastos);
  }

  // Seed deudas
  const deudasCount = db.prepare('SELECT COUNT(*) as c FROM deudas').get();
  if (deudasCount.c === 0) {
    const insertDeuda = db.prepare('INSERT INTO deudas (nombre, monto, tipo, pagada) VALUES (?, ?, ?, 0)');
    const deudas = [
      ['DJ Smklj', 1500, 'unica'],
      ['Aya', 1500, 'unica'],
      ['Natalia', 1500, 'unica'],
      ['DJ Mortal', 2500, 'unica'],
      ['Pescadero 62', 3500, 'unica'],
      ['Miranda', 4500, 'unica'],
      ['Banorte', 1500, 'mensual'],
    ];
    const insertMany = db.transaction((items) => {
      for (const [nombre, monto, tipo] of items) {
        insertDeuda.run(nombre, monto, tipo);
      }
    });
    insertMany(deudas);
  }

  // Seed leads
  const leadsCount = db.prepare('SELECT COUNT(*) as c FROM leads').get();
  if (leadsCount.c === 0) {
    db.prepare(
      `INSERT INTO leads (nombre, status, monto, moneda, sitio_url, notas, ultimo_contacto)
       VALUES (?, ?, ?, ?, ?, ?, date('now'))`
    ).run('Casa Escorpión', 'caliente', 950, 'USD', 'https://migueltorres15.github.io/casa-escorpion', 'Pendiente cierre');
  }

  // Seed sitios
  const sitiosCount = db.prepare('SELECT COUNT(*) as c FROM sitios').get();
  if (sitiosCount.c === 0) {
    const insertSitio = db.prepare('INSERT INTO sitios (cliente, monto, moneda, status, notas) VALUES (?, ?, ?, ?, ?)');
    db.transaction(() => {
      insertSitio.run('Isabel masajista', 2500, 'MXN', 'cobrado', 'Fotos pendientes');
      insertSitio.run('Casa Bonita', 1900, 'MXN', 'en_proceso', null);
    })();
  }

  // Seed sesiones
  const sesionesCount = db.prepare('SELECT COUNT(*) as c FROM sesiones').get();
  if (sesionesCount.c === 0) {
    db.prepare(
      `INSERT INTO sesiones (cliente, tipo, monto, moneda, fecha, status)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('Cliente maternidad', 'Maternidad', 350, 'USD', '2025-06-07', 'confirmado');
  }

  // Seed config
  const configCount = db.prepare("SELECT COUNT(*) as c FROM config WHERE key='yao_url'").get();
  if (configCount.c === 0) {
    db.prepare("INSERT INTO config (key, value) VALUES ('yao_url', ?)").run('http://localhost:5500/YAO/index.html');
  }
}
