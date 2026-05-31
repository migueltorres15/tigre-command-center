export const dynamic = 'force-dynamic';

const YAO = 'http://localhost:3001';

async function yaoFetch(path) {
  const r = await fetch(`${YAO}${path}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`YAO responded ${r.status} on ${path}`);
  return r.json();
}

// GET /api/yao-proxy?resource=summary&mes=YYYY-MM
// GET /api/yao-proxy?resource=tareas|gastos|deudas|ventas
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource') || 'summary';
  const mes = searchParams.get('mes') || new Date().toISOString().slice(0, 7);

  try {
    if (resource === 'summary') {
      const [tareas, gastos, deudas, ventas] = await Promise.all([
        yaoFetch('/api/tareas'),
        yaoFetch('/api/gastos'),
        yaoFetch('/api/deudas'),
        yaoFetch('/api/ventas'),
      ]);
      const ventasMes = Array.isArray(ventas) ? ventas.filter(v => (v.date || '').startsWith(mes)) : [];
      const totalVentas = ventasMes.reduce((s, v) => s + (v.ing || 0), 0);
      const totalGastos = Array.isArray(gastos) ? gastos.reduce((s, g) => s + (g.monto || 0), 0) : 0;
      const tareasUrgentes = Array.isArray(tareas) ? tareas.filter(t => t.tag === 'urgente' && !t.completada).length : 0;
      return Response.json({
        tareas: tareas || [],
        gastos: gastos || [],
        deudas: deudas || [],
        ventas: ventas || [],
        ventasMes,
        totalVentas,
        totalGastos,
        cobertura: totalGastos > 0 ? Math.round((totalVentas / totalGastos) * 100) : 0,
        utilidad: totalVentas - totalGastos,
        tareasUrgentes,
        online: true,
      });
    }

    if (resource === 'tareas')   return Response.json(await yaoFetch('/api/tareas'));
    if (resource === 'gastos')   return Response.json(await yaoFetch('/api/gastos'));
    if (resource === 'deudas')   return Response.json(await yaoFetch('/api/deudas'));
    if (resource === 'ventas')   return Response.json(await yaoFetch('/api/ventas'));
    if (resource === 'eventos')  return Response.json(await yaoFetch('/api/eventos'));

    return Response.json({ error: 'Unknown resource' }, { status: 400 });
  } catch (err) {
    if (resource === 'summary') {
      return Response.json({
        tareas: [], gastos: [], deudas: [], ventas: [], ventasMes: [],
        totalVentas: 0, totalGastos: 35400, cobertura: 0, utilidad: -35400,
        tareasUrgentes: 0, online: false, error: err.message,
      });
    }
    return Response.json({ error: 'YAO offline: ' + err.message }, { status: 503 });
  }
}

// POST /api/yao-proxy?resource=tareas  → create task in YAO
export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get('resource');
  if (!resource) return Response.json({ error: 'resource required' }, { status: 400 });

  try {
    const body = await request.json();
    const r = await fetch(`${YAO}/api/${resource}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return Response.json(await r.json(), { status: r.status });
  } catch (err) {
    return Response.json({ error: 'YAO offline: ' + err.message }, { status: 503 });
  }
}
