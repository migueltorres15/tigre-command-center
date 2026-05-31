'use client';

import { useEffect, useState, useCallback } from 'react';

const mesStr = () => new Date().toISOString().slice(0, 7);

function fmt(n, mon = 'MXN') {
  return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${mon}`;
}

const TAG_COLOR = { urgente: '#EF4444', pendiente: '#F59E0B', completada: '#10B981' };
const TAG_LABEL = { urgente: '🔴 Urgente', pendiente: '🟡 Pendiente', completada: '✅ Lista' };

export default function YaoPage() {
  const [mes, setMes] = useState(mesStr());
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]     = useState('tareas');

  // new task form
  const [newTarea, setNewTarea] = useState({ texto: '', tag: 'pendiente' });
  const [addingTarea, setAddingTarea] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/yao-proxy?resource=summary&mes=${mes}`, { cache: 'no-store' });
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const toggleTarea = async (t) => {
    await fetch(`/api/yao-proxy/tareas/${t.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completada: !t.completada }),
    });
    load();
  };

  const deleteTarea = async (id) => {
    if (!window.confirm('¿Eliminar tarea?')) return;
    await fetch(`/api/yao-proxy/tareas/${id}`, { method: 'DELETE' });
    load();
  };

  const handleAddTarea = async (e) => {
    e.preventDefault();
    if (!newTarea.texto.trim()) return;
    setAddingTarea(true);
    try {
      await fetch('/api/yao-proxy?resource=tareas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTarea),
      });
      setNewTarea({ texto: '', tag: 'pendiente' });
      load();
    } finally { setAddingTarea(false); }
  };

  // ── KPI derived ──────────────────────────────────────────────────────────────
  const totalVentas = data?.totalVentas || 0;
  const totalGastos = data?.totalGastos || 35400;
  const cobertura   = data?.cobertura ?? (totalGastos > 0 ? Math.round(totalVentas / totalGastos * 100) : 0);
  const utilidad    = totalVentas - totalGastos;
  const tareas      = data?.tareas || [];
  const gastos      = data?.gastos || [];
  const deudas      = data?.deudas || [];
  const ventasMes   = data?.ventasMes || [];
  const deudaTotal  = deudas.filter(d => !d.pagada).reduce((s, d) => s + d.monto, 0);

  const TABS = [
    { id: 'tareas',  label: '✅ Tareas' },
    { id: 'gastos',  label: '📋 Gastos' },
    { id: 'ventas',  label: '📊 Ventas' },
  ];

  return (
    <div className="page">
      {/* Header ───────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>🍶</span> YAO Baja
            {data && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, letterSpacing: '.04em',
                background: data.online ? 'rgba(16,185,129,.12)' : 'rgba(239,68,68,.12)',
                color: data.online ? 'var(--green)' : 'var(--red)', border: `1px solid ${data.online ? 'rgba(16,185,129,.3)' : 'rgba(239,68,68,.3)'}` }}>
                {data.online ? '⚡ Conectado' : '⚠️ Offline'}
              </span>
            )}
          </h1>
          <p className="page-subtitle">Bar & eventos — operaciones del negocio</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={mes} onChange={e => setMes(e.target.value)} style={{ width: 150 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i);
              const v = d.toISOString().slice(0, 7);
              return <option key={v} value={v}>{d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ background: 'linear-gradient(135deg,#D97706,#F59E0B)', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            🍶 Dashboard completo ↗
          </a>
        </div>
      </div>

      {/* KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card metric-card--green">
          <div className="metric-card-label">Ventas del mes</div>
          <div className="metric-card-value">{loading ? '…' : fmt(totalVentas)}</div>
          <div className="metric-card-sub">{ventasMes.length} días registrados</div>
        </div>
        <div className="metric-card metric-card--red">
          <div className="metric-card-label">Gastos fijos</div>
          <div className="metric-card-value">{fmt(totalGastos)}</div>
          <div className="metric-card-sub">{gastos.length} conceptos</div>
        </div>
        <div className="metric-card" style={{ borderColor: cobertura >= 100 ? 'rgba(16,185,129,.3)' : cobertura >= 70 ? 'rgba(245,158,11,.3)' : 'rgba(239,68,68,.3)' }}>
          <div className="metric-card-label">Cobertura</div>
          <div className="metric-card-value" style={{ color: cobertura >= 100 ? 'var(--green)' : cobertura >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
            {loading ? '…' : `${cobertura}%`}
          </div>
          <div className="metric-card-sub">Ventas / gastos fijos</div>
        </div>
        <div className="metric-card metric-card--accent">
          <div className="metric-card-label">Utilidad neta</div>
          <div className="metric-card-value" style={{ color: utilidad >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {loading ? '…' : fmt(utilidad)}
          </div>
          <div className="metric-card-sub">Ventas − gastos</div>
        </div>
        <div className="metric-card metric-card--yellow">
          <div className="metric-card-label">Deuda total</div>
          <div className="metric-card-value">{fmt(deudaTotal)}</div>
          <div className="metric-card-sub">{deudas.filter(d => !d.pagada).length} pendientes</div>
        </div>
      </div>

      {/* Cobertura progress bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <div className="card-title">Cobertura de gastos fijos</div>
          <span style={{ fontSize: 11, fontWeight: 600, color: cobertura >= 100 ? 'var(--green)' : cobertura >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
            {fmt(totalVentas)} / {fmt(totalGastos)}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{
            width: `${Math.min(100, cobertura)}%`,
            background: cobertura >= 100 ? 'var(--green)' : cobertura >= 70 ? 'var(--yellow)' : 'var(--red)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
          <span>Vendido este mes: <strong style={{ color: cobertura >= 100 ? 'var(--green)' : 'var(--text)' }}>{fmt(totalVentas)}</strong></span>
          <span>Falta para cubrir: <strong>{fmt(Math.max(0, totalGastos - totalVentas))}</strong></span>
        </div>
      </div>

      {/* Tab bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              color: tab === t.id ? '#F59E0B' : 'var(--text2)',
              borderBottom: tab === t.id ? '2px solid #F59E0B' : '2px solid transparent',
              transition: 'all .15s', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ TAB: TAREAS */}
      {tab === 'tareas' && (
        <div>
          {!data?.online && (
            <div style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--red)' }}>
              ⚠️ YAO Dashboard offline — asegúrate de que esté corriendo en <code>localhost:3001</code>. Las tareas no se pueden editar.
            </div>
          )}

          {/* Add task */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Nueva tarea en YAO</div>
            <form onSubmit={handleAddTarea} style={{ display: 'flex', gap: 8 }}>
              <input type="text" placeholder="¿Qué hay que hacer en YAO?" value={newTarea.texto}
                onChange={e => setNewTarea(p => ({ ...p, texto: e.target.value }))}
                style={{ flex: 1 }} disabled={!data?.online} />
              <select value={newTarea.tag} onChange={e => setNewTarea(p => ({ ...p, tag: e.target.value }))}
                style={{ width: 120 }} disabled={!data?.online}>
                <option value="pendiente">Pendiente</option>
                <option value="urgente">Urgente</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={addingTarea || !data?.online}
                style={{ background: '#D97706' }}>
                {addingTarea ? '…' : '+ Agregar'}
              </button>
            </form>
          </div>

          {/* Task list */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Tareas YAO</div>
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>
                {tareas.filter(t => !t.completada).length} pendientes · {tareas.filter(t => t.completada).length} completadas
              </span>
            </div>

            {/* Urgentes first */}
            {tareas.filter(t => t.tag === 'urgente' && !t.completada).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>⚡ Urgentes</div>
                {tareas.filter(t => t.tag === 'urgente' && !t.completada).map(t => (
                  <TareaRow key={t.id} t={t} onToggle={toggleTarea} onDelete={deleteTarea} online={data?.online} />
                ))}
              </div>
            )}

            {/* Pendientes */}
            {tareas.filter(t => t.tag === 'pendiente' && !t.completada).length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--yellow)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>🕐 Pendientes</div>
                {tareas.filter(t => t.tag === 'pendiente' && !t.completada).map(t => (
                  <TareaRow key={t.id} t={t} onToggle={toggleTarea} onDelete={deleteTarea} online={data?.online} />
                ))}
              </div>
            )}

            {/* Completadas (collapsed) */}
            {tareas.filter(t => t.completada).length > 0 && (
              <details>
                <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer', userSelect: 'none', marginTop: 8, padding: '4px 0' }}>
                  ✅ {tareas.filter(t => t.completada).length} completadas
                </summary>
                <div style={{ marginTop: 8, opacity: .6 }}>
                  {tareas.filter(t => t.completada).map(t => (
                    <TareaRow key={t.id} t={t} onToggle={toggleTarea} onDelete={deleteTarea} online={data?.online} />
                  ))}
                </div>
              </details>
            )}

            {tareas.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0', fontSize: 13 }}>
                {data?.online ? 'Sin tareas en YAO' : 'YAO offline'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ TAB: GASTOS */}
      {tab === 'gastos' && (
        <div className="g2">
          {/* Gastos fijos */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Gastos fijos YAO</div>
            {gastos.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin datos</div>}
            {gastos.map(g => (
              <div key={g.id} className="list-item">
                <span className="list-item-name">{g.nombre}</span>
                <span className="list-item-amount">{fmt(g.monto)}</span>
              </div>
            ))}
            <div className="list-total">
              <span className="list-total-label">Total mensual</span>
              <span className="list-total-amount">{fmt(totalGastos)}</span>
            </div>
          </div>

          {/* Deudas */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Deudas YAO</div>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{deudas.filter(d => !d.pagada).length} pendientes</span>
            </div>
            {deudas.length === 0 && <div style={{ color: 'var(--text3)', fontSize: 13 }}>Sin deudas</div>}
            {deudas.map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border)', opacity: d.pagada ? .45 : 1 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.pagada ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, textDecoration: d.pagada ? 'line-through' : 'none' }}>{d.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{d.tipo === 'mensual' ? 'Mensual' : 'Única vez'}</div>
                </div>
                <span style={{ fontWeight: 700, color: d.pagada ? 'var(--green)' : 'var(--red)', fontSize: 13 }}>{fmt(d.monto)}</span>
              </div>
            ))}
            <div className="list-total">
              <span className="list-total-label">Deuda pendiente</span>
              <span className="list-total-amount" style={{ color: 'var(--red)' }}>{fmt(deudaTotal)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ TAB: VENTAS */}
      {tab === 'ventas' && (
        <div className="card">
          <div className="card-head">
            <div className="card-title">Ventas del mes — {mes}</div>
            <a href="http://localhost:3001/ventas" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#F59E0B', textDecoration: 'none' }}>
              ✏️ Registrar en YAO →
            </a>
          </div>
          {ventasMes.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', padding: '32px 0', fontSize: 13 }}>
              {data?.online ? 'Sin ventas registradas este mes en YAO' : 'YAO offline'}
            </div>
          ) : (
            <>
              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ textAlign: 'right' }}>Ventas</th>
                    <th style={{ textAlign: 'right' }}>Gastos op.</th>
                    <th style={{ textAlign: 'right' }}>Insumos</th>
                    <th style={{ textAlign: 'right' }}>Utilidad</th>
                    <th style={{ textAlign: 'right' }}>Efectivo</th>
                    <th style={{ textAlign: 'right' }}>Tarjeta</th>
                    <th style={{ textAlign: 'right' }}>Propinas</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasMes.map(v => {
                    const util = (v.ing || 0) - (v.gas || 0) - (v.insumos || 0);
                    return (
                      <tr key={v.id}>
                        <td style={{ color: 'var(--text2)', fontSize: 12, whiteSpace: 'nowrap' }}>{v.date}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{fmt(v.ing)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--red)' }}>{fmt(v.gas)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--red)' }}>{fmt(v.insumos)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: util >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(util)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(v.efectivo)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{fmt(v.tarjeta)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--yellow)' }}>{fmt(v.propinas)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="list-total" style={{ marginTop: 8 }}>
                <span className="list-total-label">Total ventas del mes</span>
                <span className="list-total-amount" style={{ color: 'var(--green)' }}>{fmt(totalVentas)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-component: TareaRow ───────────────────────────────────────────────────
function TareaRow({ t, onToggle, onDelete, online }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <input type="checkbox" checked={!!t.completada} onChange={() => onToggle(t)}
        disabled={!online}
        style={{ accentColor: '#F59E0B', width: 15, height: 15, cursor: online ? 'pointer' : 'default', flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 13, textDecoration: t.completada ? 'line-through' : 'none', color: t.completada ? 'var(--text3)' : 'var(--text)' }}>
        {t.texto}
      </span>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
        background: TAG_COLOR[t.completada ? 'completada' : t.tag] + '20',
        color: TAG_COLOR[t.completada ? 'completada' : t.tag] }}>
        {TAG_LABEL[t.completada ? 'completada' : t.tag]}
      </span>
      {online && (
        <button className="btn-icon" onClick={() => onDelete(t.id)} title="Eliminar">✕</button>
      )}
    </div>
  );
}
