'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Modal from '@/components/Modal';

/* ── Status config ───────────────────────────────────────────────────────── */
const STATUSES = [
  { key: 'Sin contactar', label: 'Sin contactar', color: '#6B7280', bg: 'rgba(107,114,128,.15)' },
  { key: 'No contestó',   label: 'No contestó',   color: '#F59E0B', bg: 'rgba(245,158,11,.15)'  },
  { key: 'Voicemail',     label: 'Voicemail',      color: '#8B5CF6', bg: 'rgba(139,92,246,.15)'  },
  { key: 'Rellamar',      label: 'Rellamar 📅',    color: '#3B82F6', bg: 'rgba(59,130,246,.15)'  },
  { key: 'Interesado',    label: 'Interesado ✅',  color: '#10B981', bg: 'rgba(16,185,129,.15)'  },
  { key: 'Demo Agendado', label: 'Demo Agendado 🎯',color:'#F97316', bg:'rgba(249,115,22,.15)'   },
  { key: 'No interesado', label: 'No interesado',  color: '#EF4444', bg: 'rgba(239,68,68,.15)'   },
];

const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };
const statusInfo = (key) => STATUSES.find(s => s.key === key) || STATUSES[0];

const FILTER_TABS = [
  { key: 'todos',        label: 'Todos' },
  { key: 'pendiente',    label: '📋 Pendientes' },
  { key: 'interesados',  label: '✅ Interesados' },
  { key: 'rellamar',     label: '📅 Rellamar' },
  { key: 'no_contactar', label: '🚫 No contactar' },
];

