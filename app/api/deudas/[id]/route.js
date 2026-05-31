export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json();
    const { nombre, monto, tipo, pagada } = body;

    const existing = await db.prepare('SELECT * FROM deudas WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Deuda no encontrada' }, { status: 404 });
    }

    await db.prepare(
      `UPDATE deudas SET
        nombre = COALESCE(?, nombre),
        monto = COALESCE(?, monto),
        tipo = COALESCE(?, tipo),
        pagada = COALESCE(?, pagada)
       WHERE id = ?`
    ).run(
      nombre || null,
      monto !== undefined ? monto : null,
      tipo || null,
      pagada !== undefined ? (pagada ? 1 : 0) : null,
      id
    );

    const updated = await db.prepare('SELECT * FROM deudas WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;

    const existing = await db.prepare('SELECT * FROM deudas WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Deuda no encontrada' }, { status: 404 });
    }

    await db.prepare('DELETE FROM deudas WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
