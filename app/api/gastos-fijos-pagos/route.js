export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

// GET ?mes=YYYY-MM
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);

    const gastos = await db.prepare(`SELECT * FROM gastos_fijos ORDER BY id`).all();
    const result = [];

    for (const g of gastos) {
      if (g.frecuencia === 'semanal') {
        for (let w = 1; w <= 4; w++) {
          const periodo = `${mes}-W${w}`;
          const pago = await db.prepare(
            `SELECT * FROM pagos_gastos_fijos WHERE gasto_id=? AND periodo=?`
          ).get(g.id, periodo);
          result.push({ ...g, periodo, semana: w, pagado: pago?.pagado || 0, fecha_pago: pago?.fecha_pago || null, pago_id: pago?.id || null });
        }
      } else {
        const periodo = mes;
        const pago = await db.prepare(
          `SELECT * FROM pagos_gastos_fijos WHERE gasto_id=? AND periodo=?`
        ).get(g.id, periodo);
        result.push({ ...g, periodo, semana: null, pagado: pago?.pagado || 0, fecha_pago: pago?.fecha_pago || null, pago_id: pago?.id || null });
      }
    }
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST { gasto_id, periodo, pagado, fecha_pago }
export async function POST(req) {
  try {
    const db = getDb();
    const { gasto_id, periodo, pagado, fecha_pago } = await req.json();

    const existing = await db.prepare(
      `SELECT id FROM pagos_gastos_fijos WHERE gasto_id=? AND periodo=?`
    ).get(gasto_id, periodo);

    if (existing) {
      await db.prepare(
        `UPDATE pagos_gastos_fijos SET pagado=?, fecha_pago=? WHERE id=?`
      ).run(pagado ? 1 : 0, fecha_pago || null, existing.id);
      const updated = await db.prepare('SELECT * FROM pagos_gastos_fijos WHERE id=?').get(existing.id);
      return Response.json(updated);
    }

    const result = await db.prepare(
      `INSERT INTO pagos_gastos_fijos (gasto_id, periodo, pagado, fecha_pago) VALUES (?,?,?,?)`
    ).run(gasto_id, periodo, pagado ? 1 : 0, fecha_pago || null);
    const created = await db.prepare('SELECT * FROM pagos_gastos_fijos WHERE id=?').get(result.lastInsertRowid);
    return Response.json(created, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
