export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(req, { params }) {
  const db = getDb();
  const id = Number(params.id);
  const { fecha, concepto, monto, categoria, nota } = await req.json();
  db.prepare(`UPDATE gastos_variables SET fecha=?, concepto=?, monto=?, categoria=?, nota=? WHERE id=?`).run(fecha, concepto, monto, categoria, nota, id);
  return Response.json(db.prepare('SELECT * FROM gastos_variables WHERE id=?').get(id));
}

export function DELETE(req, { params }) {
  const db = getDb();
  db.prepare('DELETE FROM gastos_variables WHERE id=?').run(Number(params.id));
  return Response.json({ ok: true });
}
