export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const gastos = db.prepare('SELECT * FROM gastos_fijos ORDER BY id ASC').all();
    return Response.json(gastos);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { nombre, monto } = body;

    if (!nombre) {
      return Response.json({ error: 'nombre es requerido' }, { status: 400 });
    }
    if (monto === undefined || monto === null) {
      return Response.json({ error: 'monto es requerido' }, { status: 400 });
    }

    const { dia_pago = 0, frecuencia = 'mensual', notas = '', dia_vencimiento = '' } = body;
    const result = db.prepare(
      'INSERT INTO gastos_fijos (nombre, monto, dia_pago, frecuencia, notas, dia_vencimiento) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nombre, monto, dia_pago || 0, frecuencia || 'mensual', notas || '', dia_vencimiento || '');
    const gasto = db.prepare('SELECT * FROM gastos_fijos WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(gasto, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
