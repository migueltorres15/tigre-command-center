export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const sesiones = db.prepare('SELECT * FROM sesiones ORDER BY fecha DESC, created_at DESC').all();
    return Response.json(sesiones);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { cliente, tipo, monto, moneda = 'MXN', fecha, status = 'pendiente', notas } = body;

    if (!cliente) {
      return Response.json({ error: 'cliente es requerido' }, { status: 400 });
    }

    const result = db.prepare(
      `INSERT INTO sesiones (cliente, tipo, monto, moneda, fecha, status, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(cliente, tipo || null, monto || null, moneda, fecha || null, status, notas || null);

    const sesion = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(sesion, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
