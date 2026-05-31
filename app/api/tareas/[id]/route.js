export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const body = await request.json();
    const { texto, tag, proyecto, completada } = body;

    const existing = await db.prepare('SELECT * FROM tareas WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    await db.prepare(
      `UPDATE tareas SET
        texto = COALESCE(?, texto),
        tag = COALESCE(?, tag),
        proyecto = COALESCE(?, proyecto),
        completada = COALESCE(?, completada)
       WHERE id = ?`
    ).run(
      texto || null,
      tag || null,
      proyecto || null,
      completada !== undefined ? (completada ? 1 : 0) : null,
      id
    );

    const updated = await db.prepare('SELECT * FROM tareas WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;

    const existing = await db.prepare('SELECT * FROM tareas WHERE id = ?').get(id);
    if (!existing) {
      return Response.json({ error: 'Tarea no encontrada' }, { status: 404 });
    }

    await db.prepare('DELETE FROM tareas WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
