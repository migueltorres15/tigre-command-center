export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const body = await request.json();
    const { cliente, contacto, telefono, ciudad, estado, fecha_demo, paquete, link_demo, link_sitio, etapa, monto, stripe_link, notas, follow_up_fecha, follow_up_nota } = body;

    // Leer etapa anterior para detectar el cambio
    const anterior = await db.prepare('SELECT etapa FROM sitios_usa WHERE id = ?').get(params.id);

    await db.prepare(
      `UPDATE sitios_usa SET cliente=?, contacto=?, telefono=?, ciudad=?, estado=?, fecha_demo=?, paquete=?, link_demo=?, link_sitio=?, etapa=?, monto=?, stripe_link=?, notas=?, follow_up_fecha=?, follow_up_nota=? WHERE id=?`
    ).run(cliente, contacto || '', telefono || '', ciudad || '', estado || '', fecha_demo || '', paquete || 'por_elegir', link_demo || '', link_sitio || '', etapa || 'lead_nuevo', monto || null, stripe_link || '', notas || '', follow_up_fecha || null, follow_up_nota || null, params.id);

    const sitio = await db.prepare('SELECT * FROM sitios_usa WHERE id = ?').get(params.id);

    // ── Auto-crear en sitios web cuando cambia a demo_agendado ──────────────
    let sitioCreado = null;
    if (etapa === 'demo_agendado' && anterior?.etapa !== 'demo_agendado') {
      // Verificar que no exista ya (evitar duplicados)
      const existe = await db.prepare(
        `SELECT id FROM sitios WHERE cliente = ? COLLATE NOCASE`
      ).get(cliente);

      if (!existe) {
        const ins = await db.prepare(
          `INSERT INTO sitios (cliente, contacto, whatsapp, fecha_demo, paquete, link_demo, link_sitio, etapa, monto, moneda, notas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          cliente,
          contacto || '',
          telefono || '',       // whatsapp = telefono del lead USA
          fecha_demo || '',
          'por_elegir',         // paquete se elige en la demo
          link_demo || '',
          link_sitio || '',
          'demo_agendado',
          monto || null,
          'USD',
          notas ? `[USA] ${ciudad || ''} ${estado || ''} · ${notas}` : `[USA] ${ciudad || ''} ${estado || ''}`.trim()
        );
        sitioCreado = db.prepare('SELECT * FROM sitios WHERE id = ?').get(ins.lastInsertRowid);
      }
    }

    return Response.json({ ...sitio, sitioCreado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    await db.prepare('DELETE FROM sitios_usa WHERE id = ?').run(params.id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
