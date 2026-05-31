export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

// Pulls salary records from YAO (localhost:3001) and saves them as ingresos in Tigre CC
export async function POST() {
  try {
    // Fetch salaries from YAO — server-side, no CORS issues
    const res = await fetch('http://localhost:3001/api/sueldo', { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo conectar con YAO (localhost:3001)');
    const salarios = await res.json();

    if (!Array.isArray(salarios) || salarios.length === 0) {
      return Response.json({ synced: 0, message: 'No hay sueldos registrados en YAO' });
    }

    const db = getDb();
    let synced = 0;
    let skipped = 0;

    for (const sal of salarios) {
      const fechaIngreso = `${sal.mes}-01`; // primer día del mes

      // Check if already synced: look for ingreso with proyecto=YAO and same month
      const existing = db.prepare(
        `SELECT id FROM ingresos WHERE proyecto = 'YAO' AND strftime('%Y-%m', fecha) = ?`
      ).get(sal.mes);

      if (existing) {
        // Update the amount in case it changed
        db.prepare(`UPDATE ingresos SET monto = ?, descripcion = ?, fecha = ? WHERE id = ?`)
          .run(sal.monto, sal.nota || 'Sueldo YAO', fechaIngreso, existing.id);
        skipped++;
      } else {
        db.prepare(
          `INSERT INTO ingresos (proyecto, descripcion, monto, moneda, fecha) VALUES ('YAO', ?, ?, 'MXN', ?)`
        ).run(sal.nota || 'Sueldo YAO', sal.monto, fechaIngreso);
        synced++;
      }
    }

    // Mark all as synced back in YAO
    await fetch('http://localhost:3001/api/sueldo/mark-synced', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {}); // best-effort

    return Response.json({
      ok: true,
      synced,
      updated: skipped,
      total: salarios.length,
      message: `${synced} registros nuevos, ${skipped} actualizados`,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
