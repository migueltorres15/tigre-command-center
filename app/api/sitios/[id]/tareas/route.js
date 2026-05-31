export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function POST(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const { texto } = await request.json();
    if (!texto?.trim()) return Response.json({ error: 'texto requerido' }, { status: 400 });

    const result = db.prepare(
      `INSERT INTO sitio_tareas (sitio_id, texto) VALUES (?, ?)`
    ).run(id, texto.trim());

    const tarea = db.prepare('SELECT * FROM sitio_tareas WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(tarea, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
