export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function POST(request, { params }) {
  try {
    const db = getDb();
    const { texto } = await request.json();
    const result = db.prepare('INSERT INTO sitios_usa_tareas (sitio_id, texto) VALUES (?, ?)').run(params.id, texto);
    const tarea = db.prepare('SELECT * FROM sitios_usa_tareas WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(tarea, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
