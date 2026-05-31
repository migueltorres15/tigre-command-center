export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const sitios = await db.prepare('SELECT * FROM sitios_usa ORDER BY created_at DESC').all();
    const tareas = await db.prepare('SELECT * FROM sitios_usa_tareas ORDER BY created_at ASC').all();
    const result = sitios.map(s => ({
      ...s,
      tareas: tareas.filter(t => t.sitio_id === s.id),
    }));
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const {
      cliente, contacto = '', telefono = '', ciudad = '', estado = '',
      fecha_demo = '', paquete = 'por_elegir', link_demo = '', link_sitio = '',
      etapa = 'lead_nuevo', monto, stripe_link = '', notas = '',
    } = body;

    if (!cliente) return Response.json({ error: 'cliente es requerido' }, { status: 400 });

    const result = await db.prepare(
      `INSERT INTO sitios_usa (cliente, contacto, telefono, ciudad, estado, fecha_demo, paquete, link_demo, link_sitio, etapa, monto, stripe_link, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(cliente, contacto, telefono, ciudad, estado, fecha_demo, paquete, link_demo, link_sitio, etapa, monto || null, stripe_link, notas);

    const sitio = await db.prepare('SELECT * FROM sitios_usa WHERE id = ?').get(result.lastInsertRowid);
    return Response.json({ ...sitio, tareas: [] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
