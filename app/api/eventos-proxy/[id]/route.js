export const dynamic = 'force-dynamic';

const YAO = 'http://localhost:3001';

export async function PUT(request, { params }) {
  try {
    const body = await request.json();
    const r = await fetch(`${YAO}/api/eventos/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    return Response.json(await r.json(), { status: r.status });
  } catch (err) {
    return Response.json({ error: 'YAO offline: ' + err.message }, { status: 503 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const r = await fetch(`${YAO}/api/eventos/${params.id}`, {
      method: 'DELETE',
      cache: 'no-store',
    });
    return Response.json(await r.json(), { status: r.status });
  } catch (err) {
    return Response.json({ error: 'YAO offline: ' + err.message }, { status: 503 });
  }
}
