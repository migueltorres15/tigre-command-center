export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const sitios = db.prepare('SELECT * FROM sitios ORDER BY created_at DESC').all();
    const tareas = db.prepare('SELECT * FROM sitio_tareas ORDER BY created_at ASC').all();
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
      cliente, contacto = '', whatsapp = '', fecha_demo = '', hora_demo = '',
      paquete = 'por_elegir', link_demo = '', link_sitio = '',
      etapa = 'demo_agendado', monto, moneda = 'MXN', notas = '',
    } = body;

    if (!cliente) return Response.json({ error: 'cliente es requerido' }, { status: 400 });

    const result = db.prepare(
      `INSERT INTO sitios (cliente, contacto, whatsapp, fecha_demo, hora_demo, paquete, link_demo, link_sitio, etapa, monto, moneda, notas)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(cliente, contacto, whatsapp, fecha_demo, hora_demo, paquete, link_demo, link_sitio, etapa, monto || null, moneda, notas);

    const sitio = db.prepare('SELECT * FROM sitios WHERE id = ?').get(result.lastInsertRowid);
    return Response.json({ ...sitio, tareas: [] }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
