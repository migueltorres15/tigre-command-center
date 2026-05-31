export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function PUT(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();
    const {
      cliente, contacto, whatsapp, fecha_demo, hora_demo, paquete,
      link_demo, link_sitio, etapa, monto, moneda, notas, status,
    } = body;

    const existing = db.prepare('SELECT * FROM sitios WHERE id = ?').get(id);
    if (!existing) return Response.json({ error: 'Sitio no encontrado' }, { status: 404 });

    db.prepare(
      `UPDATE sitios SET
        cliente    = COALESCE(?, cliente),
        contacto   = COALESCE(?, contacto),
        whatsapp   = COALESCE(?, whatsapp),
        fecha_demo = COALESCE(?, fecha_demo),
        hora_demo  = COALESCE(?, hora_demo),
        paquete    = COALESCE(?, paquete),
        link_demo  = COALESCE(?, link_demo),
        link_sitio = COALESCE(?, link_sitio),
        etapa      = COALESCE(?, etapa),
        status     = COALESCE(?, status),
        monto      = COALESCE(?, monto),
        moneda     = COALESCE(?, moneda),
        notas      = COALESCE(?, notas)
       WHERE id = ?`
    ).run(
      cliente || null, contacto || null, whatsapp || null, fecha_demo || null,
      hora_demo !== undefined ? (hora_demo || null) : null,
      paquete || null, link_demo || null, link_sitio || null, etapa || null,
      status || null, monto !== undefined ? monto : null, moneda || null,
      notas !== undefined ? notas : null, id
    );

    const updated = db.prepare('SELECT * FROM sitios WHERE id = ?').get(id);
    const tareas  = db.prepare('SELECT * FROM sitio_tareas WHERE sitio_id = ? ORDER BY created_at ASC').all(id);

    // ── Auto-registrar ingreso cuando etapa cambia a 'pagado' ────────────────
    if (updated.etapa === 'pagado' && existing.etapa !== 'pagado' && updated.monto) {
      const fechaHoy = new Date().toISOString().slice(0, 10);
      db.prepare(
        `INSERT INTO ingresos (proyecto, descripcion, monto, moneda, fecha) VALUES (?,?,?,?,?)`
      ).run(
        'Sitios Web',
        `Sitio web — ${updated.cliente}`,
        updated.monto,
        updated.moneda || 'MXN',
        fechaHoy
      );
    }

    // ── Auto-crear/actualizar sesión en calendario cuando demo es agendado ───
    // Solo cuando fecha_demo es formato ISO YYYY-MM-DD (de date picker)
    if (updated.etapa === 'demo_agendado' && updated.fecha_demo && /^\d{4}-\d{2}-\d{2}$/.test(updated.fecha_demo)) {
      const existeSesion = db.prepare(
        `SELECT id FROM sesiones WHERE tipo = 'Demo Sitio Web' AND cliente = ?`
      ).get(updated.cliente);

      if (existeSesion) {
        db.prepare(`UPDATE sesiones SET fecha = ? WHERE id = ?`)
          .run(updated.fecha_demo, existeSesion.id);
      } else {
        db.prepare(
          `INSERT INTO sesiones (cliente, tipo, fecha, status, notas) VALUES (?,?,?,?,?)`
        ).run(updated.cliente, 'Demo Sitio Web', updated.fecha_demo, 'confirmado', '');
      }
    }

    return Response.json({ ...updated, tareas });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = await params;
    const existing = db.prepare('SELECT * FROM sitios WHERE id = ?').get(id);
    if (!existing) return Response.json({ error: 'Sitio no encontrado' }, { status: 404 });
    db.prepare('DELETE FROM sitios WHERE id = ?').run(id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
