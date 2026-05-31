export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json();
    const { nombre, status, monto, moneda, notas, ultimo_contacto, sitio_url } = body;

    const existing = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    await db.prepare(
      `UPDATE leads SET
        nombre = COALESCE(?, nombre),
        status = COALESCE(?, status),
        monto = COALESCE(?, monto),
        moneda = COALESCE(?, moneda),
        notas = ?,
        ultimo_contacto = COALESCE(?, ultimo_contacto),
        sitio_url = ?
       WHERE id = ?`
    ).run(
      nombre || null,
      status || null,
      monto !== undefined ? monto : null,
      moneda || null,
      notas !== undefined ? notas : existing.notas,
      ultimo_contacto || null,
      sitio_url !== undefined ? sitio_url : existing.sitio_url,
      id
    );

    const updated = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;

    const existing = await db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Lead no encontrado' }, { status: 404 });
    }

    await db.prepare('DELETE FROM leads WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
