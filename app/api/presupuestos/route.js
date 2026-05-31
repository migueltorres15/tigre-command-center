export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

// GET ?mes=YYYY-MM
// Returns each gasto_fijo that has a categoria_link, enriched with:
//   - gastado: total spent in that category this month
//   - restante: budget - gastado
//   - pct: percentage used
//   - proyeccion: end-of-month projection based on daily rate
export function GET(request) {
  const db = getDb();
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);

  // Gastos fijos que son presupuestos (tienen categoria_link)
  const presupuestos = db.prepare(
    "SELECT * FROM gastos_fijos WHERE categoria_link IS NOT NULL AND categoria_link != '' ORDER BY monto DESC"
  ).all();

  // Totales gastados por categoría en el mes
  const gastadoPorCat = db.prepare(
    "SELECT categoria, SUM(monto) as total FROM gastos_variables WHERE strftime('%Y-%m', fecha) = ? GROUP BY categoria"
  ).all(mes);
  const gastadoMap = Object.fromEntries(gastadoPorCat.map(g => [g.categoria, g.total || 0]));

  // Días del mes y días transcurridos
  const [year, month] = mes.split('-').map(Number);
  const diasEnMes = new Date(year, month, 0).getDate();
  const hoy = new Date();
  const esMesActual = hoy.getFullYear() === year && (hoy.getMonth() + 1) === month;
  const diasTranscurridos = esMesActual ? hoy.getDate() : diasEnMes;

  const result = presupuestos.map(p => {
    const gastado = gastadoMap[p.categoria_link] || 0;
    const restante = p.monto - gastado;
    const pct = p.monto > 0 ? Math.round(gastado / p.monto * 100) : 0;
    const tasaDiaria = diasTranscurridos > 0 ? gastado / diasTranscurridos : 0;
    const proyeccion = Math.round(tasaDiaria * diasEnMes);
    const diasRestantes = diasEnMes - diasTranscurridos;

    return {
      id: p.id,
      nombre: p.nombre,
      categoria_link: p.categoria_link,
      presupuesto: p.monto,
      gastado,
      restante,
      pct,
      proyeccion,
      tasaDiaria: Math.round(tasaDiaria),
      diasRestantes,
      diasTranscurridos,
      diasEnMes,
    };
  });

  return Response.json(result);
}

// PUT /api/presupuestos — update categoria_link on a gasto_fijo
export async function PUT(request) {
  try {
    const db = getDb();
    const { id, categoria_link } = await request.json();
    db.prepare('UPDATE gastos_fijos SET categoria_link = ? WHERE id = ?').run(categoria_link || '', id);
    return Response.json(db.prepare('SELECT * FROM gastos_fijos WHERE id = ?').get(id));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
