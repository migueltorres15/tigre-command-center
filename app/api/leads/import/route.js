export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function POST(req) {
  const db = getDb();
  const { leads } = await req.json();
  // leads is array of { nombre, url, ubicacion, notas }
  const insert = db.prepare(
    `INSERT INTO leads (nombre, status, monto, moneda, sitio_url, notas, ultimo_contacto)
     VALUES (?, 'nuevo', null, 'USD', ?, ?, date('now'))`
  );
  const insertMany = db.transaction((items) => {
    const results = [];
    for (const item of items) {
      const r = insert.run(item.nombre || item.nombre_propiedad || 'Sin nombre', item.url || item.sitio_url || '', item.notas ? `${item.ubicacion || ''} — ${item.notas}` : item.ubicacion || '');
      results.push(r.lastInsertRowid);
    }
    return results;
  });
  const ids = insertMany(leads);
  return Response.json({ imported: ids.length });
}