const fmtPhone = (p) => {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return p;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

/* ── Demo Modal ──────────────────────────────────────────────────────────── */
function DemoModal({ lead, onClose, onConfirm, saving }) {
  const [fecha, setFecha] = useState(todayStr());
  const [hora,  setHora]  = useState('10:00');
  const [notas, setNotas] = useState('');

  const handleConfirm = () => {
    if (!fecha) return alert('Selecciona la fecha del demo');
    onConfirm({ fecha, hora, notas });
  };

  return (
    <Modal open onClose={onClose} title="🎯 Agendar Demo">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{lead.nombre}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {lead.niche} · {lead.city}, {lead.state}
          </div>
          {lead.phone && (
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              📞 {fmtPhone(lead.phone)}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Fecha del demo *</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Hora</label>
            <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Notas (opcional)</label>
          <textarea
            placeholder="Ej: Quiere ver ejemplos de restaurantes…"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{
          background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.25)',
          borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#F97316',
        }}>
          ✅ Se agregará al pipeline USA + aparecerá en el calendario automáticamente
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={handleConfirm} disabled={saving || !fecha}>
          {saving ? '⏳ Guardando…' : '🎯 Confirmar demo'}
        </button>
      </div>
    </Modal>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function LlamadasUSAPage() {
  const [leads, setLeads]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('pendiente');
  const [search, setSearch]     = useState('');
  const [updating, setUpdating] = useState({});
  const [dialMode, setDialMode] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [demoModal, setDemoModal]   = useState(null);
  const [savingDemo, setSavingDemo] = useState(false);
  const [toast, setToast]           = useState(null);

  // ── Twilio ────────────────────────────────────────────────────────────────
  const deviceRef    = useRef(null);
  const activeCallRef = useRef(null);
  const [twilioReady, setTwilioReady] = useState(false);  // device registrado
  const [twilioError, setTwilioError] = useState(null);
  const [callState, setCallState]     = useState('idle');  // idle|connecting|in-call|ended
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  // Inicializar Twilio Device al entrar en Modo Dial
  const initTwilio = useCallback(async () => {
    if (deviceRef.current) return; // ya inicializado
    try {
      const { Device } = await import('@twilio/voice-sdk');
      const res = await fetch('/api/twilio/token', { cache: 'no-store' });
      const { token, error } = await res.json();
      if (error) throw new Error(error);

      const device = new Device(token, {
        logLevel: 1,
        codecPreferences: ['opus', 'pcmu'],
      });

      device.on('error', (e) => {
        console.error('Twilio device error:', e);
        setTwilioError('Error de conexión: ' + (e.message || e));
      });

      device.on('tokenWillExpire', async () => {
        const r  = await fetch('/api/twilio/token', { cache: 'no-store' });
        const d  = await r.json();
        if (d.token) device.updateToken(d.token);
      });

      await device.register();
      deviceRef.current = device;
      setTwilioReady(true);
      setTwilioError(null);
    } catch (err) {
      console.error('Twilio init error:', err);
      setTwilioError('No se pudo conectar Twilio: ' + err.message);
    }
  }, []);

  const makeCall = useCallback(async (phoneNumber) => {
    if (!deviceRef.current || !twilioReady) {
      setTwilioError('Twilio no está listo aún');
      return;
    }
    if (callState === 'in-call' || callState === 'connecting') return;

    // Normalizar número → +1XXXXXXXXXX
    const digits = phoneNumber.replace(/\D/g, '');
    const e164 = digits.length === 10 ? '+1' + digits
               : digits.length === 11 && digits[0] === '1' ? '+' + digits
               : '+' + digits;

    setCallState('connecting');
    setCallDuration(0);

    try {
      const call = await deviceRef.current.connect({ params: { To: e164 } });
      activeCallRef.current = call;

      call.on('accept', () => {
        setCallState('in-call');
        // Iniciar timer
        timerRef.current = setInterval(() => {
          setCallDuration(s => s + 1);
        }, 1000);
      });

      call.on('disconnect', () => {
        setCallState('ended');
        clearInterval(timerRef.current);
        activeCallRef.current = null;
        // Volver a idle después de 2s
        setTimeout(() => setCallState('idle'), 2000);
      });

      call.on('cancel', () => {
        setCallState('idle');
        clearInterval(timerRef.current);
        activeCallRef.current = null;
      });

      call.on('error', (e) => {
        setCallState('idle');
        clearInterval(timerRef.current);
        setTwilioError('Error en llamada: ' + (e.message || e));
        activeCallRef.current = null;
      });
    } catch (err) {
      setCallState('idle');
      setTwilioError('No se pudo marcar: ' + err.message);
    }
  }, [twilioReady, callState]);

  const hangUp = useCallback(() => {
    activeCallRef.current?.disconnect();
    clearInterval(timerRef.current);
    setCallState('idle');
    setCallDuration(0);
    activeCallRef.current = null;
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      deviceRef.current?.destroy();
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch('/api/call-list-usa', { cache: 'no-store' }).then(r => r.json());
      if (Array.isArray(data)) {
        data.sort((a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
        );
        setLeads(data);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, tipo = 'ok') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Update status ─────────────────────────────────────────────────────── */
  const updateStatus = async (lead, newStatus) => {
    if (newStatus === 'Demo Agendado') {
      setDemoModal(lead);
      return;
    }
    setUpdating(p => ({ ...p, [lead.row_index]: true }));
    try {
      await fetch('/api/call-list-usa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_index: lead.row_index, status: newStatus }),
      });
      setLeads(prev => prev.map(l =>
        l.row_index === lead.row_index ? { ...l, status: newStatus } : l
      ));
    } finally {
      setUpdating(p => ({ ...p, [lead.row_index]: false }));
    }
  };

  /* ── Confirm Demo ──────────────────────────────────────────────────────── */
  const confirmDemo = async ({ fecha, hora, notas }) => {
    const lead = demoModal;
    setSavingDemo(true);
    try {
      const statusLabel = `Demo Agendado — ${fecha}`;
      await fetch('/api/call-list-usa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ row_index: lead.row_index, status: statusLabel }),
      });

      await fetch('/api/sitios-usa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente:    lead.nombre,
          contacto:   '',
          telefono:   lead.phone || '',
          ciudad:     lead.city  || '',
          estado:     lead.state || '',
          fecha_demo: `${fecha}${hora ? ' · ' + hora : ''}`,
          paquete:    'por_elegir',
          etapa:      'demo_agendado',
          notas:      notas || `[Cold Call] ${lead.niche}${lead.maps_url ? '\n🗺 ' + lead.maps_url : ''}`,
        }),
      });

      await fetch('/api/sesiones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente:  `${lead.nombre} — ${lead.city}`,
          tipo:     'Demo Sitio Web USA',
          fecha:    fecha,
          status:   'confirmado',
          notas:    hora ? `${hora}${notas ? ' · ' + notas : ''}` : notas,
        }),
      });

      setLeads(prev => prev.map(l =>
        l.row_index === lead.row_index ? { ...l, status: statusLabel } : l
      ));
      setDemoModal(null);
      showToast(`✅ Demo agendado para ${lead.nombre} · ${fecha}${hora ? ' ' + hora : ''}`);
    } catch (e) {
      showToast('❌ Error guardando demo: ' + e.message, 'error');
    } finally {
      setSavingDemo(false);
    }
  };

  /* ── Filtrado ──────────────────────────────────────────────────────────── */
  const filtered = leads.filter(l => {
    const s = l.status || 'Sin contactar';
    const isDemoAgendado = s.startsWith('Demo Agendado');
    if (filter === 'pendiente')    return ['Sin contactar', 'No contestó', 'Voicemail'].includes(s);
    if (filter === 'interesados')  return s === 'Interesado' || isDemoAgendado;
    if (filter === 'rellamar')     return s === 'Rellamar';
    if (filter === 'no_contactar') return s === 'No interesado';
    return true;
  }).filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return l.nombre.toLowerCase().includes(q) ||
           l.city.toLowerCase().includes(q)   ||
           l.niche.toLowerCase().includes(q)  ||
           (l.phone || '').includes(q);
  });

  const stats = {
    total:       leads.length,
    pendientes:  leads.filter(l => ['Sin contactar','No contestó','Voicemail'].includes(l.status || 'Sin contactar')).length,
    interesados: leads.filter(l => (l.status || '').startsWith('Interesado') || (l.status || '').startsWith('Demo Agendado')).length,
    rellamar:    leads.filter(l => l.status === 'Rellamar').length,
  };

  /* ── Dial Mode ─────────────────────────────────────────────────────────── */
  if (dialMode && filtered.length > 0) {
    const lead = filtered[currentIdx] || filtered[0];
    return (
      <>
        {demoModal && (
          <DemoModal
            lead={demoModal}
            onClose={() => setDemoModal(null)}
            onConfirm={confirmDemo}
            saving={savingDemo}
          />
        )}
        {toast && (
          <div style={{
            position: 'fixed', top: 16, right: 16, zIndex: 9999,
            padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
            background: toast.tipo === 'ok' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
            border: `1px solid ${toast.tipo === 'ok' ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}`,
            color: toast.tipo === 'ok' ? '#10B981' : '#EF4444',
            boxShadow: '0 4px 20px rgba(0,0,0,.3)',
          }}>
            {toast.msg}
          </div>
        )}
        <DialMode
          lead={lead}
          idx={currentIdx}
          total={filtered.length}
          updating={!!updating[lead.row_index]}
          twilioReady={twilioReady}
          twilioError={twilioError}
          callState={callState}
          callDuration={callDuration}
          onCall={makeCall}
          onHangUp={hangUp}
          onStatus={(s) => {
            updateStatus(lead, s);
            if (s !== 'Demo Agendado') {
              setCurrentIdx(i => Math.min(i + 1, filtered.length - 1));
            }
          }}
          onNext={() => setCurrentIdx(i => Math.min(i + 1, filtered.length - 1))}
          onPrev={() => setCurrentIdx(i => Math.max(i - 1, 0))}
          onExit={() => { hangUp(); setDialMode(false); }}
        />
      </>
    );
  }

  return (
    <div className="page">
      {demoModal && (
        <DemoModal
          lead={demoModal}
          onClose={() => setDemoModal(null)}
          onConfirm={confirmDemo}
          saving={savingDemo}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed', top: 16, right: 16, zIndex: 9999,
          padding: '12px 18px', borderRadius: 10, fontWeight: 600, fontSize: 13,
          background: toast.tipo === 'ok' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
          border: `1px solid ${toast.tipo === 'ok' ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}`,
          color: toast.tipo === 'ok' ? '#10B981' : '#EF4444',
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>
          {toast.msg}
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">📞 Cold Calls USA</h1>
          <p className="page-subtitle">USA Research Tracker · {leads.length} leads · (737) 339-8878</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            {loading ? '⏳' : '🔄'} Actualizar
          </button>
        </div>
      </div>

      <div className="stats-bar" style={{ marginBottom: 16 }}>
        {[
          { label: 'Total leads',  value: stats.total,       color: 'var(--text)' },
          { label: 'Pendientes',   value: stats.pendientes,  color: 'var(--yellow)' },
          { label: 'Interesados',  value: stats.interesados, color: 'var(--green)' },
          { label: 'Rellamar',     value: stats.rellamar,    color: '#3B82F6' },
        ].map(s => (
          <div key={s.label} className="stats-bar-item">
            <div className="stats-bar-label">{s.label}</div>
            <div className="stats-bar-value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`filter-pill${filter === t.key ? ' active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          placeholder="🔍 Buscar negocio, ciudad..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 200, fontSize: 13, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
        />
      </div>

      {/* Modo Dial banner */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(16,185,129,.08), rgba(59,130,246,.08))',
          border: '1px solid rgba(16,185,129,.3)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 16,
          gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#10B981', marginBottom: 2 }}>
              📞 Modo Dial — Llama directo desde el navegador
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>
              Tu número: <strong style={{ color: 'var(--text)' }}>(737) 339-8878</strong> · Austin TX ·
              {' '}{filtered.length} leads en este filtro
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => { setCurrentIdx(0); setDialMode(true); initTwilio(); }}
            style={{ whiteSpace: 'nowrap', padding: '10px 20px', fontSize: 14 }}
          >
            ▶ Empezar ({filtered.length})
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading">Cargando leads…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">Sin leads en este filtro</div>
      ) : (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '52px 1fr 110px 120px 160px 160px',
            padding: '8px 14px', fontSize: 10, fontWeight: 700,
            color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.07em',
            borderBottom: '1px solid var(--border)',
          }}>
            <span>Prior.</span><span>Negocio</span><span>Nicho</span>
            <span>Ciudad</span><span>Teléfono</span><span>Status</span>
          </div>

          {filtered.map((lead, idx) => (
            <LeadRow
              key={lead.row_index}
              lead={lead}
              idx={idx}
              updating={!!updating[lead.row_index]}
              onStatus={(s) => updateStatus(lead, s)}
            />
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
        {filtered.length} de {leads.length} leads · Status se guarda en Google Sheet
      </div>
    </div>
  );
}

/* ── Lead Row ─────────────────────────────────────────────────────────────── */
function LeadRow({ lead, idx, updating, onStatus }) {
  const [open, setOpen] = useState(false);
  const si = statusInfo(lead.status?.startsWith('Demo Agendado') ? 'Demo Agendado' : (lead.status || 'Sin contactar'));

  return (
    <>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'grid',
          gridTemplateColumns: '52px 1fr 110px 120px 160px 160px',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)',
        }}
      >
        <span style={{
          fontSize: 10.5, fontWeight: 700, alignSelf: 'center',
          color: lead.priority === 'P1' ? '#10B981' : lead.priority === 'P2' ? '#F59E0B' : 'var(--text3)',
        }}>
          {lead.priority || '—'}
        </span>

        <div style={{ minWidth: 0, alignSelf: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {lead.nombre}
          </div>
        </div>

        <span style={{ fontSize: 11.5, color: 'var(--text2)', alignSelf: 'center' }}>{lead.niche}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text2)', alignSelf: 'center' }}>{lead.city}, {lead.state}</span>

        <div style={{ alignSelf: 'center' }}>
          {lead.phone ? (
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
              📞 {fmtPhone(lead.phone)}
            </span>
          ) : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>}
        </div>

        <div style={{ alignSelf: 'center' }}>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
            background: si.bg, color: si.color, border: `1px solid ${si.color}33`,
            whiteSpace: 'nowrap',
          }}>
            {updating ? '⏳' : lead.status?.startsWith('Demo Agendado') ? lead.status : si.label}
          </span>
        </div>
      </div>

      {open && (
        <div style={{
          padding: '10px 14px 12px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text3)', marginRight: 4 }}>Marcar como:</span>
          {STATUSES.filter(s => s.key !== 'Sin contactar').map(s => (
            <button
              key={s.key}
              onClick={(e) => { e.stopPropagation(); onStatus(s.key); if (s.key !== 'Demo Agendado') setOpen(false); }}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                background: lead.status === s.key ? s.bg : 'var(--bg2)',
                color: lead.status === s.key ? s.color : 'var(--text2)',
                border: `1px solid ${lead.status === s.key ? s.color + '55' : 'var(--border)'}`,
              }}
            >
              {s.label}
            </button>
          ))}
          {lead.maps_url && (
            <a href={lead.maps_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--accent)', textDecoration: 'none' }}>
              🗺 Maps
            </a>
          )}
        </div>
      )}
    </>
  );
}

