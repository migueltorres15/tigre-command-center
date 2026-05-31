export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const deudas = db.prepare('SELECT * FROM deudas ORDER BY pagada ASC, id ASC').all();
    return Response.json(deudas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { nombre, monto, tipo = 'unica' } = body;

    if (!nombre) {
      return Response.json({ error: 'nombre es requerido' }, { status: 400 });
    }
    if (monto === undefined || monto === null) {
      return Response.json({ error: 'monto es requerido' }, { status: 400 });
    }

    const result = db.prepare('INSERT INTO deudas (nombre, monto, tipo, pagada) VALUES (?, ?, ?, 0)').run(nombre, monto, tipo);
    const deuda = db.prepare('SELECT * FROM deudas WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(deuda, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
