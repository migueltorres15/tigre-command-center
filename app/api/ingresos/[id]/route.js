export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;

    const existing = db.prepare('SELECT * FROM ingresos WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Ingreso no encontrado' }, { status: 404 });
    }

    db.prepare('DELETE FROM ingresos WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