/* ── Dial Mode ────────────────────────────────────────────────────────────── */
function fmtDuration(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function DialMode({
  lead, idx, total, updating,
  twilioReady, twilioError, callState, callDuration,
  onCall, onHangUp,
  onStatus, onNext, onPrev, onExit,
}) {
  const si = statusInfo(
    lead.status?.startsWith('Demo Agendado') ? 'Demo Agendado' : (lead.status || 'Sin contactar')
  );

  const isActive = callState === 'in-call' || callState === 'connecting';

  const callBtnLabel = () => {
    if (callState === 'connecting') return '📞 Marcando…';
    if (callState === 'in-call')    return `📞 En llamada ${fmtDuration(callDuration)}`;
    if (callState === 'ended')      return '✅ Llamada terminada';
    return lead.phone ? `📞 Llamar — ${fmtPhone(lead.phone)}` : '📵 Sin teléfono';
  };

  const callBtnColor = () => {
    if (callState === 'connecting') return '#F59E0B';
    if (callState === 'in-call')    return '#10B981';
    if (callState === 'ended')      return '#6B7280';
    return '#10B981';
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 16 }}>
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
          Lead <strong style={{ color: 'var(--text)' }}>{idx + 1}</strong> / {total}
          {twilioReady && (
            <span style={{ marginLeft: 8, color: '#10B981', fontSize: 11 }}>● Twilio listo</span>
          )}
          {!twilioReady && !twilioError && (
            <span style={{ marginLeft: 8, color: '#F59E0B', fontSize: 11 }}>⏳ Conectando…</span>
          )}
        </div>
        <button onClick={onExit} className="btn btn-ghost btn-sm">✕ Salir modo dial</button>
      </div>

      {/* Twilio error */}
      {twilioError && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12,
          background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#EF4444',
        }}>
          ⚠️ {twilioError}
        </div>
      )}

      {/* Card */}
      <div style={{
        background: 'var(--bg2)', border: '2px solid var(--border)', borderRadius: 16,
        padding: '24px', marginBottom: 16, textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>
          {lead.priority} · {lead.niche}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{lead.nombre}</div>
        <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 20 }}>
          📍 {lead.city}, {lead.state}
        </div>

        {/* Call button */}
        {lead.phone ? (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              onClick={() => !isActive && onCall(lead.phone)}
              disabled={!twilioReady || isActive || callState === 'ended'}
              style={{
                flex: 1,
                padding: '16px 20px',
                background: isActive ? callBtnColor() : '#10B981',
                borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 800,
                border: 'none', cursor: (!twilioReady || isActive || callState === 'ended') ? 'not-allowed' : 'pointer',
                opacity: (!twilioReady || callState === 'ended') ? 0.6 : 1,
                transition: 'background .2s',
              }}
            >
              {callBtnLabel()}
            </button>
            {isActive && (
              <button
                onClick={onHangUp}
                style={{
                  padding: '16px 20px', background: '#EF4444',
                  borderRadius: 12, color: '#fff', fontSize: 16, fontWeight: 800,
                  border: 'none', cursor: 'pointer',
                }}
              >
                🔴 Colgar
              </button>
            )}
          </div>
        ) : (
          <div style={{ padding: 16, background: 'var(--bg3)', borderRadius: 12, color: 'var(--text3)', fontSize: 14 }}>
            Sin teléfono registrado
          </div>
        )}

        {/* Caller ID note */}
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text3)' }}>
          Tu número: <strong>(737) 339-8878</strong> · Austin TX
        </div>

        <div style={{ marginTop: 12 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
            background: si.bg, color: si.color, border: `1px solid ${si.color}44`,
          }}>
            {updating ? '⏳' : (lead.status?.startsWith('Demo Agendado') ? lead.status : si.label)}
          </span>
        </div>
      </div>

      {/* Status buttons */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, textAlign: 'center' }}>
          ¿Cómo salió la llamada?
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {STATUSES.filter(s => s.key !== 'Sin contactar').map(s => (
            <button
              key={s.key}
              onClick={() => onStatus(s.key)}
              style={{
                padding: '12px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: (lead.status === s.key || (s.key === 'Demo Agendado' && lead.status?.startsWith('Demo Agendado'))) ? s.bg : 'var(--bg2)',
                color: (lead.status === s.key || (s.key === 'Demo Agendado' && lead.status?.startsWith('Demo Agendado'))) ? s.color : 'var(--text)',
                border: `1.5px solid ${(lead.status === s.key || (s.key === 'Demo Agendado' && lead.status?.startsWith('Demo Agendado'))) ? s.color : 'var(--border)'}`,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onPrev} className="btn btn-ghost" style={{ flex: 1 }} disabled={idx === 0}>
          ‹ Anterior
        </button>
        <button onClick={onNext} className="btn btn-primary" style={{ flex: 1 }} disabled={idx >= total - 1}>
          Siguiente ›
        </button>
      </div>

      {lead.maps_url && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <a href={lead.maps_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--text3)' }}>
            🗺 Ver en Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
