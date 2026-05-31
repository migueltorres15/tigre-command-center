export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { completada } = await request.json();
    await db.prepare('UPDATE sitios_usa_tareas SET completada = ? WHERE id = ?').run(completada ? 1 : 0, params.tareaId);
    const tarea = await db.prepare('SELECT * FROM sitios_usa_tareas WHERE id = ?').get(params.tareaId);
    return Response.json(tarea);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    await db.prepare('DELETE FROM sitios_usa_tareas WHERE id = ?').run(params.tareaId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
