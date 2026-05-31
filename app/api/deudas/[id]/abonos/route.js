export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET(request, { params }) {
  const db = getDb();
  const { id } = params;
  const abonos = await db.prepare('SELECT * FROM abonos WHERE deuda_id = ? ORDER BY fecha DESC').all(id);
  return Response.json(abonos);
}

export async function POST(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const { monto, fecha, nota = '' } = await request.json();

    if (!monto || monto <= 0) return Response.json({ error: 'monto inválido' }, { status: 400 });

    const deuda = await db.prepare('SELECT * FROM deudas WHERE id = ?').get(id);
    if (!deuda) return Response.json({ error: 'Deuda no encontrada' }, { status: 404 });

    // Insert abono
    const fechaStr = fecha || new Date().toISOString().slice(0, 10);
    await db.prepare('INSERT INTO abonos (deuda_id, monto, fecha, nota) VALUES (?, ?, ?, ?)').run(id, monto, fechaStr, nota);

    // Update acumulado en deudas
    const nuevoAbonado = (deuda.abonado || 0) + monto;
    const pagada = nuevoAbonado >= deuda.monto ? 1 : 0;
    await db.prepare('UPDATE deudas SET abonado = ?, pagada = ? WHERE id = ?').run(nuevoAbonado, pagada, id);

    const updated = await db.prepare('SELECT * FROM deudas WHERE id = ?').get(id);
    return Response.json(updated, { status: 201 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const db = getDb();
    const { id } = params;
    const url = new URL(request.url);
    const abonoId = url.searchParams.get('abonoId');
    if (!abonoId) return Response.json({ error: 'abonoId requerido' }, { status: 400 });

    const abono = await db.prepare('SELECT * FROM abonos WHERE id = ? AND deuda_id = ?').get(abonoId, id);
    if (!abono) return Response.json({ error: 'Abono no encontrado' }, { status: 404 });

    // Revertir del acumulado
    const deuda = await db.prepare('SELECT * FROM deudas WHERE id = ?').get(id);
    const nuevoAbonado = Math.max(0, (deuda.abonado || 0) - abono.monto);
    const pagada = nuevoAbonado >= deuda.monto ? 1 : 0;

    await db.prepare('DELETE FROM abonos WHERE id = ?').run(abonoId);
    await db.prepare('UPDATE deudas SET abonado = ?, pagada = ? WHERE id = ?').run(nuevoAbonado, pagada, id);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
