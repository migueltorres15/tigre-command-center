'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

const ETAPAS = [
  { key: 'lead_nuevo',      label: 'Lead Nuevo',       color: '#6B7280' },
  { key: 'llamada_hecha',   label: 'Llamada Hecha',    color: '#3B82F6' },
  { key: 'recontactar',     label: 'Recontactar',      color: '#F97316' },
  { key: 'demo_agendado',   label: 'Demo Agendado',    color: '#8B5CF6' },
  { key: 'demo_realizado',  label: 'Demo Realizado',   color: '#F59E0B' },
  { key: 'invoice_enviado', label: 'Invoice Enviado',  color: '#F97316' },
  { key: 'pago_recibido',   label: 'Pago Recibido',    color: '#06B6D4' },
  { key: 'en_construccion', label: 'En Construcción',  color: '#A855F7' },
  { key: 'en_revision',     label: 'En Revisión',      color: '#EC4899' },
  { key: 'entregado',       label: 'Entregado',        color: '#10B981' },
  { key: 'perdido',         label: 'Perdido',          color: '#EF4444' },
];

const PAQUETES = [
  { key: 'por_elegir',      label: 'Por elegir',          monto: null  },
  { key: 'starter',         label: 'Starter Site',        monto: 299   },
  { key: 'standard',        label: 'Standard + SEO',      monto: 499   },
  { key: 'premium',         label: 'Premium + Care Plan', monto: 699   },
];

const RECURSOS = [
  { label: 'Research Tracker', url: 'https://docs.google.com/spreadsheets/d/1fuHe6FPZdUi0S2HJidEqqPdJ06BSqhO3DTV33Yz4_6c', icon: '📊' },
  { label: 'Cold Call Script', url: '/agentes', icon: '📞', internal: true },
  { label: 'Agente de Leads',  url: '/agentes', icon: '🤖', internal: true },
];

const EMPTY_FORM = {
  cliente: '', contacto: '', telefono: '', ciudad: '', estado: '',
  fecha_demo: '', paquete: 'por_elegir', link_demo: '', link_sitio: '',
  etapa: 'lead_nuevo', monto: '', stripe_link: '', notas: '',
  follow_up_fecha: '', follow_up_nota: '',
};

const fmt = n => n ? `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 })} USD` : '—';
const etapaInfo = key => ETAPAS.find(e => e.key === key) || ETAPAS[0];
const paqueteInfo = key => PAQUETES.find(p => p.key === key) || PAQUETES[0];

