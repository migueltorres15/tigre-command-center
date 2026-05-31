export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function POST(req) {
  try {
    const db = getDb();
    const { leads } = await req.json();
    if (!leads || !leads.length) return Response.json({ imported: 0 });

    const ids = [];
    for (const item of leads) {
      const result = await db.prepare(
        `INSERT INTO leads (nombre, status, monto, moneda, sitio_url, notas, ultimo_contacto)
         VALUES (?, 'nuevo', null, 'USD', ?, ?, date('now'))`
      ).run(
        item.nombre || item.nombre_propiedad || 'Sin nombre',
        item.url || item.sitio_url || '',
        item.notas ? `${item.ubicacion || ''} — ${item.notas}` : item.ubicacion || ''
      );
      ids.push(result.lastInsertRowid);
    }
    return Response.json({ imported: ids.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
