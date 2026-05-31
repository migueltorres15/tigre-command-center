'use client';

import { useEffect, useState, useCallback } from 'react';

const STATUS_COLORS = {
  green:  { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#10B981', dot: '#10B981' },
  yellow: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  text: '#F59E0B', dot: '#F59E0B' },
  red:    { bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   text: '#EF4444', dot: '#EF4444' },
};

const TYPE_LABELS = {
  scheduled: '⏰ Programado',
  interval:  '🔄 Intervalo',
  startup:   '🚀 Arranque',
};

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) +
    ' ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function LogViewer({ logText, agentColor }) {
  const [open, setOpen] = useState(false);
  if (!logText) return <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sin log disponible</span>;

  const lines = logText.trim().split('\n').slice(-20);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text2)', fontSize: 12, padding: '4px 0',
          display: 'flex', alignItems: 'center', gap: 5,
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? '▼' : '▶'}</span>
        {open ? 'Ocultar log' : 'Ver últimas líneas'}
      </button>
      {open && (
        <div style={{
          marginTop: 8,
          background: '#0D0D0D',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: '10px 12px',
          fontFamily: 'monospace',
          fontSize: 11,
          lineHeight: 1.6,
          color: '#9CA3AF',
          maxHeight: 220,
          overflowY: 'auto',
        }}>
          {lines.map((line, i) => {
            let color = '#9CA3AF';
            if (line.includes('✅') || line.includes('completado') || line.includes('OK')) color = '#10B981';
            else if (line.includes('⚠') || line.includes('Error') || line.includes('error')) color = '#F59E0B';
            else if (line.includes('❌') || line.includes('FAIL')) color = '#EF4444';
            else if (line.includes('→') || line.includes('⏳')) color = '#6366F1';
            return (
              <div key={i} style={{ color }}>
                {line || ' '}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onRefresh }) {
  const sc = STATUS_COLORS[agent.status.color] || STATUS_COLORS.red;
  const [running, setRunning] = useState(!!agent.status.pid);
  const [launching, setLaunching] = useState(false);
  const [msg, setMsg] = useState(null);

  const showMsg = (text, isErr) => {
    setMsg({ text, isErr });
    setTimeout(() => setMsg(null), 4000);
  };

  const runNow = async () => {
    if (running || launching) return;
    setLaunching(true);
    try {
      const body = agent.isUSAResearch
        ? JSON.stringify({ niche: 'nail salon', limit: 50 })
        : '{}';
      const res = await fetch(`/api/agentes/${agent.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const data = await res.json();
      if (data.ok) {
        setRunning(true);
        showMsg('✅ ' + (data.message || 'Iniciado'));
        setTimeout(onRefresh, 3000);
      } else {
        showMsg('⚠️ ' + (data.error || 'Error al iniciar'), true);
      }
    } catch (e) { showMsg('Error de red', true); }
    finally { setLaunching(false); }
  };

  const stopNow = async () => {
    if (!running) return;
    try {
      const res = await fetch(`/api/agentes/${agent.id}`, { method: 'DELETE' });
      const data = await res.json();
      setRunning(false);
      showMsg(data.ok ? '⏹ Detenido' : ('⚠️ ' + data.error));
      setTimeout(onRefresh, 1000);
    } catch (e) { showMsg('Error de red', true); }
  };

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${sc.border}`,
      borderRadius: 14,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Accent bar top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 3, background: agent.color, borderRadius: '14px 14px 0 0',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 3 }}>
            {agent.label}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>
            {agent.description}
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: sc.bg, border: `1px solid ${sc.border}`,
          borderRadius: 20, padding: '4px 10px',
          flexShrink: 0, marginLeft: 12,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: sc.dot,
            boxShadow: agent.status.color === 'green' ? `0 0 6px ${sc.dot}` : 'none',
            animation: (agent.status.pid || running) ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: sc.text }}>
            {running ? 'Ejecutándose' : agent.status.label}
          </span>
        </div>
      </div>

      {/* Stats row — solo para USA Research */}
      {agent.isUSAResearch && agent.stats && (
        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap',
        }}>
          <div style={{
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 8, padding: '8px 14px', flex: 1, minWidth: 100,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#3B82F6', lineHeight: 1 }}>
              {agent.stats.leadsHoy}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>
              Leads último batch
            </div>
          </div>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 14px', flex: 2, minWidth: 160,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text1)', lineHeight: 1.3 }}>
              {agent.stats.ciudades || '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 3 }}>
              Ciudades escaneadas
            </div>
          </div>
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Tipo</span>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{TYPE_LABELS[agent.type] || agent.type}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Horario</span>
          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500 }}>{agent.schedule}</span>
        </div>
        {(agent.status.pid || running) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>PID</span>
            <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>{agent.status.pid || '—'}</span>
          </div>
        )}
        {agent.log.lastModified && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Último log</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{fmtDate(agent.log.lastModified)}</span>
          </div>
        )}
      </div>

      {/* Last success */}
      {agent.log.lastSuccess && (
        <div style={{
          background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.18)',
          borderRadius: 7, padding: '7px 10px',
          fontSize: 12, color: '#10B981', fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {agent.log.lastSuccess}
        </div>
      )}

      {/* Log viewer */}
      <LogViewer logText={agent.log.tail} agentColor={agent.color} />

      {/* Toast message */}
      {msg && (
        <div style={{
          padding: '7px 12px', borderRadius: 7, fontSize: 12,
          background: msg.isErr ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${msg.isErr ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          color: msg.isErr ? '#EF4444' : '#10B981',
        }}>
          {msg.text}
        </div>
      )}

      {/* Botones de acción — todos los agentes controllable */}
      {agent.controllable && (
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          {/* Sheet link — solo si tiene sheetUrl */}
          {agent.sheetUrl && (
            <a
              href={agent.sheetUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                flex: 1, textAlign: 'center', padding: '8px 0',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 12, color: 'var(--text2)',
                textDecoration: 'none', cursor: 'pointer',
              }}
            >
              📊 Ver Sheet
            </a>
          )}

          {/* Stop / Run button */}
          {running ? (
            <button
              onClick={stopNow}
              style={{
                flex: 2, padding: '8px 0',
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 8, fontSize: 12, fontWeight: 600,
                color: '#EF4444', cursor: 'pointer',
              }}
            >
              ⏹ Detener
            </button>
          ) : (
            <button
              onClick={runNow}
              disabled={launching}
              style={{
                flex: 2, padding: '8px 0',
                background: launching ? 'var(--bg2)' : `${agent.color}22`,
                border: `1px solid ${launching ? 'var(--border)' : agent.color + '66'}`,
                borderRadius: 8, fontSize: 12, fontWeight: 600,
                color: launching ? 'var(--text3)' : agent.color,
                cursor: launching ? 'not-allowed' : 'pointer',
              }}
            >
              {launching ? '⏳ Iniciando...' : '▶ Correr ahora'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agentes', { cache: 'no-store' });
      const json = await res.json();
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [autoRefresh, load]);

  const agents = data?.agents || [];
  const ok      = agents.filter(a => a.status.color === 'green').length;
  const warning = agents.filter(a => a.status.color === 'yellow').length;
  const err     = agents.filter(a => a.status.color === 'red').length;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Agentes</h1>
          <p className="page-subtitle">
            Automatizaciones activas · {agents.length} agentes
            {lastRefresh && (
              <span style={{ marginLeft: 10, opacity: 0.5 }}>
                · Actualizado {lastRefresh.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: '#6366F1' }}
            />
            Auto-refresh 30s
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            {loading ? '⏳ Cargando...' : '🔄 Actualizar'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Funcionando', value: ok,      color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
          { label: 'Con aviso',   value: warning,  color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
          { label: 'Error',       value: err,      color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)' },
          { label: 'Total',       value: agents.length, color: 'var(--text1)', bg: 'var(--surface)', border: 'var(--border)' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 10, padding: '10px 18px',
            display: 'flex', flexDirection: 'column', gap: 2, minWidth: 90,
          }}>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{s.label}</span>
          </div>
        ))}

        {/* Pending agents notice */}
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 10, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260,
        }}>
          <span style={{ fontSize: 20 }}>📧</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>Cold Email USA — en construcción</div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>El script de envío se está reescribiendo sobre la infraestructura de warming</div>
          </div>
        </div>
      </div>

      {/* Agent cards grid */}
      {loading && !data ? (
        <div className="loading">Cargando agentes...</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
          gap: 16,
        }}>
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onRefresh={load} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
