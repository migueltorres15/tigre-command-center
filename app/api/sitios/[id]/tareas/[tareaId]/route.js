export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { tareaId } = await params;
    const body = await request.json();
    const { completada, texto } = body;

    db.prepare(
      `UPDATE sitio_tareas SET
        completada = COALESCE(?, completada),
        texto = COALESCE(?, texto)
       WHERE id = ?`
    ).run(
      completada !== undefined ? (completada ? 1 : 0) : null,
      texto || null,
      tareaId
    );

    const tarea = db.prepare('SELECT * FROM sitio_tareas WHERE id = ?').get(tareaId);
    return Response.json(tarea);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { tareaId } = await params;
    db.prepare('DELETE FROM sitio_tareas WHERE id = ?').run(tareaId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
