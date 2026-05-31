export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json();
    const { nombre, monto } = body;

    const existing = await db.prepare('SELECT * FROM gastos_fijos WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    const { dia_vencimiento, frecuencia, notas, dia_pago, categoria_link } = body;
    await db.prepare(
      `UPDATE gastos_fijos SET
        nombre = COALESCE(?, nombre),
        monto = COALESCE(?, monto),
        dia_vencimiento = COALESCE(?, dia_vencimiento),
        frecuencia = COALESCE(?, frecuencia),
        notas = COALESCE(?, notas),
        dia_pago = COALESCE(?, dia_pago),
        categoria_link = COALESCE(?, categoria_link)
       WHERE id = ?`
    ).run(nombre || null, monto !== undefined ? monto : null, dia_vencimiento ?? null, frecuencia ?? null, notas ?? null, dia_pago ?? null, categoria_link ?? null, id);

    const updated = await db.prepare('SELECT * FROM gastos_fijos WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;

    const existing = await db.prepare('SELECT * FROM gastos_fijos WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Gasto no encontrado' }, { status: 404 });
    }

    await db.prepare('DELETE FROM gastos_fijos WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
