export const dynamic = 'force-dynamic';
import { execSync, spawn } from 'child_process';

function isRunning() {
  try {
    const out = execSync('pgrep -f agente_research_usa.py 2>/dev/null', { encoding: 'utf8' }).trim();
    return out ? parseInt(out.split('\n')[0]) : null;
  } catch { return null; }
}

export async function POST(request) {
  try {
    const existingPid = isRunning();
    if (existingPid) {
      return Response.json({ error: 'El agente ya está corriendo', pid: existingPid }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const niche = body.niche || 'nail salon';
    const limit = body.limit || 50;

    const child = spawn(
      'python3',
      [
        '/Users/papaspichones/tigre-command-center/scripts/agente_research_usa.py',
        '--niche', niche,
        '--limit', String(limit),
      ],
      {
        detached: true,
        stdio: 'ignore',
      }
    );
    child.unref();

    return Response.json({
      ok: true,
      pid: child.pid,
      niche,
      limit,
      message: `Agente iniciado — buscando ${limit} leads de "${niche}"`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const pid = isRunning();
    if (!pid) return Response.json({ error: 'El agente no está corriendo' }, { status: 404 });
    execSync(`kill ${pid}`);
    return Response.json({ ok: true, killed: pid });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
