export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
    return Response.json(leads);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { nombre, status = 'frio', monto, moneda = 'USD', notas, ultimo_contacto, sitio_url } = body;

    if (!nombre) {
      return Response.json({ error: 'nombre es requerido' }, { status: 400 });
    }

    const result = db.prepare(
      `INSERT INTO leads (nombre, status, monto, moneda, notas, ultimo_contacto, sitio_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(nombre, status, monto || null, moneda, notas || null, ultimo_contacto || null, sitio_url || null);

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    return Response.json(lead, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
