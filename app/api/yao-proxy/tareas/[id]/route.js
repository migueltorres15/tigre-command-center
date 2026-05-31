export const dynamic = 'force-dynamic';

const YAO = 'http://localhost:3001';

// PUT /api/yao-proxy/tareas/[id]  → toggle / edit task in YAO
export async function PUT(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    const r = await fetch(`${YAO}/api/tareas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return Response.json(await r.json());
  } catch (err) {
    return Response.json({ error: 'YAO offline: ' + err.message }, { status: 503 });
  }
}

// DELETE /api/yao-proxy/tareas/[id]  → delete task from YAO
export async function DELETE(request, { params }) {
  const { id } = params;
  try {
    const r = await fetch(`${YAO}/api/tareas/${id}`, { method: 'DELETE', cache: 'no-store' });
    return Response.json(await r.json());
  } catch (err) {
    return Response.json({ error: 'YAO offline: ' + err.message }, { status: 503 });
  }
}
