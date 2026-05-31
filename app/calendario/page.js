'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';

const DIAS_S  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const HDRS_W  = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
const MESES   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const EV_COLORS = ['#7C3AED','#10B981','#EF4444','#F59E0B','#3B82F6','#EC4899','#14B8A6','#F97316'];
const TIPOS_EVENTO = ['DJ Set','Live Music','Pop-up','Omakase','Izakaya','Listening Bar','Colaboración','Otro'];
const ESTADO_COLOR = { confirmado: '#10B981', pendiente: '#F59E0B', cancelado: '#EF4444' };
const SESION_COLOR = '#3B82F6';
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = n => '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
const EMPTY_EV = { titulo: '', fecha: todayStr(), hora: '', tipo: '', estado: '', artista: '', cachet: '', color: EV_COLORS[0] };

export default function CalendarioPage() {
  const router = useRouter();
  const [eventos, setEventos]   = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [yaoOnline, setYaoOnline] = useState(true);
  const [calView, setCalView]   = useState('month');
  const [calOffset, setCalOffset] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_EV);

  const load = useCallback(async () => {
    try {
      const data = await fetch('/api/yao-proxy?resource=eventos', { cache: 'no-store' }).then(r => r.json());
      setEventos(Array.isArray(data) ? data : []);
      setYaoOnline(true);
    } catch { setEventos([]); setYaoOnline(false); }

    try {
      const s = await fetch('/api/sesiones', { cache: 'no-store' }).then(r => r.json());
      setSesiones(Array.isArray(s) ? s : []);
    } catch { setSesiones([]); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getItemsForDate = (ds) => {
    const evs = eventos
      .filter(e => e.fecha === ds)
      .map(e => ({ ...e, _source: 'yao', _color: e.estado ? (ESTADO_COLOR[e.estado] || e.color || '#7C3AED') : (e.color || '#7C3AED') }))
      .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    const sess = sesiones
      .filter(s => s.fecha === ds)
      .map(s => ({ ...s, _source: 'tigre', _color: SESION_COLOR, titulo: s.cliente || 'Sesión', tipo: s.tipo || '', artista: '', estado: s.status || '' }));
    return [...evs, ...sess];
  };

  const openAdd = (fecha) => {
    setEditing(null);
    setForm({ ...EMPTY_EV, fecha });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    if (item._source === 'tigre') { router.push('/studio'); return; }
    setEditing(item);
    setForm({ titulo: item.titulo, fecha: item.fecha, hora: item.hora || '', tipo: item.tipo || '', estado: item.estado || '', artista: item.artista || '', cachet: item.cachet ? String(item.cachet) : '', color: item.color || EV_COLORS[0] });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.fecha) return alert('Completa título y fecha');
    const body = { ...form, cachet: parseFloat(form.cachet) || 0 };
    if (editing) {
      await fetch(`/api/eventos-proxy/${editing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/yao-proxy?resource=eventos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setModalOpen(false);
    load(); router.refresh();
  };

  const handleDelete = async () => {
    if (!editing || !confirm('¿Eliminar este evento?')) return;
    await fetch(`/api/eventos-proxy/${editing.id}`, { method: 'DELETE' });
    setModalOpen(false);
    load(); router.refresh();
  };

  const now = new Date();

  const renderMonth = () => {
    const base = new Date(now.getFullYear(), now.getMonth() + calOffset, 1);
    const year = base.getFullYear(), month = base.getMonth();
    const td = todayStr();
    const startDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMon = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startDow + daysInMon) / 7) * 7;

    const cells = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startDow + 1;
      const cellDate = new Date(year, month, dayNum);
      const ds = cellDate.toISOString().slice(0, 10);
      const inMonth = dayNum >= 1 && dayNum <= daysInMon;
      const isToday = ds === td;
      const items = getItemsForDate(ds);

      cells.push(
        <div key={i} className={`cal-month-cell${isToday ? ' today' : ''}${!inMonth ? ' other-month' : ''}`} onClick={() => openAdd(ds)}>
          <div className="cal-date-num">{cellDate.getDate()}</div>
          {items.slice(0, 3).map((item, idx) => (
            <button key={`${item._source}-${item.id}-${idx}`} className="cal-ev"
              style={{ background: item._color }}
              onClick={ev => { ev.stopPropagation(); openEdit(item); }}
              title={(item._source === 'tigre' ? '📷 ' : '') + item.titulo}>
              {item.hora ? item.hora.slice(0, 5) + ' ' : ''}{item._source === 'tigre' ? '📷 ' : ''}{item.titulo}
            </button>
          ))}
          {items.length > 3 && <div style={{ fontSize: 10, color: 'var(--text2)', padding: '1px 4px' }}>+{items.length - 3} más</div>}
          <button className="cal-add" onClick={ev => { ev.stopPropagation(); openAdd(ds); }}>+</button>
        </div>
      );
    }
    return { label: `${MESES[month]} ${year}`, cells };
  };

  const getWeek = (off) => {
    const n = new Date(), day = n.getDay();
    const mon = new Date(n);
    mon.setDate(n.getDate() - (day === 0 ? 6 : day - 1) + off * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  };

  const renderWeek = () => {
    const days = getWeek(calOffset);
    const td = todayStr();
    const first = days[0], last = days[6];
    const cells = days.map(d => {
      const ds = d.toISOString().slice(0, 10);
      const items = getItemsForDate(ds);
      return (
        <div key={ds} className={`cal-cell${ds === td ? ' today' : ''}`}>
          <div className="cal-date-num">{d.getDate()}</div>
          {items.map((item, idx) => (
            <button key={`${item._source}-${item.id}-${idx}`} className="cal-ev"
              style={{ background: item._color }}
              onClick={() => openEdit(item)}
              title={(item._source === 'tigre' ? '📷 ' : '') + item.titulo}>
              {item.hora ? item.hora.slice(0, 5) + ' ' : ''}{item._source === 'tigre' ? '📷 ' : ''}{item.titulo}
            </button>
          ))}
          <button className="cal-add" onClick={() => openAdd(ds)}>+</button>
        </div>
      );
    });
    return { label: `${first.getDate()} ${MESES_S[first.getMonth()]} — ${last.getDate()} ${MESES_S[last.getMonth()]} ${last.getFullYear()}`, cells };
  };

  const monthData = calView === 'month' ? renderMonth() : null;
  const weekData  = calView === 'week'  ? renderWeek()  : null;
  const currentLabel = calView === 'month' ? monthData?.label : weekData?.label;

  const td = todayStr();
  const allItems = [
    ...eventos.map(e => ({ ...e, _source: 'yao', _color: e.estado ? (ESTADO_COLOR[e.estado] || e.color || '#7C3AED') : (e.color || '#7C3AED') })),
    ...sesiones.map(s => ({ ...s, _source: 'tigre', _color: SESION_COLOR, titulo: s.cliente || 'Sesión', tipo: s.tipo || '', artista: '', estado: s.status || '' })),
  ];
  const prox = allItems.filter(e => e.fecha >= td).sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 12);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Calendario</div>
          <div className="page-sub">
            Eventos YAO + Sesiones Tigre
            {!yaoOnline && <span style={{ marginLeft: 8, fontSize: 11, color: '#EF4444', fontWeight: 600 }}>· YAO offline</span>}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => openAdd(todayStr())}>+ Evento YAO</button>
      </div>

      {/* Leyenda */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['#7C3AED','Eventos YAO'],['#3B82F6','📷 Sesiones Tigre'],['#10B981','Confirmado'],['#F59E0B','Pendiente']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ color: 'var(--text2)' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={`filter-pill${calView === 'month' ? ' active' : ''}`} onClick={() => { setCalView('month'); setCalOffset(0); }}>Mensual</button>
          <button className={`filter-pill${calView === 'week' ? ' active' : ''}`}  onClick={() => { setCalView('week');  setCalOffset(0); }}>Semanal</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalOffset(o => o - 1)}>‹</button>
          <span style={{ minWidth: 180, textAlign: 'center', fontSize: 13.5, fontWeight: 600 }}>{currentLabel}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalOffset(o => o + 1)}>›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalOffset(0)}>Hoy</button>
        </div>
      </div>

      {/* Vista mensual */}
      {calView === 'month' && monthData && (
        <>
          <div className="cal-month-grid" style={{ marginBottom: 4 }}>
            {HDRS_W.map(h => <div key={h} className="cal-day-header">{h}</div>)}
          </div>
          <div className="cal-month-grid">{monthData.cells}</div>
        </>
      )}

      {/* Vista semanal */}
      {calView === 'week' && weekData && (
        <>
          <div className="g7">{HDRS_W.map(h => <div key={h} className="cal-day-header">{h}</div>)}</div>
          <div style={{ height: 6 }} />
          <div className="g7">{weekData.cells}</div>
        </>
      )}

      {/* Próximos eventos */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <div className="card-title">Próximos eventos</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span className="estado-badge estado-confirmado">● Confirmado</span>
            <span className="estado-badge estado-pendiente">● Pendiente</span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'rgba(59,130,246,.15)', color: '#3B82F6', border: '1px solid rgba(59,130,246,.25)', fontWeight: 600 }}>📷 Tigre</span>
          </div>
        </div>
        {prox.length ? prox.map((item, idx) => {
          const dt = new Date(item.fecha + 'T12:00');
          return (
            <div key={`${item._source}-${item.id}-${idx}`} className="colab-row" onClick={() => openEdit(item)}>
              <div className="colab-dot" style={{ background: item._color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{item._source === 'tigre' ? '📷 ' : ''}{item.titulo}</div>
                {item.artista && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>👤 {item.artista}</div>}
              </div>
              {item.tipo && <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{item.tipo}</span>}
              {item.cachet > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--green)', whiteSpace: 'nowrap' }}>{fmt(item.cachet)}</span>}
              {item.estado && <span className={`estado-badge estado-${item.estado}`}>{item.estado}</span>}
              <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{DIAS_S[dt.getDay()]} {dt.getDate()} {MESES_S[dt.getMonth()]}</span>
            </div>
          );
        }) : <div className="empty">Sin eventos próximos</div>}
      </div>

      {/* Modal — crear / editar eventos YAO */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar evento YAO' : 'Nuevo evento YAO'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <div className="form-group">
            <label className="form-label">Título del evento</label>
            <input type="text" value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Nombre del evento" style={{ width: '100%' }} autoFocus />
          </div>
          <div className="g2">
            <div className="form-group"><label className="form-label">Fecha</label><input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} style={{ width: '100%' }} /></div>
            <div className="form-group"><label className="form-label">Hora</label><input type="time" value={form.hora} onChange={e => setForm(p => ({ ...p, hora: e.target.value }))} style={{ width: '100%' }} /></div>
          </div>
          <div className="g2">
            <div className="form-group"><label className="form-label">Tipo de evento</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} style={{ width: '100%' }}>
                <option value="">— Seleccionar —</option>
                {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Estado</label>
              <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} style={{ width: '100%' }}>
                <option value="">— Seleccionar —</option>
                <option value="confirmado">✅ Confirmado</option>
                <option value="pendiente">🟡 Pendiente</option>
                <option value="cancelado">❌ Cancelado</option>
              </select>
            </div>
          </div>
          <div className="g2">
            <div className="form-group"><label className="form-label">👤 Artista / DJ</label><input type="text" value={form.artista} onChange={e => setForm(p => ({ ...p, artista: e.target.value }))} placeholder="Nombre" style={{ width: '100%' }} /></div>
            <div className="form-group"><label className="form-label">💰 Cachet</label><input type="number" value={form.cachet} onChange={e => setForm(p => ({ ...p, cachet: e.target.value }))} placeholder="$0" min="0" style={{ width: '100%' }} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {EV_COLORS.map(c => (
                <div key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: `2px solid ${form.color === c ? '#fff' : 'transparent'}` }} />
              ))}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="modal-footer">
          {editing && <button className="btn btn-danger" style={{ marginRight: 'auto' }} onClick={handleDelete}>Eliminar</button>}
          <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Guardar en YAO</button>
        </div>
      </Modal>
    </div>
  );
}
