export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json();
    const { cliente, tipo, monto, moneda, fecha, status, notas } = body;

    const existing = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    db.prepare(
      `UPDATE sesiones SET
        cliente = COALESCE(?, cliente),
        tipo = COALESCE(?, tipo),
        monto = COALESCE(?, monto),
        moneda = COALESCE(?, moneda),
        fecha = COALESCE(?, fecha),
        status = COALESCE(?, status),
        notas = ?
       WHERE id = ?`
    ).run(
      cliente || null,
      tipo || null,
      monto !== undefined ? monto : null,
      moneda || null,
      fecha || null,
      status || null,
      notas !== undefined ? notas : existing.notas,
      id
    );

    const updated = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;

    const existing = db.prepare('SELECT * FROM sesiones WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }

    db.prepare('DELETE FROM sesiones WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
