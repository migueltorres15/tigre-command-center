'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIAS = ['Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Personal', 'Hogar', 'Servicios', 'Negocio', 'Otros'];
const CAT_ICONS  = { Comida:'🍔', Transporte:'🚗', Entretenimiento:'🎬', Salud:'💊', Personal:'👕', Hogar:'🏠', Servicios:'📱', Negocio:'💼', Otros:'🎁' };
const CAT_COLORS = { Comida:'#F59E0B', Transporte:'#3B82F6', Entretenimiento:'#EC4899', Salud:'#10B981', Personal:'#8B5CF6', Hogar:'#F97316', Servicios:'#14B8A6', Negocio:'#7C3AED', Otros:'#6B7280' };

const todayStr = () => new Date().toISOString().slice(0, 10);
const mesStr   = () => new Date().toISOString().slice(0, 7);

function fmt(n, moneda = 'MXN') {
  return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${moneda}`;
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const router = useRouter();
  const [tab, setTab]     = useState('resumen');
  const [mes, setMes]     = useState(mesStr());
  const [loading, setLoading] = useState(true);

  // Data
  const [ingresos,      setIngresos]      = useState([]);
  const [gastos,        setGastos]        = useState([]);
  const [gastosVars,    setGastosVars]    = useState([]);
  const [gastosPagos,   setGastosPagos]   = useState([]);
  const [deudas,        setDeudas]        = useState([]);
  const [presupuestos,  setPresupuestos]  = useState([]);

  // Ingreso form
  const [ingresoForm, setIngresoForm] = useState({ proyecto: 'Tigre Studio', descripcion: '', monto: '', moneda: 'MXN', fecha: todayStr() });
  const [savingIngreso, setSavingIngreso] = useState(false);

  // Gasto variable form
  const [varForm, setVarForm] = useState({ fecha: todayStr(), concepto: '', monto: '', categoria: 'Comida', nota: '' });
  const [savingVar, setSavingVar] = useState(false);
  const [catFilter, setCatFilter] = useState('Todas');

  // Gasto fijo edit modal
  const [editGastoOpen, setEditGastoOpen] = useState(false);
  const [editingGasto, setEditingGasto] = useState(null);
  const [gastoForm, setGastoForm] = useState({ nombre: '', monto: '', dia_vencimiento: '', frecuencia: 'mensual', notas: '', dia_pago: '', categoria_link: '' });

  // New gasto fijo form
  const [newGasto, setNewGasto] = useState({ nombre: '', monto: '', frecuencia: 'mensual', dia_pago: '' });
  const [addingGasto, setAddingGasto] = useState(false);

  // Deuda modal
  const [deudaModalOpen, setDeudaModalOpen] = useState(false);
  const [editingDeuda, setEditingDeuda] = useState(null);
  const [deudaForm, setDeudaForm] = useState({ nombre: '', monto: '', tipo: 'unica' });
  const [savingDeuda, setSavingDeuda] = useState(false);

  // Abonos inline
  const [abonoOpen, setAbonoOpen] = useState(null);
  const [abonoMonto, setAbonoMonto] = useState('');
  const [abonoNota, setAbonoNota] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);

  // YAO sync
  const [syncingYao, setSyncingYao] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  // Charts
  const catChartRef  = useRef(null);
  const catChartInst = useRef(null);
  const trendChartRef  = useRef(null);
  const trendChartInst = useRef(null);

  // ─── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [iRes, gRes, gvRes, gpRes, dRes, pRes] = await Promise.all([
        fetch(`/api/ingresos?mes=${mes}`, { cache: 'no-store' }),
        fetch('/api/gastos', { cache: 'no-store' }),
        fetch(`/api/gastos-variables?mes=${mes}`, { cache: 'no-store' }),
        fetch(`/api/gastos-fijos-pagos?mes=${mes}`, { cache: 'no-store' }),
        fetch('/api/deudas', { cache: 'no-store' }),
        fetch(`/api/presupuestos?mes=${mes}`, { cache: 'no-store' }),
      ]);
      const [i, g, gv, gp, d, p] = await Promise.all([iRes.json(), gRes.json(), gvRes.json(), gpRes.json(), dRes.json(), pRes.json()]);
      setIngresos(Array.isArray(i) ? i : []);
      setGastos(Array.isArray(g) ? g : []);
      setGastosVars(Array.isArray(gv) ? gv : []);
      setGastosPagos(Array.isArray(gp) ? gp : []);
      setDeudas(Array.isArray(d) ? d : []);
      setPresupuestos(Array.isArray(p) ? p : []);
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  // ─── Charts ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'variables' || !gastosVars.length) return;
    (async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      // Category donut
      if (catChartInst.current) { catChartInst.current.destroy(); catChartInst.current = null; }
      if (catChartRef.current) {
        const bycat = {};
        gastosVars.forEach(g => { bycat[g.categoria] = (bycat[g.categoria] || 0) + g.monto; });
        const labels = Object.keys(bycat);
        catChartInst.current = new Chart(catChartRef.current, {
          type: 'doughnut',
          data: { labels, datasets: [{ data: labels.map(l => bycat[l]), backgroundColor: labels.map(l => CAT_COLORS[l] || '#6B7280'), borderWidth: 0, hoverOffset: 6 }] },
          options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'right', labels: { color: '#666', font: { size: 11 }, padding: 8, boxWidth: 10 } }, tooltip: { backgroundColor: '#1A1A1A', titleColor: '#F0F0F0', bodyColor: '#888', callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)}` } } } }
        });
      }

      // Daily trend
      if (trendChartInst.current) { trendChartInst.current.destroy(); trendChartInst.current = null; }
      if (trendChartRef.current) {
        const byDate = {};
        gastosVars.forEach(g => { byDate[g.fecha] = (byDate[g.fecha] || 0) + g.monto; });
        const dates = Object.keys(byDate).sort();
        trendChartInst.current = new Chart(trendChartRef.current, {
          type: 'bar',
          data: {
            labels: dates.map(d => new Date(d + 'T12:00').getDate()),
            datasets: [{ label: 'Gasto del día', data: dates.map(d => byDate[d]), backgroundColor: 'rgba(239,68,68,.6)', borderRadius: 4, borderSkipped: false }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1A1A1A', titleColor: '#F0F0F0', bodyColor: '#888', callbacks: { label: c => ` ${fmt(c.parsed.y)}` } } }, scales: { x: { ticks: { color: '#444', font: { size: 10 } }, grid: { display: false } }, y: { ticks: { color: '#444', font: { size: 10 }, callback: v => fmt(v) }, grid: { color: 'rgba(255,255,255,.03)' } } } }
        });
      }
    })();
    return () => {
      if (catChartInst.current) { catChartInst.current.destroy(); catChartInst.current = null; }
      if (trendChartInst.current) { trendChartInst.current.destroy(); trendChartInst.current = null; }
    };
  }, [gastosVars, tab]);

  // ─── Calculations ────────────────────────────────────────────────────────────
  const totalIngresosMes = ingresos.reduce((a, i) => a + (i.monto || 0), 0);
  const totalGastosFijos = gastos.reduce((a, g) => a + (g.monto || 0), 0);
  const totalGastosVars  = gastosVars.reduce((a, g) => a + (g.monto || 0), 0);
  const deudaActiva      = deudas.filter(d => !d.pagada).reduce((a, d) => a + (d.monto || 0), 0);
  const utilidad         = totalIngresosMes - totalGastosFijos - totalGastosVars;

  // Gastos fijos payment stats (for current month)
  const fijosMensuales    = gastosPagos.filter(g => g.frecuencia !== 'semanal');
  const fijosSemanales    = gastosPagos.filter(g => g.frecuencia === 'semanal');
  const fijosPagados      = fijosMensuales.filter(g => g.pagado).length;
  const fijosTotal        = fijosMensuales.length;
  const montoPagado       = fijosMensuales.filter(g => g.pagado).reduce((a, g) => a + (g.monto || 0), 0);
  const montoPendiente    = fijosMensuales.filter(g => !g.pagado).reduce((a, g) => a + (g.monto || 0), 0);
  const semPagados        = fijosSemanales.filter(g => g.pagado).length;
  const semTotal          = fijosSemanales.length;

  // Gastos variables KPIs
  const daysInMonth    = new Date(parseInt(mes.slice(0,4)), parseInt(mes.slice(5,7)), 0).getDate();
  const daysPassed     = mes === mesStr() ? new Date().getDate() : daysInMonth;
  const promDiario     = daysPassed > 0 ? Math.round(totalGastosVars / daysPassed) : 0;
  const bycat          = {};
  gastosVars.forEach(g => { bycat[g.categoria] = (bycat[g.categoria] || 0) + g.monto; });
  const topCat         = Object.entries(bycat).sort((a, b) => b[1] - a[1])[0];
  const daysWithSpend  = new Set(gastosVars.map(g => g.fecha)).size;

  const META_AHORRO = 20000;
  const BUDGET_VARS = 8000; // Monthly budget for variable expenses

  // ─── Handlers: Ingresos ─────────────────────────────────────────────────────
  const handleIngresoSubmit = async (e) => {
    e.preventDefault();
    if (!ingresoForm.monto) return;
    setSavingIngreso(true);
    try {
      await fetch('/api/ingresos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...ingresoForm, monto: parseFloat(ingresoForm.monto) }) });
      setIngresoForm(p => ({ ...p, descripcion: '', monto: '', fecha: todayStr() }));
      load(); router.refresh();
    } finally { setSavingIngreso(false); }
  };
  const handleDeleteIngreso = async (id) => {
    if (!window.confirm('¿Eliminar ingreso?')) return;
    await fetch(`/api/ingresos/${id}`, { method: 'DELETE' });
    load(); router.refresh();
  };

  // ─── Handlers: Gastos Variables ──────────────────────────────────────────────
  const handleVarSubmit = async (e) => {
    e.preventDefault();
    if (!varForm.concepto || !varForm.monto) return;
    setSavingVar(true);
    try {
      await fetch('/api/gastos-variables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...varForm, monto: parseFloat(varForm.monto) }) });
      setVarForm(p => ({ ...p, concepto: '', monto: '', nota: '' }));
      load(); router.refresh();
    } finally { setSavingVar(false); }
  };
  const handleDeleteVar = async (id) => {
    await fetch(`/api/gastos-variables/${id}`, { method: 'DELETE' });
    load(); router.refresh();
  };

  // ─── Handlers: Gastos Fijos ──────────────────────────────────────────────────
  const openEditGasto = (g) => {
    setEditingGasto(g);
    setGastoForm({ nombre: g.nombre, monto: String(g.monto || ''), dia_vencimiento: g.dia_vencimiento || '', frecuencia: g.frecuencia || 'mensual', notas: g.notas || '', dia_pago: String(g.dia_pago || ''), categoria_link: g.categoria_link || '' });
    setEditGastoOpen(true);
  };
  const handleGastoSave = async (e) => {
    e.preventDefault();
    await fetch(`/api/gastos/${editingGasto.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...gastoForm, monto: parseFloat(gastoForm.monto) || 0 }) });
    setEditGastoOpen(false);
    load(); router.refresh();
  };
  const handleGastoDelete = async (id) => {
    if (!window.confirm('¿Eliminar gasto fijo?')) return;
    await fetch(`/api/gastos/${id}`, { method: 'DELETE' });
    load(); router.refresh();
  };
  const handleAddGasto = async (e) => {
    e.preventDefault();
    if (!newGasto.nombre || !newGasto.monto) return;
    setAddingGasto(true);
    try {
      await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: newGasto.nombre,
          monto: parseFloat(newGasto.monto),
          frecuencia: newGasto.frecuencia || 'mensual',
          dia_pago: parseInt(newGasto.dia_pago) || 0,
        }),
      });
      setNewGasto({ nombre: '', monto: '', frecuencia: 'mensual', dia_pago: '' });
      load(); router.refresh();
    } finally { setAddingGasto(false); }
  };

  // ─── Handlers: Pago de gasto fijo ────────────────────────────────────────────
  const togglePagoFijo = async (g) => {
    const nuevoPagado = !g.pagado;
    await fetch('/api/gastos-fijos-pagos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gasto_id: g.id, periodo: g.periodo, pagado: nuevoPagado, fecha_pago: nuevoPagado ? todayStr() : null }),
    });
    load(); router.refresh();
  };

  // ─── Handlers: Deudas ────────────────────────────────────────────────────────
  const toggleDeuda = async (d) => {
    await fetch(`/api/deudas/${d.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pagada: !d.pagada }) });
    load(); router.refresh();
  };
  const openDeudaModal = (d = null) => {
    setEditingDeuda(d);
    setDeudaForm(d ? { nombre: d.nombre, monto: d.monto, tipo: d.tipo } : { nombre: '', monto: '', tipo: 'unica' });
    setDeudaModalOpen(true);
  };
  const handleDeudaSubmit = async (e) => {
    e.preventDefault();
    setSavingDeuda(true);
    try {
      const body = { ...deudaForm, monto: parseFloat(deudaForm.monto) };
      if (editingDeuda) {
        await fetch(`/api/deudas/${editingDeuda.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      } else {
        await fetch('/api/deudas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      }
      setDeudaModalOpen(false);
      load(); router.refresh();
    } finally { setSavingDeuda(false); }
  };
  const handleDeleteDeuda = async (id) => {
    if (!window.confirm('¿Eliminar deuda?')) return;
    await fetch(`/api/deudas/${id}`, { method: 'DELETE' });
    load(); router.refresh();
  };
  const agregarAbono = async (deudaId) => {
    const m = parseFloat(abonoMonto);
    if (!m || m <= 0) return;
    setSavingAbono(true);
    try {
      await fetch(`/api/deudas/${deudaId}/abonos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monto: m, nota: abonoNota }),
      });
      setAbonoMonto(''); setAbonoNota(''); setAbonoOpen(null);
      load(); router.refresh();
    } finally { setSavingAbono(false); }
  };
  const abonoColor = (pct) => pct >= 100 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)';

  // ─── YAO Sync ────────────────────────────────────────────────────────────────
  const syncYao = async () => {
    setSyncingYao(true); setSyncResult(null);
    try {
      const res = await fetch('/api/sync-yao', { method: 'POST' });
      const data = await res.json();
      setSyncResult(data);
      if (data.ok) { load(); router.refresh(); }
    } catch { setSyncResult({ error: 'No se pudo conectar con YAO' }); }
    finally { setSyncingYao(false); }
  };

  // ─── Due date urgency ────────────────────────────────────────────────────────
  const getDueStatus = (g) => {
    if (g.pagado) return 'pagado';
    const today = new Date().getDate();
    // Preferir dia_pago numérico si está disponible
    const diaPago = parseInt(g.dia_pago);
    if (diaPago > 0) {
      const diff = today - diaPago;
      if (diff > 3)  return 'vencido';
      if (diff >= -3) return 'urgente';
      return 'normal';
    }
    // Fallback: dia_vencimiento texto legado
    const dv = g.dia_vencimiento || '';
    if (!dv) return 'normal';
    const match = dv.match(/(\d+)(?:–|-|\s)(\d+)/);
    if (match) {
      const end = parseInt(match[2]);
      if (today > end + 3) return 'vencido';
      if (today >= parseInt(match[1]) - 2) return 'urgente';
      return 'normal';
    }
    return 'normal';
  };

  const dueColor = { pagado: 'var(--green)', vencido: 'var(--red)', urgente: 'var(--yellow)', normal: 'var(--text2)' };
  const dueLabel = { pagado: '✅ Pagado', vencido: '🔴 Vencido', urgente: '🟡 Próximo', normal: '⚪ Pendiente' };

  const filteredVars = catFilter === 'Todas' ? gastosVars : gastosVars.filter(g => g.categoria === catFilter);

  if (loading) return <div className="loading">Cargando finanzas...</div>;

  // ─── Tabs ─────────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'resumen',   label: '📊 Resumen' },
    { id: 'fijos',     label: '📋 Gastos Fijos' },
    { id: 'variables', label: '📝 Gastos del Día' },
  ];

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Finanzas</h1>
          <p className="page-subtitle">Control financiero personal</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select value={mes} onChange={e => setMes(e.target.value)} style={{ width: 140 }}>
            {Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i);
              const v = d.toISOString().slice(0, 7);
              return <option key={v} value={v}>{d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</option>;
            })}
          </select>
          <button className="btn btn-primary" onClick={syncYao} disabled={syncingYao} style={{ gap: 6 }}>
            {syncingYao ? '⏳' : '🔄'} Sync YAO
          </button>
          {syncResult && <span style={{ fontSize: 11, color: syncResult.error ? 'var(--red)' : 'var(--green)' }}>{syncResult.error || `✅ ${syncResult.message}`}</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ background: 'none', border: 'none', padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: tab === t.id ? 'var(--accent2)' : 'var(--text2)', borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent', transition: 'all .15s', fontFamily: 'inherit' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════ RESUMEN */}
      {tab === 'resumen' && (
        <div>
          {/* KPI row */}
          <div className="stats-grid" style={{ marginBottom: 16 }}>
            <div className="metric-card metric-card--green">
              <div className="metric-card-label">Ingresos del mes</div>
              <div className="metric-card-value">{fmt(totalIngresosMes)}</div>
              <div className="metric-card-sub">{ingresos.length} registros</div>
            </div>
            <div className="metric-card metric-card--red">
              <div className="metric-card-label">Gastos fijos</div>
              <div className="metric-card-value">{fmt(totalGastosFijos)}</div>
              <div className="metric-card-sub">{fijosPagados}/{fijosTotal} pagados</div>
            </div>
            <div className="metric-card" style={{ borderColor: 'rgba(239,68,68,.2)' }}>
              <div className="metric-card-label">Gastos del día (acum.)</div>
              <div className="metric-card-value" style={{ color: 'var(--red)' }}>{fmt(totalGastosVars)}</div>
              <div className="metric-card-sub">Prom. {fmt(promDiario)}/día</div>
            </div>
            <div className="metric-card metric-card--yellow">
              <div className="metric-card-label">Deuda activa</div>
              <div className="metric-card-value">{fmt(deudaActiva)}</div>
              <div className="metric-card-sub">{deudas.filter(d => !d.pagada).length} pendientes</div>
            </div>
            <div className="metric-card metric-card--accent">
              <div className="metric-card-label">Utilidad estimada</div>
              <div className="metric-card-value" style={{ color: utilidad >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(utilidad)}</div>
              <div className="metric-card-sub">Ingresos − Fijos − Variables</div>
            </div>
          </div>

          {/* Ahorro progress */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div className="card-title">Meta de ahorro mensual</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: utilidad >= META_AHORRO ? 'var(--green)' : 'var(--accent2)' }}>
                {Math.round(Math.max(0, utilidad) / META_AHORRO * 100)}% de {fmt(META_AHORRO)}
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.max(0, utilidad / META_AHORRO * 100))}%`, background: utilidad >= META_AHORRO ? 'var(--green)' : 'var(--accent)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text2)', marginTop: 6 }}>
              <span>Utilidad actual: <strong style={{ color: utilidad >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(utilidad)}</strong></span>
              <span>Falta: <strong>{fmt(Math.max(0, META_AHORRO - utilidad))}</strong></span>
            </div>
          </div>

          {/* Three columns */}
          <div className="three-col">
            {/* Ingresos */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 10 }}>Registrar ingreso</div>
              <form onSubmit={handleIngresoSubmit}>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Proyecto</label>
                  <select value={ingresoForm.proyecto} onChange={e => setIngresoForm(p => ({ ...p, proyecto: e.target.value }))}>
                    {['Tigre Studio', 'Sitios Web', 'Fotografía', 'YAO', 'Personal'].map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Descripción</label>
                  <input type="text" placeholder="¿De qué es?" value={ingresoForm.descripcion} onChange={e => setIngresoForm(p => ({ ...p, descripcion: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Monto *</label>
                    <input type="number" placeholder="0" min="0" value={ingresoForm.monto} onChange={e => setIngresoForm(p => ({ ...p, monto: e.target.value }))} required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Moneda</label>
                    <select value={ingresoForm.moneda} onChange={e => setIngresoForm(p => ({ ...p, moneda: e.target.value }))}>
                      <option>MXN</option><option>USD</option>
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Fecha</label>
                  <input type="date" value={ingresoForm.fecha} onChange={e => setIngresoForm(p => ({ ...p, fecha: e.target.value }))} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingIngreso}>
                  {savingIngreso ? 'Guardando...' : '+ Registrar ingreso'}
                </button>
              </form>
              <div style={{ marginTop: 12 }}>
                {ingresos.map(i => (
                  <div key={i.id} className="list-item">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{i.proyecto}</div>
                      {i.descripcion && <div style={{ fontSize: 11, color: 'var(--text2)' }}>{i.descripcion}</div>}
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{fmtDate(i.fecha)}</div>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--green)', fontSize: 13 }}>{fmt(i.monto, i.moneda)}</span>
                    <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm('¿Eliminar?')) handleDeleteIngreso(i.id); }}>×</button>
                  </div>
                ))}
                <div className="list-total">
                  <span className="list-total-label">Total mes</span>
                  <span className="list-total-amount" style={{ color: 'var(--green)' }}>{fmt(totalIngresosMes)}</span>
                </div>
              </div>
            </div>

            {/* Gastos fijos resumen */}
            <div className="card">
              <div className="card-head">
                <div className="card-title">Fijos — resumen</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setTab('fijos')}>Ver detalle →</button>
              </div>
              {/* Payment progress */}
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text2)' }}>{fijosPagados} de {fijosTotal} pagados</span>
                  <span style={{ fontWeight: 600, color: montoPagado > 0 ? 'var(--green)' : 'var(--text2)' }}>{fmt(montoPagado)}</span>
                </div>
                <div className="progress-bar" style={{ height: 5 }}>
                  <div className="progress-bar-fill progress-bar-fill--green" style={{ width: `${fijosTotal ? Math.round(fijosPagados / fijosTotal * 100) : 0}%` }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 5 }}>Pendiente: {fmt(montoPendiente)}</div>
              </div>
              {/* Overdue/urgent list */}
              {fijosMensuales.filter(g => !g.pagado && ['vencido','urgente'].includes(getDueStatus(g))).map(g => (
                <div key={`${g.id}-${g.periodo}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                  <span style={{ fontSize: 12, color: dueColor[getDueStatus(g)] }}>● {g.nombre}</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>{fmt(g.monto)}</span>
                </div>
              ))}
            </div>

            {/* Deudas */}
            <div className="card">
              <div className="card-head">
                <div className="card-title">Deudas</div>
                <button className="btn btn-primary btn-sm" onClick={() => openDeudaModal()}>+ Nueva</button>
              </div>
              {deudas.map(d => {
                const abonado = d.abonado || 0;
                const saldo   = Math.max(0, d.monto - abonado);
                const pct     = d.monto > 0 ? Math.min(100, Math.round(abonado / d.monto * 100)) : 0;
                const color   = abonoColor(pct);
                const isOpen  = abonoOpen === d.id;
                return (
                  <div key={d.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" className="deuda-checkbox" checked={!!d.pagada} onChange={() => toggleDeuda(d)} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="deuda-nombre" style={{ textDecoration: d.pagada ? 'line-through' : 'none' }}>{d.nombre}</div>
                        <div className="deuda-tipo">{d.tipo === 'mensual' ? 'Mensual' : 'Única vez'}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color }}>{fmt(saldo)} <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400 }}>saldo</span></div>
                        {abonado > 0 && <div style={{ fontSize: 10, color: 'var(--green)' }}>Abonado: {fmt(abonado)}</div>}
                      </div>
                      {!d.pagada && (
                        <button onClick={() => { setAbonoOpen(isOpen ? null : d.id); setAbonoMonto(''); setAbonoNota(''); }}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(59,130,246,.3)', background: 'rgba(59,130,246,.08)', color: '#3B82F6', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                          {isOpen ? '✕' : '+ Abonar'}
                        </button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => openDeudaModal(d)}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDeuda(d.id)}>×</button>
                    </div>
                    {/* Progress bar */}
                    <div style={{ marginTop: 6, marginLeft: 24 }}>
                      <div style={{ background: 'var(--bg3)', borderRadius: 99, height: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 99, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{pct}% pagado</div>
                    </div>
                    {/* Panel abono */}
                    {isOpen && (
                      <div style={{ marginTop: 8, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', marginBottom: 8 }}>Registrar abono</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input type="number" placeholder={`Máx ${fmt(saldo)}`} value={abonoMonto} onChange={e => setAbonoMonto(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarAbono(d.id)} style={{ flex: 1 }} autoFocus />
                          <input type="text" placeholder="Nota (opcional)" value={abonoNota} onChange={e => setAbonoNota(e.target.value)} style={{ flex: 2 }} />
                          <button onClick={() => agregarAbono(d.id)} disabled={savingAbono} style={{ background: '#3B82F6', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {savingAbono ? '…' : 'OK'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="list-total">
                <span className="list-total-label">Total activo</span>
                <span className="list-total-amount" style={{ color: 'var(--red)' }}>{fmt(deudaActiva)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════ GASTOS FIJOS */}
      {tab === 'fijos' && (
        <div>
          {/* Payment summary bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pagados</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>{fijosPagados}<span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 400 }}>/{fijosTotal}</span></div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmt(montoPagado)}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Pendientes</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--red)' }}>{fijosTotal - fijosPagados}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{fmt(montoPendiente)}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Total fijos</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(totalGastosFijos)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{gastos.length} conceptos</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Semanal (pensión)</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent2)' }}>{semPagados}<span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 400 }}>/{semTotal}</span></div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>semanas pagadas</div>
            </div>
          </div>

          <div className="g2">
            {/* Monthly gastos */}
            <div className="card">
              <div className="card-head">
                <div className="card-title">Gastos mensuales</div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{mes}</div>
              </div>
              {fijosMensuales.map(g => {
                const st = getDueStatus(g);
                return (
                  <div key={`${g.id}-${g.periodo}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--border)', opacity: g.pagado ? 0.6 : 1 }}>
                    {/* Toggle */}
                    <label style={{ flexShrink: 0 }}>
                      <input type="checkbox" checked={!!g.pagado} onChange={() => togglePagoFijo(g)} style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                    </label>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, textDecoration: g.pagado ? 'line-through' : 'none', color: g.pagado ? 'var(--text2)' : 'var(--text)' }}>{g.nombre}</div>
                      {g.dia_vencimiento && (
                        <div style={{ fontSize: 10, color: dueColor[st], marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          📅 {g.dia_vencimiento} · {dueLabel[st]}
                        </div>
                      )}
                      {g.pagado && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--green)' }}>Pagado el</span>
                          <input type="date" value={g.fecha_pago || ''} onChange={async e => {
                            await fetch('/api/gastos-fijos-pagos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gasto_id: g.id, periodo: g.periodo, pagado: true, fecha_pago: e.target.value }) });
                            load(); router.refresh();
                          }} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, border: '1px solid rgba(16,185,129,.3)', background: 'rgba(16,185,129,.06)', color: '#10B981', cursor: 'pointer' }} />
                        </div>
                      )}
                    </div>
                    {/* Amount */}
                    <span style={{ fontWeight: 700, fontSize: 13, color: g.pagado ? 'var(--green)' : 'var(--text)', whiteSpace: 'nowrap' }}>{fmt(g.monto)}</span>
                    {/* Edit */}
                    <button className="btn btn-ghost btn-sm" onClick={() => openEditGasto(g)} style={{ padding: '2px 6px' }}>✏️</button>
                  </div>
                );
              })}
              {/* Add new */}
              <form onSubmit={handleAddGasto} style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input type="text" placeholder="Nuevo gasto fijo..." value={newGasto.nombre} onChange={e => setNewGasto(p => ({ ...p, nombre: e.target.value }))} style={{ flex: 3 }} />
                  <input type="number" placeholder="$0" min="0" value={newGasto.monto} onChange={e => setNewGasto(p => ({ ...p, monto: e.target.value }))} style={{ flex: 1, minWidth: 70 }} />
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={newGasto.frecuencia} onChange={e => setNewGasto(p => ({ ...p, frecuencia: e.target.value }))} style={{ flex: 2 }}>
                    <option value="mensual">Pago recurrente (mensual)</option>
                    <option value="semanal">Semanal</option>
                    <option value="unica">Pago único</option>
                  </select>
                  <input type="number" min="1" max="31" placeholder="Día vence" value={newGasto.dia_pago} onChange={e => setNewGasto(p => ({ ...p, dia_pago: e.target.value }))} style={{ flex: 1, minWidth: 70 }} title="Día del mes en que vence (1-31)" />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={addingGasto}>+ Agregar</button>
                </div>
              </form>
              <div className="list-total" style={{ marginTop: 8 }}>
                <span className="list-total-label">Total mensual</span>
                <span className="list-total-amount">{fmt(totalGastosFijos)}</span>
              </div>
            </div>

            {/* Weekly gastos (pensión) */}
            <div>
              {fijosSemanales.length > 0 && (
                <div className="card" style={{ marginBottom: 14 }}>
                  <div className="card-head">
                    <div className="card-title">Pagos semanales — Pensión</div>
                    <span style={{ fontSize: 11, color: 'var(--text2)' }}>{semPagados}/{semTotal} semanas</span>
                  </div>
                  {/* Group by gasto */}
                  {Object.entries(
                    fijosSemanales.reduce((acc, g) => { (acc[g.id] = acc[g.id] || { ...g, semanas: [] }).semanas.push(g); return acc; }, {})
                  ).map(([id, data]) => (
                    <div key={id} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{data.nombre}</span>
                        <span>{fmt(data.monto)}/semana</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                        {data.semanas.map(s => (
                          <label key={s.periodo} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: s.pagado ? 'rgba(16,185,129,.1)' : 'var(--bg3)', border: `1px solid ${s.pagado ? 'rgba(16,185,129,.3)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 4px', cursor: 'pointer', transition: 'all .15s' }}>
                            <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600 }}>Sem {s.semana}</span>
                            <input type="checkbox" checked={!!s.pagado} onChange={() => togglePagoFijo(s)} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
                            <span style={{ fontSize: 10, color: s.pagado ? 'var(--green)' : 'var(--text3)' }}>{s.pagado ? '✓ Pagado' : 'Pendiente'}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upcoming payments calendar hint */}
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}>📅 Fechas de pago este mes</div>
                {gastos.filter(g => g.dia_vencimiento).map(g => (
                  <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{g.nombre}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>{g.dia_vencimiento}</div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{fmt(g.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ GASTOS VARIABLES */}
      {tab === 'variables' && (
        <div>

          {/* ── Presupuestos por categoría ── */}
          {presupuestos.length > 0 && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-head" style={{ marginBottom: 14 }}>
                <div className="card-title">📊 Presupuestos del mes</div>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Día {presupuestos[0]?.diasTranscurridos} de {presupuestos[0]?.diasEnMes}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {presupuestos.map(p => {
                  // Color logic
                  const color = p.pct >= 100 ? '#EF4444'       // rojo: pasado
                               : p.pct >= 85  ? '#EF4444'       // rojo: casi
                               : p.pct >= 65  ? '#F59E0B'       // amarillo: llegando
                               : '#10B981';                      // verde: bien

                  // Proyección color
                  const pctProyeccion = p.presupuesto > 0 ? Math.round(p.proyeccion / p.presupuesto * 100) : 0;
                  const proyColor = pctProyeccion >= 100 ? '#EF4444' : pctProyeccion >= 85 ? '#F59E0B' : '#10B981';

                  // Status message
                  const statusMsg = p.pct >= 100
                    ? `⛔ Límite superado en ${fmt(Math.abs(p.restante))}`
                    : p.pct >= 85
                    ? `🔴 Quedan ${fmt(p.restante)} — ${p.diasRestantes} días`
                    : p.pct >= 65
                    ? `🟡 Quedan ${fmt(p.restante)} — ${p.diasRestantes} días`
                    : `✅ Quedan ${fmt(p.restante)} — vas bien`;

                  return (
                    <div key={p.id}>
                      {/* Header row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</span>
                          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: color + '20', color, fontWeight: 600 }}>
                            {p.categoria_link}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color }}>{fmt(p.gastado)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text3)' }}> / {fmt(p.presupuesto)}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div style={{ position: 'relative', background: 'var(--bg3)', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: 5 }}>
                        {/* Barra principal */}
                        <div style={{
                          width: `${Math.min(100, p.pct)}%`,
                          background: color,
                          height: '100%',
                          borderRadius: 99,
                          transition: 'width .5s ease',
                        }} />
                        {/* Marca de proyección fin de mes */}
                        {p.diasTranscurridos < p.diasEnMes && p.proyeccion > 0 && (
                          <div style={{
                            position: 'absolute',
                            top: 0, bottom: 0,
                            left: `${Math.min(100, pctProyeccion)}%`,
                            width: 2,
                            background: proyColor,
                            opacity: 0.6,
                          }} />
                        )}
                      </div>

                      {/* Footer row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                        <span style={{ color }}>{statusMsg}</span>
                        <span>
                          Proyección fin de mes:
                          <strong style={{ color: proyColor, marginLeft: 4 }}>{fmt(p.proyeccion)}</strong>
                          <span style={{ color: 'var(--text3)', marginLeft: 4 }}>({pctProyeccion}%)</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 20 }}>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Total del mes</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: totalGastosVars > BUDGET_VARS ? 'var(--red)' : 'var(--text)' }}>{fmt(totalGastosVars)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>Meta: {fmt(BUDGET_VARS)}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Promedio diario</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{fmt(promDiario)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{daysPassed} días registrados</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Top categoría</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{topCat ? CAT_ICONS[topCat[0]] + ' ' + topCat[0] : '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--red)' }}>{topCat ? fmt(topCat[1]) : ''}</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Días con gastos</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{daysWithSpend}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>de {daysPassed} transcurridos</div>
            </div>
            <div className="stat-card">
              <div style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Budget restante</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: BUDGET_VARS - totalGastosVars < 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(BUDGET_VARS - totalGastosVars)}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)' }}>{Math.round(totalGastosVars / BUDGET_VARS * 100)}% usado</div>
            </div>
          </div>

          {/* Budget progress */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <div className="card-title">Budget mensual gastos variables</div>
              <span style={{ fontSize: 11, color: totalGastosVars > BUDGET_VARS ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                {fmt(totalGastosVars)} / {fmt(BUDGET_VARS)}
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${Math.min(100, totalGastosVars / BUDGET_VARS * 100)}%`, background: totalGastosVars > BUDGET_VARS ? 'var(--red)' : totalGastosVars > BUDGET_VARS * 0.8 ? 'var(--yellow)' : 'var(--green)' }} />
            </div>
          </div>

          <div className="g2" style={{ marginBottom: 16 }}>
            {/* Quick add form */}
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Registrar gasto</div>
              <form onSubmit={handleVarSubmit}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Fecha</label>
                    <input type="date" value={varForm.fecha} onChange={e => setVarForm(p => ({ ...p, fecha: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Categoría</label>
                    <select value={varForm.categoria} onChange={e => setVarForm(p => ({ ...p, categoria: e.target.value }))}>
                      {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Concepto *</label>
                  <input type="text" placeholder="¿En qué gastaste?" value={varForm.concepto} onChange={e => setVarForm(p => ({ ...p, concepto: e.target.value }))} required />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label className="form-label">Monto *</label>
                    <input type="number" placeholder="0" min="0" step="0.01" value={varForm.monto} onChange={e => setVarForm(p => ({ ...p, monto: e.target.value }))} required />
                  </div>
                  <div className="form-group" style={{ flex: 3 }}>
                    <label className="form-label">Nota (opcional)</label>
                    <input type="text" placeholder="Dónde, con quién..." value={varForm.nota} onChange={e => setVarForm(p => ({ ...p, nota: e.target.value }))} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={savingVar}>
                  {savingVar ? 'Guardando...' : '+ Agregar gasto'}
                </button>
              </form>

              {/* Category breakdown */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Por categoría</div>
                {Object.entries(bycat).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                  const pct = totalGastosVars > 0 ? Math.round(total / totalGastosVars * 100) : 0;
                  return (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                        <span style={{ color: CAT_COLORS[cat] || '#6B7280' }}>{CAT_ICONS[cat]} {cat}</span>
                        <span style={{ fontWeight: 600 }}>{fmt(total)} <span style={{ color: 'var(--text3)', fontWeight: 400 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ background: 'var(--bg4)', borderRadius: 20, height: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 20, background: CAT_COLORS[cat] || '#6B7280', width: `${pct}%`, transition: 'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Charts */}
            <div>
              <div className="card" style={{ marginBottom: 14 }}>
                <div className="card-head"><div className="card-title">Distribución</div></div>
                <div style={{ height: 200, position: 'relative' }}><canvas ref={catChartRef} /></div>
              </div>
              <div className="card">
                <div className="card-head"><div className="card-title">Gasto diario — {mes}</div></div>
                <div style={{ height: 160, position: 'relative' }}><canvas ref={trendChartRef} /></div>
              </div>
            </div>
          </div>

          {/* Expense list */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">Historial</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['Todas', ...CATEGORIAS].map(c => (
                  <button key={c} className={`filter-pill${catFilter === c ? ' active' : ''}`} onClick={() => setCatFilter(c)} style={{ padding: '2px 8px', fontSize: 11 }}>
                    {c !== 'Todas' ? CAT_ICONS[c] + ' ' : ''}{c}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Nota</th><th style={{ textAlign: 'right' }}>Monto</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredVars.length ? filteredVars.map(g => (
                    <tr key={g.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>{fmtDate(g.fecha)}</td>
                      <td><span style={{ background: CAT_COLORS[g.categoria] + '22', color: CAT_COLORS[g.categoria], borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{CAT_ICONS[g.categoria]} {g.categoria}</span></td>
                      <td style={{ fontWeight: 500 }}>{g.concepto}</td>
                      <td style={{ color: 'var(--text2)', fontSize: 12 }}>{g.nota || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)', whiteSpace: 'nowrap' }}>{fmt(g.monto)}</td>
                      <td><button className="btn-icon" onClick={() => handleDeleteVar(g.id)}>✕</button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: '24px 0' }}>Sin gastos en este mes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="list-total">
              <span className="list-total-label">Total filtrado</span>
              <span className="list-total-amount" style={{ color: 'var(--red)' }}>{fmt(filteredVars.reduce((a, g) => a + g.monto, 0))}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit gasto fijo modal */}
      <Modal open={editGastoOpen} onClose={() => setEditGastoOpen(false)} title="Editar gasto fijo">
        <form onSubmit={handleGastoSave}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Nombre</label>
              <input type="text" value={gastoForm.nombre} onChange={e => setGastoForm(p => ({ ...p, nombre: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Monto mensual</label>
              <input type="number" min="0" value={gastoForm.monto} onChange={e => setGastoForm(p => ({ ...p, monto: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Frecuencia</label>
              <select value={gastoForm.frecuencia} onChange={e => setGastoForm(p => ({ ...p, frecuencia: e.target.value }))}>
                <option value="mensual">Mensual</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Día de vencimiento (1–31)</label>
              <input type="number" min="1" max="31" placeholder="Día del mes" value={gastoForm.dia_pago} onChange={e => setGastoForm(p => ({ ...p, dia_pago: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Categoría presupuesto</label>
              <select value={gastoForm.categoria_link} onChange={e => setGastoForm(p => ({ ...p, categoria_link: e.target.value }))}>
                <option value="">— Sin presupuesto —</option>
                {['Comida','Transporte','Entretenimiento','Salud','Personal','Hogar','Servicios','Negocio','Otros'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Notas</label>
              <textarea value={gastoForm.notas} onChange={e => setGastoForm(p => ({ ...p, notas: e.target.value }))} style={{ minHeight: 50 }} />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-danger" onClick={() => { setEditGastoOpen(false); handleGastoDelete(editingGasto.id); }}>Eliminar</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditGastoOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* ── Deuda modal */}
      <Modal open={deudaModalOpen} onClose={() => setDeudaModalOpen(false)} title={editingDeuda ? 'Editar deuda' : 'Nueva deuda'}>
        <form onSubmit={handleDeudaSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Nombre *</label>
              <input type="text" placeholder="¿A quién le debes?" value={deudaForm.nombre} onChange={e => setDeudaForm(p => ({ ...p, nombre: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Monto *</label>
              <input type="number" placeholder="0" min="0" value={deudaForm.monto} onChange={e => setDeudaForm(p => ({ ...p, monto: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select value={deudaForm.tipo} onChange={e => setDeudaForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="unica">Única vez</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
          </div>
          <div className="form-actions">
            {editingDeuda && <button type="button" className="btn btn-danger" onClick={() => { setDeudaModalOpen(false); handleDeleteDeuda(editingDeuda.id); }}>Eliminar</button>}
            <button type="button" className="btn btn-ghost" onClick={() => setDeudaModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={savingDeuda}>{savingDeuda ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
