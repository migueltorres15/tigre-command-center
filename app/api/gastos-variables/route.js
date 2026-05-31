export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes');
    if (mes) {
      const rows = await db.prepare(
        `SELECT * FROM gastos_variables WHERE strftime('%Y-%m', fecha) = ? ORDER BY fecha DESC, created_at DESC`
      ).all(mes);
      return Response.json(rows);
    }
    const rows = await db.prepare(
      `SELECT * FROM gastos_variables ORDER BY fecha DESC, created_at DESC LIMIT 100`
    ).all();
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const db = getDb();
    const { fecha, concepto, monto, categoria = 'Otros', nota = '' } = await req.json();
    if (!fecha || !concepto || !monto) {
      return Response.json({ error: 'fecha, concepto y monto requeridos' }, { status: 400 });
    }
    const result = await db.prepare(
      `INSERT INTO gastos_variables (fecha, concepto, monto, categoria, nota) VALUES (?, ?, ?, ?, ?)`
    ).run(fecha, concepto, monto, categoria, nota);
    const row = await db.prepare('SELECT * FROM gastos_variables WHERE id=?').get(result.lastInsertRowid);
    return Response.json(row, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
