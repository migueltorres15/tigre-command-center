export const dynamic = 'force-dynamic';
import { getDb } from '@/lib/db';

const ACTIVE_LEAD_STATUSES   = ['nuevo', 'contactado', 'en_proceso', 'caliente', 'confirmado'];
const ACTIVE_SITIO_STATUSES  = ['nuevo', 'contactado', 'en_proceso', 'confirmado'];
const ACTIVE_SESION_STATUSES = ['pendiente', 'confirmado', 'en_proceso'];

const TAG_ORDER = { urgente: 0, hoy: 1, pendiente: 2, completada: 3 };
const TAG_LABEL = { urgente: 'URGENTE', hoy: 'HOY', pendiente: 'PENDIENTE' };

function fmtMonto(monto, moneda = 'MXN') {
  return `$${Number(monto || 0).toLocaleString('es-MX', { minimumFractionDigits: 0 })} ${moneda}`;
}

function line(char = '─', len = 48) {
  return char.repeat(len);
}

export async function GET() {
  const db  = getDb();
  const now = new Date();
  const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fechaHoy = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const lines = [];
  const push  = (...args) => lines.push(...args);

  // ── Header ──────────────────────────────────────────────────────────────────
  push(
    '╔══════════════════════════════════════════════════╗',
    '║        TIGRE COMMAND CENTER — CONTEXTO           ║',
    '╚══════════════════════════════════════════════════╝',
    `Generado: ${fechaHoy}`,
    '',
  );

  // ── 1. Tareas por proyecto ──────────────────────────────────────────────────
  push('=== TAREAS POR PROYECTO ===', '');

  const tareas = db.prepare(`SELECT * FROM tareas ORDER BY proyecto, completada ASC, id ASC`).all();
  const porProyecto = {};
  for (const t of tareas) {
    const p = t.proyecto || 'Sin proyecto';
    (porProyecto[p] = porProyecto[p] || []).push(t);
  }

  for (const [proyecto, items] of Object.entries(porProyecto)) {
    push(`[${proyecto.toUpperCase()}]`);
    const sorted = [...items].sort((a, b) => {
      if (a.completada !== b.completada) return a.completada - b.completada;
      return (TAG_ORDER[a.tag] ?? 9) - (TAG_ORDER[b.tag] ?? 9);
    });
    for (const t of sorted) {
      if (t.completada) {
        push(`  ✓ ${t.texto}`);
      } else {
        const label = TAG_LABEL[t.tag] || t.tag?.toUpperCase() || 'PENDIENTE';
        push(`  [${label}] ${t.texto}`);
      }
    }
    push('');
  }

  // ── 2. Clientes activos ─────────────────────────────────────────────────────
  push('=== CLIENTES ACTIVOS ===', '');

  // Leads (Studio)
  const leads = db.prepare(
    `SELECT * FROM leads WHERE status IN (${ACTIVE_LEAD_STATUSES.map(() => '?').join(',')}) ORDER BY id`
  ).all(...ACTIVE_LEAD_STATUSES);

  if (leads.length) {
    push('— TIGRE STUDIO / LEADS —');
    for (const l of leads) {
      const monto  = l.monto ? ` — ${fmtMonto(l.monto, l.moneda)}` : '';
      const status = l.status.replace('_', ' ').toUpperCase();
      const notas  = l.notas ? ` | ${l.notas}` : '';
      push(`  • ${l.nombre}${monto} — ${status}${notas}`);
    }
    push('');
  }

  // Sitios
  const sitios = db.prepare(
    `SELECT * FROM sitios WHERE status IN (${ACTIVE_SITIO_STATUSES.map(() => '?').join(',')}) ORDER BY id`
  ).all(...ACTIVE_SITIO_STATUSES);

  if (sitios.length) {
    push('— SITIOS WEB —');
    for (const s of sitios) {
      const monto  = s.monto ? ` — ${fmtMonto(s.monto, s.moneda)}` : '';
      const status = s.status.replace('_', ' ').toUpperCase();
      const notas  = s.notas ? ` | ${s.notas}` : '';
      push(`  • ${s.cliente}${monto} — ${status}${notas}`);
    }
    push('');
  }

  // Sesiones (Fotografía)
  const sesiones = db.prepare(
    `SELECT * FROM sesiones WHERE status IN (${ACTIVE_SESION_STATUSES.map(() => '?').join(',')}) ORDER BY fecha`
  ).all(...ACTIVE_SESION_STATUSES);

  if (sesiones.length) {
    push('— FOTOGRAFÍA / SESIONES —');
    for (const s of sesiones) {
      const monto  = s.monto ? ` — ${fmtMonto(s.monto, s.moneda)}` : '';
      const status = s.status.toUpperCase();
      const fecha  = s.fecha ? ` | Fecha: ${s.fecha}` : '';
      const notas  = s.notas ? ` | ${s.notas}` : '';
      push(`  • ${s.cliente} (${s.tipo})${monto} — ${status}${fecha}${notas}`);
    }
    push('');
  }

  if (!leads.length && !sitios.length && !sesiones.length) {
    push('  (Sin clientes activos registrados)', '');
  }

  // ── 3. Ingresos confirmados del mes ─────────────────────────────────────────
  push(`=== INGRESOS CONFIRMADOS — ${mes} ===`, '');

  const ingresos = db.prepare(
    `SELECT * FROM ingresos WHERE strftime('%Y-%m', fecha) = ? ORDER BY fecha DESC`
  ).all(mes);

  if (ingresos.length) {
    for (const i of ingresos) {
      const desc = i.descripcion ? ` — ${i.descripcion}` : '';
      push(`  • [${i.proyecto}]${desc} — ${fmtMonto(i.monto, i.moneda)} (${i.fecha})`);
    }
    const totalMXN = ingresos.filter(i => i.moneda === 'MXN').reduce((s, i) => s + i.monto, 0);
    const totalUSD = ingresos.filter(i => i.moneda === 'USD').reduce((s, i) => s + i.monto, 0);
    push('');
    if (totalMXN) push(`  TOTAL MXN: ${fmtMonto(totalMXN, 'MXN')}`);
    if (totalUSD) push(`  TOTAL USD: ${fmtMonto(totalUSD, 'USD')}`);
  } else {
    push('  (Sin ingresos registrados este mes)');
  }
  push('');

  // ── 4. Deudas pendientes ────────────────────────────────────────────────────
  push('=== DEUDAS PENDIENTES ===', '');

  const deudas = db.prepare(`SELECT * FROM deudas WHERE pagada = 0 ORDER BY monto DESC`).all();

  if (deudas.length) {
    for (const d of deudas) {
      const tipo = d.tipo === 'mensual' ? ' [mensual]' : '';
      push(`  • ${d.nombre}${tipo} — ${fmtMonto(d.monto)}`);
    }
    const total = deudas.reduce((s, d) => s + d.monto, 0);
    push('', `  TOTAL DEUDA PENDIENTE: ${fmtMonto(total)}`);
  } else {
    push('  (Sin deudas pendientes 🎉)');
  }
  push('');

  // ── 5. YAO Baja (best-effort) ───────────────────────────────────────────────
  try {
    const yaoRes = await fetch(`http://localhost:3001/api/tareas`, { cache: 'no-store', signal: AbortSignal.timeout(2000) });
    if (yaoRes.ok) {
      const yaoTareas = await yaoRes.json();
      if (Array.isArray(yaoTareas) && yaoTareas.length) {
        push('=== YAO BAJA — TAREAS ===', '');
        const urgentes  = yaoTareas.filter(t => t.tag === 'urgente' && !t.completada);
        const pendientes = yaoTareas.filter(t => t.tag !== 'urgente' && !t.completada);
        const hechas     = yaoTareas.filter(t => t.completada);
        for (const t of urgentes)   push(`  [URGENTE] ${t.texto}`);
        for (const t of pendientes) push(`  [PENDIENTE] ${t.texto}`);
        for (const t of hechas)     push(`  ✓ ${t.texto}`);
        push('');
      }
    }
  } catch {
    // YAO offline — skip silently
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  push(
    line('─'),
    'Pega este texto en tu chat con Claude para contexto completo.',
    line('─'),
  );

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
