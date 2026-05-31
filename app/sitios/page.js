'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

/* ── Constants ─────────────────────────────────────────────── */
const ETAPAS = [
  { key: 'demo_agendado',  label: 'Demo Agendado',   color: '#3B82F6' },
  { key: 'demo_realizado', label: 'Demo Realizado',   color: '#8B5CF6' },
  { key: 'venta_cerrada',  label: 'Venta Cerrada',    color: '#F59E0B' },
  { key: 'en_construccion',label: 'En Construcción',  color: '#F97316' },
  { key: 'en_revision',    label: 'En Revisión',      color: '#06B6D4' },
  { key: 'entregado',      label: 'Entregado',        color: '#10B981' },
  { key: 'pagado',         label: 'Pagado ✅',         color: '#10B981' },
  { key: 'perdido',        label: 'Perdido',          color: '#6B7280' },
];

const PAQUETES = [
  { key: 'por_elegir',          label: 'Por elegir',             monto: null   },
  { key: 'landing_express',     label: 'Landing Express',        monto: 1900   },
  { key: 'sitio_completo',      label: 'Sitio Completo',         monto: 2500   },
  { key: 'paquete_lanzamiento', label: 'Paquete Lanzamiento',    monto: 4200   },
];

const RECURSOS = [
  { label: 'Formulario de Cambios', url: 'https://migueltorres15.github.io/formulario-cambios/', icon: '📋' },
  { label: 'Research Tracker',      url: 'https://docs.google.com/spreadsheets/d/1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c', icon: '📊' },
  { label: 'Lista de Precios PDF',  url: '/tmp/tigre-studio-precios.pdf', icon: '💰', download: true },
  { label: 'Agente de Leads',       url: '/agentes', icon: '🤖', internal: true },
];

const EMPTY_FORM = {
  cliente: '', contacto: '', whatsapp: '', fecha_demo: '', hora_demo: '',
  paquete: 'por_elegir', link_demo: '', link_sitio: '',
  etapa: 'demo_agendado', monto: '', moneda: 'MXN', notas: '',
};

const fmt = n => n ? `$${Number(n).toLocaleString('es-MX')} MXN` : '—';
const etapaInfo = key => ETAPAS.find(e => e.key === key) || ETAPAS[0];
const paqueteInfo = key => PAQUETES.find(p => p.key === key) || PAQUETES[0];

// Formatear fecha_demo para mostrar en la tarjeta
const DIAS_ES = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const formatFechaDemo = (f) => {
  if (!f) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    const d = new Date(f + 'T12:00');
    return `${DIAS_ES[d.getDay()]} ${d.getDate()} de ${MESES_ES[d.getMonth()]}`;
  }
  return f; // backward compat con texto libre
};

/* ── Progress bar ──────────────────────────────────────────── */
function ProgressBar({ etapa }) {
  const order = ETAPAS.filter(e => e.key !== 'perdido').map(e => e.key);
  const idx   = order.indexOf(etapa);
  const pct   = etapa === 'perdido' ? 0 : Math.round(((idx + 1) / order.length) * 100);
  const color = etapaInfo(etapa).color;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>
        <span>{etapaInfo(etapa).label}</span>
        <span>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 99, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
      </div>
    </div>
  );
}

