export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

// GET ?mes=YYYY-MM
export async function GET(request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);

    const presupuestos = await db.prepare(
      "SELECT * FROM gastos_fijos WHERE categoria_link IS NOT NULL AND categoria_link != '' ORDER BY monto DESC"
    ).all();

    const gastadoPorCat = await db.prepare(
      "SELECT categoria, SUM(monto) as total FROM gastos_variables WHERE strftime('%Y-%m', fecha) = ? GROUP BY categoria"
    ).all(mes);
    const gastadoMap = Object.fromEntries(gastadoPorCat.map(g => [g.categoria, g.total || 0]));

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
      return { id: p.id, nombre: p.nombre, categoria_link: p.categoria_link, presupuesto: p.monto, gastado, restante, pct, proyeccion, tasaDiaria: Math.round(tasaDiaria), diasRestantes, diasTranscurridos, diasEnMes };
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// PUT — update categoria_link on a gasto_fijo
export async function PUT(request) {
  try {
    const db = getDb();
    const { id, categoria_link } = await request.json();
    await db.prepare('UPDATE gastos_fijos SET categoria_link = ? WHERE id = ?').run(categoria_link || '', id);
    const updated = await db.prepare('SELECT * FROM gastos_fijos WHERE id = ?').get(id);
    return Response.json(updated);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
