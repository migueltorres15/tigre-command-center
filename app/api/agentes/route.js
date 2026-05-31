import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

export const dynamic = 'force-dynamic';

function findLatestLog(pattern) {
  try {
    const path = execSync(`ls -t ${pattern} 2>/dev/null | head -1`, { encoding: 'utf8' }).trim();
    return path || null;
  } catch { return null; }
}

function getResearchUSAStats() {
  try {
    const backup = findLatestLog('/Users/papaspichones/Library/Logs/usa-leads-*.json');
    if (!backup) return { leadsHoy: 0, ciudades: '—' };
    const data = JSON.parse(readFileSync(backup, 'utf8'));
    const ciudades = [...new Set(data.map(r => r.city))].join(', ');
    return { leadsHoy: data.length, ciudades: ciudades || '—' };
  } catch { return { leadsHoy: 0, ciudades: '—' }; }
}

function isResearchUSARunning() {
  try {
    const out = execSync('pgrep -f agente_research_usa.py 2>/dev/null', { encoding: 'utf8' }).trim();
    return out ? parseInt(out.split('\n')[0]) : null;
  } catch { return null; }
}

const AGENTS = [
  {
    id: 'agente-research-usa',
    label: '🇺🇸 Research USA',
    description: 'Busca nail salons y negocios sin website en 15 ciudades de USA. Deposita leads en Google Sheets.',
    plist: null, // se corre manual / programado
    logPattern: '/Users/papaspichones/Library/Logs/tigre-usa-leads-*.log',
    schedule: 'Manual · 8:00 AM',
    type: 'scheduled',
    color: '#3B82F6',
    isUSAResearch: true,
    controllable: true,
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c',
  },
  {
    id: 'agente-leads',
    label: '🔍 Buscador de Leads MX',
    description: 'Busca negocios sin sitio web en Google Maps BCS y los escribe al CRM Sheet.',
    plist: 'mx.tigrestudio.agente-leads',
    log: '/Users/papaspichones/Library/Logs/tigre-agente-leads.log',
    schedule: 'Lun–Vie 7:00 AM',
    type: 'scheduled',
    color: '#6366F1',
    controllable: true,
  },
  {
    id: 'agente-enrichment',
    label: '🔍 Email Enrichment',
    description: 'Busca emails de los leads sin contacto en Google y Yelp. Corre antes del Cold Email.',
    plist: null,
    log: '/Users/papaspichones/Library/Logs/tigre-email-enrichment.log',
    logPattern: null,
    schedule: 'Manual · antes de cold email',
    type: 'scheduled',
    color: '#8B5CF6',
    controllable: true,
    isScript: true,
    scriptPath: '/Users/papaspichones/tigre-command-center/scripts/agente_email_enrichment.py',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c',
  },
  {
    id: 'warming-day3',
    label: '📧 Cold Email USA',
    description: 'Lee leads con email del Sheet, genera email personalizado y lo envía desde hola@tigrestudio.mx. Límite: 20/día.',
    plist: null,
    log: '/Users/papaspichones/Library/Logs/tigre-cold-email-usa.log',
    schedule: 'Manual · después de enrichment',
    type: 'scheduled',
    color: '#F59E0B',
    controllable: true,
    isScript: true,
    scriptPath: '/Users/papaspichones/tigre-command-center/scripts/agente_cold_email_usa.py',
    sheetUrl: 'https://docs.google.com/spreadsheets/d/1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c',
  },
  {
    id: 'fix-spam',
    label: '🛡️ Anti-Spam',
    description: 'Revisa y clasifica emails de spam/bounce cada hora.',
    plist: 'mx.tigrestudio.fix-spam',
    log: '/Users/papaspichones/Library/Logs/tigre-fix-spam.log',
    schedule: 'Cada 1 hora',
    type: 'interval',
    color: '#10B981',
    controllable: true,
  },
  {
    id: 'tigre-cc',
    label: '⚡ Tigre Command Center',
    description: 'Servidor Next.js del Command Center (puerto 3000). Se inicia al arrancar sesión.',
    plist: 'mx.tigrestudio.tigre-cc',
    log: null,
    schedule: 'Al iniciar sesión',
    type: 'startup',
    color: '#8B5CF6',
    controllable: true,
  },
  {
    id: 'yao-cc',
    label: '🍶 YAO Dashboard',
    description: 'Servidor Next.js del dashboard de YAO Baja (puerto 3001). Se inicia al arrancar sesión.',
    plist: 'mx.tigrestudio.yao-cc',
    log: null,
    schedule: 'Al iniciar sesión',
    type: 'startup',
    color: '#F59E0B',
    controllable: true,
  },
];