/* ── Tarea item ────────────────────────────────────────────── */
function TareaItem({ tarea, sitioId, onUpdate }) {
  const toggle = async () => {
    await fetch(`/api/sitios/${sitioId}/tareas/${tarea.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completada: !tarea.completada }),
    });
    onUpdate();
  };
  const del = async (e) => {
    e.stopPropagation();
    await fetch(`/api/sitios/${sitioId}/tareas/${tarea.id}`, { method: 'DELETE' });
    onUpdate();
  };
  return (
    <div onClick={toggle} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0',
      cursor: 'pointer', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
        border: tarea.completada ? 'none' : '1.5px solid var(--border2)',
        background: tarea.completada ? 'var(--green)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {tarea.completada && <span style={{ color: '#fff', fontSize: 9 }}>✓</span>}
      </div>
      <span style={{
        flex: 1, fontSize: 11.5, color: tarea.completada ? 'var(--text3)' : 'var(--text)',
        textDecoration: tarea.completada ? 'line-through' : 'none',
        lineHeight: 1.4,
      }}>{tarea.texto}</span>
      <button onClick={del} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '0 2px', opacity: 0 }}
        className="del-btn">✕</button>
    </div>
  );
}

/* ── Project Card ──────────────────────────────────────────── */
function ProjectCard({ sitio, onEdit, onLoad }) {
  const [newTarea, setNewTarea] = useState('');
  const [addingTarea, setAddingTarea] = useState(false);
  const pkg = paqueteInfo(sitio.paquete);

  const addTarea = async (e) => {
    e.preventDefault();
    if (!newTarea.trim()) return;
    await fetch(`/api/sitios/${sitio.id}/tareas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: newTarea }),
    });
    setNewTarea('');
    setAddingTarea(false);
    onLoad();
  };

  const tareasDone = (sitio.tareas || []).filter(t => t.completada).length;
  const tareasTotal = (sitio.tareas || []).length;

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
      padding: '14px 14px 12px', marginBottom: 10, cursor: 'default',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sitio.cliente}
          </div>
          {sitio.contacto && (
            <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
              {sitio.contacto}
              {sitio.whatsapp && (
                <a href={`https://wa.me/52${sitio.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                  style={{ marginLeft: 6, color: '#25D366', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                  📱
                </a>
              )}
            </div>
          )}
        </div>
        <button onClick={() => onEdit(sitio)} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text2)', fontSize: 11, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
        }}>Editar</button>
      </div>

      {/* Demo time */}
      {sitio.fecha_demo && (
        <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, marginBottom: 6 }}>
          📅 {formatFechaDemo(sitio.fecha_demo)}{sitio.hora_demo ? ` · ${sitio.hora_demo}` : ''}
        </div>
      )}

      {/* Package */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{
          fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
          background: sitio.paquete === 'por_elegir' ? 'var(--bg3)' : 'rgba(16,185,129,0.12)',
          color: sitio.paquete === 'por_elegir' ? 'var(--text3)' : 'var(--green)',
          border: `1px solid ${sitio.paquete === 'por_elegir' ? 'var(--border)' : 'rgba(16,185,129,0.3)'}`,
        }}>
          {pkg.label}{pkg.monto ? ` · $${pkg.monto.toLocaleString()} MXN` : ''}
        </span>
      </div>

      {/* Links */}
      {(sitio.link_demo || sitio.link_sitio) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {sitio.link_demo && (
            <a href={sitio.link_demo} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
              🔗 Ver demo
            </a>
          )}
          {sitio.link_sitio && (
            <a href={sitio.link_sitio} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
              🌐 Sitio final
            </a>
          )}
        </div>
      )}

      {/* Progress */}
      <ProgressBar etapa={sitio.etapa || 'demo_agendado'} />

      {/* Tareas */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Tareas {tareasTotal > 0 && `${tareasDone}/${tareasTotal}`}
          </span>
          <button onClick={() => setAddingTarea(v => !v)}
            style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>
            + Agregar
          </button>
        </div>

        {(sitio.tareas || []).map(t => (
          <TareaItem key={t.id} tarea={t} sitioId={sitio.id} onUpdate={onLoad} />
        ))}
        {tareasTotal === 0 && !addingTarea && (
          <div style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 4 }}>Sin tareas</div>
        )}

        {addingTarea && (
          <form onSubmit={addTarea} style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              autoFocus
              value={newTarea}
              onChange={e => setNewTarea(e.target.value)}
              placeholder="Nueva tarea..."
              style={{ flex: 1, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)' }}
            />
            <button type="submit" style={{ fontSize: 12, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>✓</button>
            <button type="button" onClick={() => setAddingTarea(false)}
              style={{ fontSize: 12, background: 'var(--bg3)', border: 'none', color: 'var(--text2)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>✕</button>
          </form>
        )}
      </div>

      {/* Notas */}
      {sitio.notas && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.5, borderTop: '1px solid var(--border)', paddingTop: 8, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {sitio.notas}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */
export default function SitiosPage() {
  const router = useRouter();
  const [sitios, setSitios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [recursosOpen, setRecursosOpen] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/sitios', { cache: 'no-store' }).then(r => r.json());
      setSitios(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    // fecha_demo: si es ISO YYYY-MM-DD lo usamos directo; si es texto libre lo limpiamos para el date picker
    const fechaIso = /^\d{4}-\d{2}-\d{2}$/.test(s.fecha_demo || '') ? s.fecha_demo : '';
    setForm({
      cliente: s.cliente || '', contacto: s.contacto || '', whatsapp: s.whatsapp || '',
      fecha_demo: fechaIso, hora_demo: s.hora_demo || '',
      paquete: s.paquete || 'por_elegir',
      link_demo: s.link_demo || '', link_sitio: s.link_sitio || '',
      etapa: s.etapa || 'demo_agendado', monto: s.monto || '', moneda: s.moneda || 'MXN',
      notas: s.notas || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, monto: form.monto ? parseFloat(form.monto) : null };
      if (editing) {
        await fetch(`/api/sitios/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch('/api/sitios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load(); router.refresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`¿Eliminar ${editing.cliente}?`)) return;
    await fetch(`/api/sitios/${editing.id}`, { method: 'DELETE' });
    setModalOpen(false);
    load(); router.refresh();
  };

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);

  const syncCRM = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await fetch('/api/sync/crm-mx', { cache: 'no-store' });
      const data = await res.json();
      if (data.ok) {
        if (data.creados > 0) {
          setSyncMsg({ tipo: 'ok', texto: `✅ ${data.creados} cliente${data.creados > 1 ? 's' : ''} nuevo${data.creados > 1 ? 's' : ''} agregado${data.creados > 1 ? 's' : ''} desde el CRM${data.yaExisten > 0 ? ` · ${data.yaExisten} ya existían` : ''}` });
          load(); router.refresh();
        } else {
          setSyncMsg({ tipo: 'neutral', texto: `Sin cambios — ${data.totalEnSheet} en Demo Agendado en el CRM, todos ya estaban en el pipeline` });
        }
      } else {
        setSyncMsg({ tipo: 'error', texto: `Error: ${data.error}` });
      }
    } catch (e) {
      setSyncMsg({ tipo: 'error', texto: `Error de conexión` });
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 8000);
    }
  };

  // Stats
  const activos   = sitios.filter(s => !['pagado','perdido'].includes(s.etapa)).length;
  const pagados   = sitios.filter(s => s.etapa === 'pagado').length;
  const revenue   = sitios.filter(s => s.etapa === 'pagado').reduce((a, s) => a + (s.monto || 0), 0);
  const pipeline  = sitios.filter(s => !['pagado','perdido'].includes(s.etapa)).reduce((a, s) => {
    const pkg = paqueteInfo(s.paquete);
    return a + (pkg.monto || 0);
  }, 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sitios Web Express</h1>
          <p className="page-subtitle">Project manager · BCS</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={syncCRM}
            disabled={syncing}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            {syncing ? '⏳ Sincronizando...' : '🔄 Sync CRM'}
          </button>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo proyecto</button>
        </div>
      </div>

      {/* Toast sync */}
      {syncMsg && (
        <div style={{
          marginBottom: 16, padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: syncMsg.tipo === 'ok' ? 'rgba(16,185,129,0.12)' : syncMsg.tipo === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)',
          border: `1px solid ${syncMsg.tipo === 'ok' ? 'rgba(16,185,129,0.35)' : syncMsg.tipo === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(99,102,241,0.3)'}`,
          color: syncMsg.tipo === 'ok' ? '#10B981' : syncMsg.tipo === 'error' ? '#EF4444' : '#818CF8',
        }}>
          {syncMsg.texto}
        </div>
      )}

      {/* Stats */}
      <div className="stats-bar">
        <div className="stats-bar-item">
          <div className="stats-bar-label">Total proyectos</div>
          <div className="stats-bar-value">{sitios.length}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">En proceso</div>
          <div className="stats-bar-value" style={{ color: 'var(--yellow)' }}>{activos}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Cobrados</div>
          <div className="stats-bar-value stats-bar-value--green">{pagados}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Revenue</div>
          <div className="stats-bar-value stats-bar-value--accent">{fmt(revenue)}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Pipeline</div>
          <div className="stats-bar-value" style={{ color: 'var(--accent)' }}>{fmt(pipeline)}</div>
        </div>
      </div>

      {/* Recursos */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
        <button onClick={() => setRecursosOpen(v => !v)} style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
            🔗 Recursos
          </span>
          <span style={{ color: 'var(--text3)', fontSize: 12, transform: recursosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
        </button>
        {recursosOpen && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 16px 14px' }}>
            {RECURSOS.map(r => (
              r.internal
                ? <a key={r.label} href={r.url} style={recursoStyle}>{r.icon} {r.label}</a>
                : <a key={r.label} href={r.url} target="_blank" rel="noreferrer" download={r.download || undefined} style={recursoStyle}>
                    {r.icon} {r.label}
                  </a>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline */}
      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {ETAPAS.map(etapa => {
            const col = sitios.filter(s => (s.etapa || 'demo_agendado') === etapa.key);
            return (
              <div key={etapa.key} style={{ minWidth: 220, flex: '0 0 220px' }}>
                {/* Column header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10, paddingBottom: 8, borderBottom: `2px solid ${etapa.color}`,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: etapa.color, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                    {etapa.label}
                  </span>
                  <span style={{ background: 'var(--bg3)', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>
                    {col.length}
                  </span>
                </div>

                {/* Cards */}
                {col.map(s => (
                  <ProjectCard key={s.id} sitio={s} onEdit={openEdit} onLoad={load} />
                ))}
                {col.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0', border: '1px dashed var(--border)', borderRadius: 10 }}>
                    —
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Negocio *</label>
              <input placeholder="Nombre del negocio" value={form.cliente}
                onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input placeholder="Nombre del contacto" value={form.contacto}
                onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp</label>
              <input placeholder="624 000 0000" value={form.whatsapp}
                onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha del demo</label>
              <input type="date" value={form.fecha_demo}
                onChange={e => setForm(p => ({ ...p, fecha_demo: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Hora del demo</label>
              <input type="time" value={form.hora_demo || ''}
                onChange={e => setForm(p => ({ ...p, hora_demo: e.target.value }))} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Etapa</label>
              <select value={form.etapa} onChange={e => setForm(p => ({ ...p, etapa: e.target.value }))}>
                {ETAPAS.map(e => <option key={e.key} value={e.key}>{e.label}</option>)}
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Paquete</label>
              <select value={form.paquete} onChange={e => setForm(p => ({ ...p, paquete: e.target.value }))}>
                {PAQUETES.map(p => <option key={p.key} value={p.key}>{p.label}{p.monto ? ` · $${p.monto.toLocaleString()} MXN` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monto acordado</label>
              <input type="number" placeholder="0" value={form.monto}
                onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Moneda</label>
              <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Link demo</label>
              <input placeholder="https://..." value={form.link_demo}
                onChange={e => setForm(p => ({ ...p, link_demo: e.target.value }))} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Link sitio final</label>
              <input placeholder="https://..." value={form.link_sitio}
                onChange={e => setForm(p => ({ ...p, link_sitio: e.target.value }))} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Notas</label>
              <textarea placeholder="Notas del proyecto..." value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
            </div>
          </div>
          <div className="form-actions" style={{ justifyContent: editing ? 'space-between' : 'flex-end' }}>
            {editing && (
              <button type="button" onClick={handleDelete}
                style={{ background: 'none', border: '1px solid var(--red)', color: 'var(--red)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}>
                Eliminar
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear proyecto'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const recursoStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontSize: 12, fontWeight: 600, padding: '7px 14px',
  background: 'var(--bg3)', border: '1px solid var(--border)',
  borderRadius: 20, color: 'var(--text2)', textDecoration: 'none',
  transition: 'border-color .15s, color .15s',
};
