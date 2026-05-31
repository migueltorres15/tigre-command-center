export const dynamic = 'force-dynamic';
import { execSync, spawn } from 'child_process';

// Agent control config — indexed by agent id
const AGENT_CONTROLS = {
  'agente-research-usa': {
    type: 'script',
    script: '/Users/papaspichones/tigre-command-center/scripts/agente_research_usa.py',
    args: ['--niche', 'nail salon', '--limit', '50'],
    pgrep: 'agente_research_usa.py',
  },
  'agente-enrichment': {
    type: 'script',
    script: '/Users/papaspichones/tigre-command-center/scripts/agente_email_enrichment.py',
    args: ['--limit', '50'],
    pgrep: 'agente_email_enrichment.py',
  },
  'warming-day3': {
    type: 'script',
    script: '/Users/papaspichones/tigre-command-center/scripts/agente_cold_email_usa.py',
    args: ['--limit', '20'],
    pgrep: 'agente_cold_email_usa.py',
  },
  'agente-leads': {
    type: 'launchctl',
    plist: 'mx.tigrestudio.agente-leads',
  },
  'fix-spam': {
    type: 'launchctl',
    plist: 'mx.tigrestudio.fix-spam',
  },
  'tigre-cc': {
    type: 'launchctl',
    plist: 'mx.tigrestudio.tigre-cc',
  },
  'yao-cc': {
    type: 'launchctl',
    plist: 'mx.tigrestudio.yao-cc',
  },
};

function isScriptRunning(pgrepPattern) {
  try {
    const out = execSync(`pgrep -f "${pgrepPattern}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    return out ? parseInt(out.split('\n')[0]) : null;
  } catch { return null; }
}

export async function POST(request, { params }) {
  const { id } = params;
  const control = AGENT_CONTROLS[id];
  if (!control) {
    return Response.json({ error: `Agente desconocido: ${id}` }, { status: 404 });
  }

  try {
    if (control.type === 'script') {
      const existingPid = isScriptRunning(control.pgrep);
      if (existingPid) {
        return Response.json({ error: 'El agente ya está corriendo', pid: existingPid }, { status: 409 });
      }

      const body = await request.json().catch(() => ({}));
      const args = body.args || control.args || [];

      const child = spawn('python3', [control.script, ...args], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();

      return Response.json({ ok: true, pid: child.pid, message: 'Agente iniciado' });

    } else if (control.type === 'launchctl') {
      execSync(`launchctl start ${control.plist} 2>&1`, { encoding: 'utf8' });
      return Response.json({ ok: true, message: `Iniciado: ${control.plist}` });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = params;
  const control = AGENT_CONTROLS[id];
  if (!control) {
    return Response.json({ error: `Agente desconocido: ${id}` }, { status: 404 });
  }

  try {
    if (control.type === 'script') {
      const pid = isScriptRunning(control.pgrep);
      if (!pid) return Response.json({ error: 'El agente no está corriendo' }, { status: 404 });
      execSync(`kill ${pid}`);
      return Response.json({ ok: true, killed: pid });

    } else if (control.type === 'launchctl') {
      execSync(`launchctl stop ${control.plist} 2>&1`, { encoding: 'utf8' });
      return Response.json({ ok: true, message: `Detenido: ${control.plist}` });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
