export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

// GET ?mes=YYYY-MM  → all payment records for that month (joined with gasto info)
export function GET(request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);

  // Get all gastos_fijos with their pago status for this period
  const gastos = db.prepare(`SELECT * FROM gastos_fijos ORDER BY id`).all();

  const result = [];
  for (const g of gastos) {
    if (g.frecuencia === 'semanal') {
      // Generate 4 weekly slots for the month
      for (let w = 1; w <= 4; w++) {
        const periodo = `${mes}-W${w}`;
        const pago = db.prepare(`SELECT * FROM pagos_gastos_fijos WHERE gasto_id=? AND periodo=?`).get(g.id, periodo);
        result.push({ ...g, periodo, semana: w, pagado: pago?.pagado || 0, fecha_pago: pago?.fecha_pago || null, pago_id: pago?.id || null });
      }
    } else {
      const periodo = mes;
      const pago = db.prepare(`SELECT * FROM pagos_gastos_fijos WHERE gasto_id=? AND periodo=?`).get(g.id, periodo);
      result.push({ ...g, periodo, semana: null, pagado: pago?.pagado || 0, fecha_pago: pago?.fecha_pago || null, pago_id: pago?.id || null });
    }
  }
  return Response.json(result);
}

// POST { gasto_id, periodo, pagado, fecha_pago } → upsert
export async function POST(req) {
  const db = getDb();
  const { gasto_id, periodo, pagado, fecha_pago } = await req.json();

  const existing = db.prepare(`SELECT id FROM pagos_gastos_fijos WHERE gasto_id=? AND periodo=?`).get(gasto_id, periodo);
  if (existing) {
    db.prepare(`UPDATE pagos_gastos_fijos SET pagado=?, fecha_pago=? WHERE id=?`).run(pagado ? 1 : 0, fecha_pago || null, existing.id);
    return Response.json(db.prepare('SELECT * FROM pagos_gastos_fijos WHERE id=?').get(existing.id));
  }
  const result = db.prepare(`INSERT INTO pagos_gastos_fijos (gasto_id, periodo, pagado, fecha_pago) VALUES (?,?,?,?)`).run(gasto_id, periodo, pagado ? 1 : 0, fecha_pago || null);
  return Response.json(db.prepare('SELECT * FROM pagos_gastos_fijos WHERE id=?').get(result.lastInsertRowid), { status: 201 });
}