function getLaunchctlStatus(label) {
  try {
    const out = execSync(`launchctl list 2>/dev/null | grep "${label}"`, { encoding: 'utf8' }).trim();
    if (!out) return { loaded: false, pid: null, exitCode: null };
    const parts = out.split(/\s+/);
    const pid = parts[0] === '-' ? null : parseInt(parts[0]);
    const exitCode = parts[1] === '-' ? 0 : parseInt(parts[1]);
    return { loaded: true, pid, exitCode };
  } catch {
    return { loaded: false, pid: null, exitCode: null };
  }
}

function getLogTail(logPath, lines = 30) {
  if (!logPath || !existsSync(logPath)) return null;
  try {
    return execSync(`tail -n ${lines} "${logPath}"`, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

function getLogMtime(logPath) {
  if (!logPath || !existsSync(logPath)) return null;
  try {
    const stat = execSync(`stat -f "%m" "${logPath}"`, { encoding: 'utf8' }).trim();
    return new Date(parseInt(stat) * 1000).toISOString();
  } catch {
    return null;
  }
}

function getLastSuccess(logContent) {
  if (!logContent) return null;
  // Look for success indicators in log
  const lines = logContent.split('\n').reverse();
  for (const line of lines) {
    if (line.includes('✅') || line.includes('completado') || line.includes('OK') || line.includes('enviados')) {
      return line.trim();
    }
  }
  return null;
}

export async function GET() {
  const agents = AGENTS.map(agent => {
    // ── USA Research agent — status basado en pgrep, no launchctl ──
    if (agent.isUSAResearch) {
      const runningPid = isResearchUSARunning();
      const logPath = findLatestLog(agent.logPattern);
      const logContent = getLogTail(logPath);
      const logMtime = getLogMtime(logPath);
      const lastSuccess = getLastSuccess(logContent);
      const stats = getResearchUSAStats();

      return {
        ...agent,
        log: { path: logPath },
        status: {
          loaded: true,
          pid: runningPid,
          exitCode: 0,
          label: runningPid ? 'Ejecutándose' : 'Listo',
          color: runningPid ? 'yellow' : 'green',
        },
        log: {
          tail: logContent,
          lastModified: logMtime,
          lastSuccess,
        },
        stats,
      };
    }

    // ── Agentes launchctl normales ──
    const launchctl = getLaunchctlStatus(agent.plist);
    const logContent = getLogTail(agent.log);
    const logMtime = getLogMtime(agent.log);
    const lastSuccess = getLastSuccess(logContent);

    let statusLabel, statusColor;
    if (!launchctl.loaded) {
      statusLabel = 'No cargado';
      statusColor = 'red';
    } else if (launchctl.exitCode !== 0 && launchctl.exitCode !== null) {
      statusLabel = `Error (exit ${launchctl.exitCode})`;
      statusColor = 'yellow';
    } else {
      statusLabel = launchctl.pid ? 'Ejecutándose' : 'OK';
      statusColor = 'green';
    }

    return {
      ...agent,
      status: {
        loaded: launchctl.loaded,
        pid: launchctl.pid,
        exitCode: launchctl.exitCode,
        label: statusLabel,
        color: statusColor,
      },
      log: {
        tail: logContent,
        lastModified: logMtime,
        lastSuccess,
      },
    };
  });

  return Response.json({ agents, ts: new Date().toISOString() });
}