function ProgressBar({ etapa }) {
  const order = ETAPAS.filter(e => e.key !== 'perdido').map(e => e.key);
  const idx = order.indexOf(etapa);
  const pct = etapa === 'perdido' ? 0 : Math.round(((idx + 1) / order.length) * 100);
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

function TareaItem({ tarea, sitioId, onUpdate }) {
  const toggle = async () => {
    await fetch(`/api/sitios-usa/${sitioId}/tareas/${tarea.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completada: !tarea.completada }),
    });
    onUpdate();
  };
  const del = async (e) => {
    e.stopPropagation();
    await fetch(`/api/sitios-usa/${sitioId}/tareas/${tarea.id}`, { method: 'DELETE' });
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
        textDecoration: tarea.completada ? 'line-through' : 'none', lineHeight: 1.4,
      }}>{tarea.texto}</span>
      <button onClick={del} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>✕</button>
    </div>
  );
}

function ProjectCard({ sitio, onEdit, onLoad }) {
  const [newTarea, setNewTarea] = useState('');
  const [addingTarea, setAddingTarea] = useState(false);
  const pkg = paqueteInfo(sitio.paquete);
  const etapa = etapaInfo(sitio.etapa || 'lead_nuevo');

  const addTarea = async (e) => {
    e.preventDefault();
    if (!newTarea.trim()) return;
    await fetch(`/api/sitios-usa/${sitio.id}/tareas`, {
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
      padding: '14px 14px 12px', marginBottom: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {sitio.cliente}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>
            {sitio.contacto && <span>{sitio.contacto}</span>}
            {sitio.ciudad && <span style={{ marginLeft: 6, color: 'var(--text3)' }}>📍 {sitio.ciudad}{sitio.estado ? `, ${sitio.estado}` : ''}</span>}
          </div>
          {sitio.telefono && (
            <a href={`tel:${sitio.telefono}`} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              📞 {sitio.telefono}
            </a>
          )}
        </div>
        <button onClick={() => onEdit(sitio)} style={{
          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text2)', fontSize: 11, padding: '3px 8px', cursor: 'pointer', flexShrink: 0,
        }}>Editar</button>
      </div>

      {/* Banner recontactar */}
      {sitio.etapa === 'recontactar' && (
        <div style={{
          background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.35)',
          borderRadius: 7, padding: '7px 10px', marginBottom: 8,
          display: 'flex', alignItems: 'flex-start', gap: 7,
        }}>
          <span style={{ fontSize: 14 }}>🔔</span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F97316' }}>
              Interesado — pendiente recontactar
              {sitio.follow_up_fecha && <span style={{ fontWeight: 400, marginLeft: 6 }}>· {sitio.follow_up_fecha}</span>}
            </div>
            {sitio.follow_up_nota && (
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{sitio.follow_up_nota}</div>
            )}
          </div>
        </div>
      )}

      {/* Demo time */}
      {sitio.fecha_demo && (
        <div style={{ fontSize: 11, color: 'var(--yellow)', fontWeight: 600, marginBottom: 6 }}>
          📅 {sitio.fecha_demo}
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
          {pkg.label}{pkg.monto ? ` · $${pkg.monto} USD` : ''}
        </span>
      </div>

      {/* Links */}
      {(sitio.link_demo || sitio.link_sitio || sitio.stripe_link) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {sitio.link_demo && (
            <a href={sitio.link_demo} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none' }}>
              🔗 Ver demo
            </a>
          )}
          {sitio.link_sitio && (
            <a href={sitio.link_sitio} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: 'var(--green)', textDecoration: 'none' }}>
              🌐 Sitio final
            </a>
          )}
          {sitio.stripe_link && (
            <a href={sitio.stripe_link} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, color: '#635BFF', textDecoration: 'none' }}>
              💳 Invoice
            </a>
          )}
        </div>
      )}

      {/* Progress */}
      <ProgressBar etapa={sitio.etapa || 'lead_nuevo'} />

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
            <input autoFocus value={newTarea} onChange={e => setNewTarea(e.target.value)}
              placeholder="Nueva tarea..."
              style={{ flex: 1, fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg)', color: 'var(--text)' }} />
            <button type="submit" style={{ fontSize: 12, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>✓</button>
            <button type="button" onClick={() => setAddingTarea(false)}
              style={{ fontSize: 12, background: 'var(--bg3)', border: 'none', color: 'var(--text2)', borderRadius: 6, padding: '5px 8px', cursor: 'pointer' }}>✕</button>
          </form>
        )}
      </div>

      {sitio.notas && (
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          {sitio.notas}
        </div>
      )}
    </div>
  );
}

export default function StudioPage() {
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
      const data = await fetch('/api/sitios-usa', { cache: 'no-store' }).then(r => r.json());
      setSitios(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (s) => {
    setEditing(s);
    setForm({
      cliente: s.cliente || '', contacto: s.contacto || '', telefono: s.telefono || '',
      ciudad: s.ciudad || '', estado: s.estado || '', fecha_demo: s.fecha_demo || '',
      paquete: s.paquete || 'por_elegir', link_demo: s.link_demo || '',
      link_sitio: s.link_sitio || '', etapa: s.etapa || 'lead_nuevo',
      monto: s.monto || '', stripe_link: s.stripe_link || '', notas: s.notas || '',
      follow_up_fecha: s.follow_up_fecha || '', follow_up_nota: s.follow_up_nota || '',
    });
    setModalOpen(true);
  };

  const [autoCreatedMsg, setAutoCreatedMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, monto: form.monto ? parseFloat(form.monto) : null };
      if (editing) {
        const res  = await fetch(`/api/sitios-usa/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (data.sitioCreado) {
          setAutoCreatedMsg(`✅ "${data.sitioCreado.cliente}" agregado automáticamente a Sitios Web`);
          setTimeout(() => setAutoCreatedMsg(null), 6000);
        }
      } else {
        await fetch('/api/sitios-usa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load(); router.refresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!editing) return;
    if (!confirm(`¿Eliminar ${editing.cliente}?`)) return;
    await fetch(`/api/sitios-usa/${editing.id}`, { method: 'DELETE' });
    setModalOpen(false);
    load(); router.refresh();
  };

  const activos  = sitios.filter(s => !['entregado','perdido'].includes(s.etapa)).length;
  const pagados  = sitios.filter(s => ['pago_recibido','en_construccion','en_revision','entregado'].includes(s.etapa)).length;
  const revenue  = sitios.filter(s => ['pago_recibido','en_construccion','en_revision','entregado'].includes(s.etapa)).reduce((a, s) => a + (s.monto || 0), 0);
  const pipeline = sitios.filter(s => !['entregado','perdido'].includes(s.etapa)).reduce((a, s) => {
    const pkg = paqueteInfo(s.paquete);
    return a + (pkg.monto || s.monto || 0);
  }, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tigre Studio · USA</h1>
          <p className="page-subtitle">Website sales pipeline · US market</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nuevo lead</button>
      </div>

      <div className="stats-bar">
        <div className="stats-bar-item">
          <div className="stats-bar-label">Total leads</div>
          <div className="stats-bar-value">{sitios.length}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">En proceso</div>
          <div className="stats-bar-value" style={{ color: 'var(--yellow)' }}>{activos}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Pagados</div>
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
          <span style={{ fontWeight: 700, fontSize: 13 }}>🔗 Recursos</span>
          <span style={{ color: 'var(--text3)', fontSize: 12, transform: recursosOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
        </button>
        {recursosOpen && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 16px 14px' }}>
            {RECURSOS.map(r => (
              <a key={r.label} href={r.url} target={r.internal ? '_self' : '_blank'} rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, padding: '7px 14px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text2)', textDecoration: 'none' }}>
                {r.icon} {r.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Toast auto-creación en Sitios Web */}
      {autoCreatedMsg && (
        <div style={{
          background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          fontSize: 13, color: '#10B981', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🔗</span>
          {autoCreatedMsg}
          <a href="/sitios" style={{ marginLeft: 'auto', fontSize: 12, color: '#10B981', textDecoration: 'underline' }}>
            Ver en Sitios Web →
          </a>
        </div>
      )}

      {/* 🔔 Sección Recontactar */}
      {!loading && sitios.filter(s => s.etapa === 'recontactar').length > 0 && (
        <div style={{
          background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.3)',
          borderRadius: 12, padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>🔔</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#F97316' }}>
              Pendientes de recontactar ({sitios.filter(s => s.etapa === 'recontactar').length})
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {sitios.filter(s => s.etapa === 'recontactar').map(s => (
              <div key={s.id} onClick={() => openEdit(s)} style={{
                background: 'var(--bg2)', border: '1px solid rgba(249,115,22,0.4)',
                borderRadius: 10, padding: '10px 14px', cursor: 'pointer', minWidth: 200,
                transition: 'border-color .15s',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 3 }}>{s.cliente}</div>
                {s.telefono && (
                  <a href={`https://wa.me/${s.telefono.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11.5, color: '#25D366', textDecoration: 'none', display: 'block', marginBottom: 3 }}>
                    💬 {s.telefono}
                  </a>
                )}
                {s.follow_up_fecha && (
                  <div style={{ fontSize: 11, color: '#F97316', fontWeight: 600 }}>
                    📅 Recontactar: {s.follow_up_fecha}
                  </div>
                )}
                {s.follow_up_nota && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{s.follow_up_nota}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline kanban */}
      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
          {ETAPAS.map(etapa => {
            const col = sitios.filter(s => (s.etapa || 'lead_nuevo') === etapa.key);
            return (
              <div key={etapa.key} style={{ minWidth: 220, flex: '0 0 220px' }}>
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
                {col.map(s => (
                  <ProjectCard key={s.id} sitio={s} onEdit={openEdit} onLoad={load} />
                ))}
                {col.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', padding: '20px 0', border: '1px dashed var(--border)', borderRadius: 10 }}>—</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar lead' : 'Nuevo lead USA'}>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Negocio *</label>
              <input placeholder="Business name" value={form.cliente}
                onChange={e => setForm(p => ({ ...p, cliente: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Contacto</label>
              <input placeholder="Owner name" value={form.contacto}
                onChange={e => setForm(p => ({ ...p, contacto: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono USA</label>
              <input placeholder="+1 (619) 000-0000" value={form.telefono}
                onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Ciudad</label>
              <input placeholder="Tucson" value={form.ciudad}
                onChange={e => setForm(p => ({ ...p, ciudad: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <input placeholder="AZ" value={form.estado}
                onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} />
            </div>
            <div className="form-group full-width">
              <label className="form-label">Fecha y hora del demo</label>
              <input placeholder="Mon Jun 2 · 10:00am PT" value={form.fecha_demo}
                onChange={e => setForm(p => ({ ...p, fecha_demo: e.target.value }))} />
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
                {PAQUETES.map(p => <option key={p.key} value={p.key}>{p.label}{p.monto ? ` · $${p.monto} USD` : ''}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Monto acordado (USD)</label>
              <input type="number" placeholder="299" value={form.monto}
                onChange={e => setForm(p => ({ ...p, monto: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Stripe Invoice Link</label>
              <input placeholder="https://invoice.stripe.com/..." value={form.stripe_link}
                onChange={e => setForm(p => ({ ...p, stripe_link: e.target.value }))} />
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
              <textarea placeholder="Notes, next steps, context..." value={form.notas}
                onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} />
            </div>

            {/* Campos Recontactar — solo cuando la etapa es recontactar */}
            {form.etapa === 'recontactar' && (
              <>
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)',
                  borderRadius: 8, padding: '12px 14px', marginTop: 4,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#F97316', marginBottom: 10 }}>
                    🔔 Seguimiento — Recontactar
                  </div>
                  <div className="form-grid" style={{ gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Fecha para recontactar</label>
                      <input type="date" value={form.follow_up_fecha}
                        onChange={e => setForm(p => ({ ...p, follow_up_fecha: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nota de seguimiento</label>
                      <input placeholder="ej: quedó de escribir el martes" value={form.follow_up_nota}
                        onChange={e => setForm(p => ({ ...p, follow_up_nota: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </>
            )}
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
                {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear lead'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
