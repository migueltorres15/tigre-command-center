export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(req, { params }) {
  try {
    const db = getDb();
    const id = Number(params.id);
    const { fecha, concepto, monto, categoria, nota } = await req.json();
    await db.prepare(
      `UPDATE gastos_variables SET fecha=?, concepto=?, monto=?, categoria=?, nota=? WHERE id=?`
    ).run(fecha, concepto, monto, categoria, nota, id);
    const updated = await db.prepare('SELECT * FROM gastos_variables WHERE id=?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const db = getDb();
    await db.prepare('DELETE FROM gastos_variables WHERE id=?').run(Number(params.id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
