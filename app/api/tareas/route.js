export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const proyecto = searchParams.get('proyecto');

    let tareas;
    if (proyecto) {
      tareas = db.prepare(
        `SELECT * FROM tareas WHERE proyecto = ? ORDER BY completada ASC, created_at DESC`
      ).all(proyecto);
    } else {
      tareas = db.prepare(
        `SELECT * FROM tareas ORDER BY completada ASC, created_at DESC`
      ).all();
    }

    return Response.json(tareas);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { texto, tag = 'pendiente', proyecto = 'personal' } = body;

    if (!texto) {
      return Response.json({ error: 'texto es requerido' }, { status: 400 });
    }

    const result = await db.prepare(
      `INSERT INTO tareas (texto, tag, proyecto, completada) VALUES (?, ?, ?, 0)`
    ).run(texto, tag, proyecto);

    const tarea = await db.prepare('SELECT * FROM tareas WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(tarea, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
