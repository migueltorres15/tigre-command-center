export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes');

    let ingresos;
    if (mes) {
      ingresos = db.prepare(
        `SELECT * FROM ingresos WHERE strftime('%Y-%m', fecha) = ? ORDER BY fecha DESC, created_at DESC LIMIT 20`
      ).all(mes);
    } else {
      ingresos = db.prepare(
        `SELECT * FROM ingresos ORDER BY fecha DESC, created_at DESC LIMIT 20`
      ).all();
    }

    return Response.json(ingresos);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { proyecto, descripcion, monto, moneda = 'MXN', fecha } = body;

    if (!proyecto) {
      return Response.json({ error: 'proyecto es requerido' }, { status: 400 });
    }
    if (!monto) {
      return Response.json({ error: 'monto es requerido' }, { status: 400 });
    }

    const result = db.prepare(
      `INSERT INTO ingresos (proyecto, descripcion, monto, moneda, fecha)
       VALUES (?, ?, ?, ?, COALESCE(?, date('now')))`
    ).run(proyecto, descripcion || null, monto, moneda, fecha || null);

    const ingreso = db.prepare('SELECT * FROM ingresos WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(ingreso, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
