export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const now = new Date();
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const totalIngresosMesRow = db.prepare(
      `SELECT COALESCE(SUM(monto), 0) as total FROM ingresos WHERE strftime('%Y-%m', fecha) = ?`
    ).get(mes);

    const tareasUrgentesRow = db.prepare(
      `SELECT COUNT(*) as c FROM tareas WHERE tag='urgente' AND completada=0`
    ).get();

    const leadsCalientesRow = db.prepare(
      `SELECT COUNT(*) as c FROM leads WHERE status='caliente'`
    ).get();

    const sitiosEnProcesoRow = db.prepare(
      `SELECT COUNT(*) as c FROM sitios WHERE status='en_proceso'`
    ).get();

    const deudaTotalRow = db.prepare(
      `SELECT COALESCE(SUM(monto), 0) as total FROM deudas WHERE pagada=0`
    ).get();

    const deudas = db.prepare('SELECT * FROM deudas ORDER BY pagada ASC, id ASC').all();
    const gastos = db.prepare('SELECT * FROM gastos_fijos ORDER BY id ASC').all();

    // Últimos 6 meses de ingresos para gráfica
    const meses6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const ingresosPorMes = meses6.map(m => {
      const row = db.prepare(
        `SELECT COALESCE(SUM(monto),0) as total FROM ingresos WHERE strftime('%Y-%m', fecha)=?`
      ).get(m);
      return { mes: m, total: row.total };
    });

    // Ingresos por proyecto (mes actual)
    const ingresosPorProyecto = db.prepare(
      `SELECT proyecto, COALESCE(SUM(monto),0) as total FROM ingresos
       WHERE strftime('%Y-%m', fecha)=? GROUP BY proyecto`
    ).all(mes);

    // Productividad de tareas por proyecto
    const tareasPorProyecto = db.prepare(
      `SELECT proyecto,
        SUM(CASE WHEN completada=1 THEN 1 ELSE 0 END) as completadas,
        SUM(CASE WHEN completada=0 THEN 1 ELSE 0 END) as pendientes,
        COUNT(*) as total
       FROM tareas GROUP BY proyecto`
    ).all();

    // Deudas pagadas vs pendientes (montos)
    const deudaPagada = db.prepare(`SELECT COALESCE(SUM(monto),0) as total FROM deudas WHERE pagada=1`).get();
    const deudaPendiente = deudaTotalRow.total;

    // Leads a recontactar (USA pipeline)
    const recontactar = db.prepare(
      `SELECT id, cliente, contacto, telefono, ciudad, estado, follow_up_fecha, follow_up_nota, notas
       FROM sitios_usa WHERE etapa='recontactar' ORDER BY follow_up_fecha ASC`
    ).all();

    return Response.json({
      totalIngresosMes: totalIngresosMesRow.total,
      tareasUrgentes: tareasUrgentesRow.c,
      clientesActivos: leadsCalientesRow.c + sitiosEnProcesoRow.c,
      recontactar,
      deudaTotal: deudaTotalRow.total,
      metaMensual: 62250,
      gastosPersonales: 42250,
      metaAhorro: 20000,
      deudas,
      gastos,
      // Chart data
      ingresosPorMes,
      ingresosPorProyecto,
      tareasPorProyecto,
      deudaPagada: deudaPagada.total,
      deudaPendiente,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
