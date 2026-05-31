export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export function GET(request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes');
  if (mes) {
    const rows = db.prepare(`SELECT * FROM gastos_variables WHERE strftime('%Y-%m', fecha) = ? ORDER BY fecha DESC, created_at DESC`).all(mes);
    return Response.json(rows);
  }
  const rows = db.prepare(`SELECT * FROM gastos_variables ORDER BY fecha DESC, created_at DESC LIMIT 100`).all();
  return Response.json(rows);
}

export async function POST(req) {
  const db = getDb();
  const { fecha, concepto, monto, categoria = 'Otros', nota = '' } = await req.json();
  if (!fecha || !concepto || !monto) return Response.json({ error: 'fecha, concepto y monto requeridos' }, { status: 400 });
  const result = db.prepare(`INSERT INTO gastos_variables (fecha, concepto, monto, categoria, nota) VALUES (?, ?, ?, ?, ?)`).run(fecha, concepto, monto, categoria, nota);
  return Response.json(db.prepare('SELECT * FROM gastos_variables WHERE id=?').get(result.lastInsertRowid), { status: 201 });
}
