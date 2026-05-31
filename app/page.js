'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MetricCard from '@/components/MetricCard';
import { ChartIngresos, ChartDeudas, ChartProductividad, ChartProyectos } from '@/components/Charts';

function fmt(n, moneda = 'MXN') {
  return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${moneda}`;
}

function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [yaoUrl, setYaoUrl] = useState('http://localhost:5500/YAO/index.html');
  const [ingresoForm, setIngresoForm] = useState({ proyecto: 'Tigre Studio', monto: '', moneda: 'MXN', descripcion: '' });
  const [saving, setSaving] = useState(false);
  const [yaoSummary, setYaoSummary] = useState(null);
  const [copying, setCopying] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  const mes = new Date().toISOString().slice(0, 7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
      ]);
      const dash = await dashRes.json();
      setData(dash);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
    // YAO summary — best-effort, doesn't block main load
    fetch(`/api/yao-proxy?resource=summary&mes=${new Date().toISOString().slice(0,7)}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setYaoSummary(d))
      .catch(() => setYaoSummary({ online: false, totalVentas: 0, totalGastos: 35400, cobertura: 0, tareasUrgentes: 0 }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDeuda = async (deuda) => {
    await fetch(`/api/deudas/${deuda.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagada: !deuda.pagada }),
    });
    load(); router.refresh();
  };

  const handleIngresoSubmit = async (e) => {
    e.preventDefault();
    if (!ingresoForm.monto) return;
    setSaving(true);
    try {
      await fetch('/api/ingresos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ingresoForm),
      });
      setIngresoForm({ proyecto: 'Tigre Studio', monto: '', moneda: 'MXN', descripcion: '' });
      load(); router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const copyContext = async () => {
    setCopying(true);
    try {
      const res  = await fetch('/api/export', { cache: 'no-store' });
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 4000);
    } catch (err) {
      console.error('Copy failed', err);
    } finally {
      setCopying(false);
    }
  };

  const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return <div className="loading">Cargando dashboard...</div>;
  }

  const meta = data?.metaMensual || 62250;
  const actual = data?.totalIngresosMes || 0;
  const faltante = Math.max(0, meta - actual);
  const pct = Math.min(100, (actual / meta) * 100);
  const reached = actual >= meta;

  return (
    <div className="page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle" style={{ textTransform: 'capitalize' }}>{today}</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Copiar contexto */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <button
              onClick={copyContext}
              disabled={copying}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: copyDone
                  ? 'linear-gradient(135deg,#059669,#10B981)'
                  : 'linear-gradient(135deg,#1E1B4B,#312E81)',
                border: `1px solid ${copyDone ? 'rgba(16,185,129,.4)' : 'rgba(99,102,241,.35)'}`,
                color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 13,
                fontWeight: 600, cursor: copying ? 'wait' : 'pointer',
                transition: 'all .2s', fontFamily: 'inherit',
                boxShadow: copyDone ? '0 0 16px rgba(16,185,129,.25)' : '0 0 12px rgba(99,102,241,.2)',
              }}
            >
              <span style={{ fontSize: 15 }}>{copyDone ? '✅' : copying ? '⏳' : '📋'}</span>
              {copyDone ? '¡Copiado!' : copying ? 'Exportando…' : 'Copiar contexto'}
            </button>
            {copyDone && (
              <span style={{ fontSize: 11, color: '#10B981', fontWeight: 500, animation: 'fadeIn .2s ease' }}>
                Pégalo en tu chat con Claude
              </span>
            )}
          </div>
          <a
            href={yaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            🔗 Abrir YAO Dashboard
          </a>
        </div>
      </div>

      {/* Meta Mensual */}
      <div className={`goal-card${reached ? ' goal-card--success' : ''}`}>
        <div className="goal-card-header">
          <div>
            <div className="goal-card-title">Meta mensual</div>
            <div className="goal-card-amount">
              {reached ? '🎉 Meta alcanzada' : `Faltan ${fmt(faltante)}`}
            </div>
            <div className="goal-card-sub">
              {reached
                ? `Has superado tu meta de ${fmt(meta)} este mes`
                : `Necesitas ${fmt(faltante)} más para alcanzar tu meta`}
            </div>
          </div>
          <div className="goal-card-meta">
            <div>Meta: <strong>{fmt(meta)}</strong></div>
            <div>Ingresado: <strong style={{ color: 'var(--green)' }}>{fmt(actual)}</strong></div>
            <div>Avance: <strong>{pct.toFixed(0)}%</strong></div>
          </div>
        </div>
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className={`progress-bar-fill${reached ? ' progress-bar-fill--green' : pct > 60 ? ' progress-bar-fill--yellow' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <MetricCard
          label="Ingresos del mes"
          value={fmt(data?.totalIngresosMes)}
          sub="Acumulado este mes"
          color="green"
        />
        <MetricCard
          label="Tareas urgentes"
          value={data?.tareasUrgentes || 0}
          sub="Pendientes"
          color={data?.tareasUrgentes > 0 ? 'red' : undefined}
        />
        <MetricCard
          label="Clientes activos"
          value={data?.clientesActivos || 0}
          sub="Leads calientes + sitios en proceso"
        />
        <MetricCard
          label="Deuda pendiente"
          value={fmt(data?.deudaTotal)}
          sub="Total a pagar"
          color="red"
        />
      </div>

      {/* ── Verticales de negocio ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>
          Verticales de negocio
        </h2>
        <div className="project-cards">
          {/* Tigre Studio */}
          <Link href="/studio" style={{ textDecoration: 'none' }}>
            <div className="project-card project-card--studio">
              <div className="project-card-icon">🎨</div>
              <div className="project-card-name">Tigre Studio</div>
              <div className="project-card-metric" style={{ color: 'var(--accent2)' }}>
                {fmt(data?.ingresosPorProyecto?.find(p => p.proyecto === 'Tigre Studio')?.total || 0)}
              </div>
              <div className="project-card-sub">Ingresos este mes</div>
              <div className="project-card-stats">
                {(() => { const tp = data?.tareasPorProyecto?.find(p => p.proyecto === 'Tigre Studio'); return (<>
                  <div className="project-card-stat"><span>Tareas</span><strong>{tp?.total || 0}</strong></div>
                  <div className="project-card-stat"><span>Pendientes</span><strong style={{ color: (tp?.pendientes || 0) > 0 ? 'var(--yellow)' : 'var(--text2)' }}>{tp?.pendientes || 0}</strong></div>
                  <div className="project-card-stat"><span>Listas</span><strong style={{ color: 'var(--green)' }}>{tp?.completadas || 0}</strong></div>
                </>); })()}
              </div>
            </div>
          </Link>

          {/* Sitios Web */}
          <Link href="/sitios" style={{ textDecoration: 'none' }}>
            <div className="project-card project-card--sitios">
              <div className="project-card-icon">🌐</div>
              <div className="project-card-name">Sitios Express</div>
              <div className="project-card-metric" style={{ color: 'var(--blue)' }}>
                {fmt(data?.ingresosPorProyecto?.find(p => p.proyecto === 'Sitios Web')?.total || 0)}
              </div>
              <div className="project-card-sub">Ingresos este mes</div>
              <div className="project-card-stats">
                {(() => { const tp = data?.tareasPorProyecto?.find(p => p.proyecto === 'Sitios Web'); return (<>
                  <div className="project-card-stat"><span>Tareas</span><strong>{tp?.total || 0}</strong></div>
                  <div className="project-card-stat"><span>Pendientes</span><strong style={{ color: (tp?.pendientes || 0) > 0 ? 'var(--yellow)' : 'var(--text2)' }}>{tp?.pendientes || 0}</strong></div>
                  <div className="project-card-stat"><span>Listas</span><strong style={{ color: 'var(--green)' }}>{tp?.completadas || 0}</strong></div>
                </>); })()}
              </div>
            </div>
          </Link>

          {/* Fotografía */}
          <Link href="/fotografia" style={{ textDecoration: 'none' }}>
            <div className="project-card project-card--foto">
              <div className="project-card-icon">📷</div>
              <div className="project-card-name">Fotografía</div>
              <div className="project-card-metric" style={{ color: 'var(--orange)' }}>
                {fmt(data?.ingresosPorProyecto?.find(p => p.proyecto === 'Fotografía')?.total || 0)}
              </div>
              <div className="project-card-sub">Ingresos este mes</div>
              <div className="project-card-stats">
                {(() => { const tp = data?.tareasPorProyecto?.find(p => p.proyecto === 'Fotografía'); return (<>
                  <div className="project-card-stat"><span>Tareas</span><strong>{tp?.total || 0}</strong></div>
                  <div className="project-card-stat"><span>Pendientes</span><strong style={{ color: (tp?.pendientes || 0) > 0 ? 'var(--yellow)' : 'var(--text2)' }}>{tp?.pendientes || 0}</strong></div>
                  <div className="project-card-stat"><span>Listas</span><strong style={{ color: 'var(--green)' }}>{tp?.completadas || 0}</strong></div>
                </>); })()}
              </div>
            </div>
          </Link>

          {/* YAO Baja — amber accent, fetched from proxy */}
          <Link href="/yao" style={{ textDecoration: 'none' }}>
            <div className="project-card project-card--yao">
              <div className="project-card-icon">🍶</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span className="project-card-name" style={{ margin: 0 }}>YAO Baja</span>
                {yaoSummary && (
                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, fontWeight: 700,
                    background: yaoSummary.online ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)',
                    color: yaoSummary.online ? 'var(--green)' : 'var(--red)' }}>
                    {yaoSummary.online ? 'EN VIVO' : 'OFFLINE'}
                  </span>
                )}
              </div>
              <div className="project-card-metric" style={{ color: '#F59E0B' }}>
                {yaoSummary ? fmt(yaoSummary.totalVentas) : '…'}
              </div>
              <div className="project-card-sub">Ventas este mes</div>
              <div className="project-card-stats">
                <div className="project-card-stat">
                  <span>Cobertura</span>
                  <strong style={{ color: yaoSummary?.cobertura >= 100 ? 'var(--green)' : yaoSummary?.cobertura >= 70 ? 'var(--yellow)' : 'var(--red)' }}>
                    {yaoSummary ? `${yaoSummary.cobertura}%` : '…'}
                  </strong>
                </div>
                <div className="project-card-stat">
                  <span>Gastos fijos</span>
                  <strong>{fmt(yaoSummary?.totalGastos || 35400)}</strong>
                </div>
                <div className="project-card-stat">
                  <span>Urgentes</span>
                  <strong style={{ color: yaoSummary?.tareasUrgentes > 0 ? 'var(--red)' : 'var(--text2)' }}>
                    {yaoSummary?.tareasUrgentes ?? '…'}
                  </strong>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Gastos + Deudas */}
      <div className="two-col">
        {/* Gastos fijos */}
        <div className="card">
          <div className="card-title">Gastos fijos personales</div>
          {(data?.gastos || []).map((g) => (
            <div key={g.id} className="list-item">
              <span className="list-item-name">{g.nombre}</span>
              <span className="list-item-amount">{fmt(g.monto)}</span>
            </div>
          ))}
          <div className="list-total">
            <span className="list-total-label">Total mensual</span>
            <span className="list-total-amount">{fmt(data?.gastosPersonales || 42250)}</span>
          </div>
        </div>

        {/* Deudas */}
        <div className="card">
          <div className="card-title">Deudas pendientes</div>
          {(data?.deudas || []).map((d) => (
            <div key={d.id} className={`deuda-item${d.pagada ? ' pagada' : ''}`}>
              <input
                type="checkbox"
                className="deuda-checkbox"
                checked={!!d.pagada}
                onChange={() => toggleDeuda(d)}
              />
              <div style={{ flex: 1 }}>
                <div className="deuda-nombre">{d.nombre}</div>
                <div className="deuda-tipo">{d.tipo === 'mensual' ? 'Mensual' : 'Única vez'}</div>
              </div>
              <span className="deuda-monto">{fmt(d.monto)}</span>
            </div>
          ))}
          <div className="list-total">
            <span className="list-total-label">Deuda total</span>
            <span className="list-total-amount" style={{ color: 'var(--red)' }}>{fmt(data?.deudaTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── GRÁFICAS ── */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
          Resumen visual
        </h2>

        {/* Ingresos vs Meta — ancho completo */}
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-title">📈 Ingresos vs Meta mensual — últimos 6 meses</div>
          <div style={{ height: 240, marginTop: 12 }}>
            <ChartIngresos data={data?.ingresosPorMes} meta={data?.metaMensual || 62250} />
          </div>
        </div>

        {/* Fila de 3 gráficas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

          {/* Deudas */}
          <div className="card">
            <div className="card-title">💳 Estado de deudas</div>
            <div style={{ height: 200, marginTop: 12 }}>
              <ChartDeudas pagada={data?.deudaPagada} pendiente={data?.deudaPendiente} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 12 }}>
              <span style={{ color: 'var(--green)' }}>✓ Pagado: {fmt(data?.deudaPagada)}</span>
              <span style={{ color: 'var(--red)' }}>● Pendiente: {fmt(data?.deudaPendiente)}</span>
            </div>
          </div>

          {/* Productividad tareas */}
          <div className="card">
            <div className="card-title">✅ Productividad por proyecto</div>
            <div style={{ height: 200, marginTop: 12 }}>
              {data?.tareasPorProyecto?.length > 0
                ? <ChartProductividad data={data.tareasPorProyecto} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>Sin tareas registradas</div>
              }
            </div>
          </div>

          {/* Ingresos por proyecto */}
          <div className="card">
            <div className="card-title">💰 Ingresos por proyecto (mes actual)</div>
            <div style={{ height: 200, marginTop: 12 }}>
              {data?.ingresosPorProyecto?.length > 0
                ? <ChartProyectos data={data.ingresosPorProyecto} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>Sin ingresos este mes</div>
              }
            </div>
          </div>
        </div>

        {/* Objetivos — barras de progreso */}
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">🎯 Objetivos del mes</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 14 }}>

            {/* Meta ingresos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>Meta de ingresos</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt(data?.totalIngresosMes)} / {fmt(data?.metaMensual || 62250)}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, ((data?.totalIngresosMes || 0) / (data?.metaMensual || 62250)) * 100)}%`,
                  background: (data?.totalIngresosMes || 0) >= (data?.metaMensual || 62250) ? 'var(--green)' : 'var(--accent)',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                {Math.min(100, ((data?.totalIngresosMes || 0) / (data?.metaMensual || 62250) * 100)).toFixed(0)}% alcanzado
              </div>
            </div>

            {/* Meta ahorro */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>Meta de ahorro</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt(Math.max(0, (data?.totalIngresosMes || 0) - (data?.gastosPersonales || 42250)))} / {fmt(data?.metaAhorro || 20000)}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, (Math.max(0, (data?.totalIngresosMes || 0) - (data?.gastosPersonales || 42250)) / (data?.metaAhorro || 20000)) * 100)}%`,
                  background: 'var(--green)',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                Estimado: ingresos − gastos fijos personales
              </div>
            </div>

            {/* Deudas liquidadas */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>Deudas liquidadas</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt(data?.deudaPagada)} / {fmt((data?.deudaPagada || 0) + (data?.deudaPendiente || 0))}
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, ((data?.deudaPagada || 0) / Math.max(1, (data?.deudaPagada || 0) + (data?.deudaPendiente || 0))) * 100)}%`,
                  background: 'var(--green)',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                {Math.min(100, ((data?.deudaPagada || 0) / Math.max(1, (data?.deudaPagada || 0) + (data?.deudaPendiente || 0)) * 100)).toFixed(0)}% liquidado
              </div>
            </div>

            {/* Clientes activos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text2)' }}>Clientes activos</span>
                <span style={{ fontWeight: 600 }}>{data?.clientesActivos || 0} activos</span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, ((data?.clientesActivos || 0) / 10) * 100)}%`,
                  background: 'var(--blue)',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                Leads calientes + sitios en proceso
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Quick add ingreso */}
      <div className="quick-add">
        <div className="quick-add-title">Registrar ingreso rápido</div>
        <form onSubmit={handleIngresoSubmit}>
          <div className="quick-add-row">
            <div className="form-group" style={{ flex: '1.5', minWidth: 140 }}>
              <label className="form-label">Proyecto</label>
              <select
                value={ingresoForm.proyecto}
                onChange={(e) => setIngresoForm((p) => ({ ...p, proyecto: e.target.value }))}
              >
                <option value="Tigre Studio">Tigre Studio</option>
                <option value="Sitios Web">Sitios Web</option>
                <option value="Fotografía">Fotografía</option>
                <option value="YAO">YAO</option>
                <option value="Personal">Personal</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 2, minWidth: 160 }}>
              <label className="form-label">Descripción</label>
              <input
                type="text"
                placeholder="Descripción del ingreso..."
                value={ingresoForm.descripcion}
                onChange={(e) => setIngresoForm((p) => ({ ...p, descripcion: e.target.value }))}
              />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 110 }}>
              <label className="form-label">Monto</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                step="0.01"
                value={ingresoForm.monto}
                onChange={(e) => setIngresoForm((p) => ({ ...p, monto: e.target.value }))}
                required
              />
            </div>
            <div className="form-group" style={{ flex: '0 0 90px' }}>
              <label className="form-label">Moneda</label>
              <select
                value={ingresoForm.moneda}
                onChange={(e) => setIngresoForm((p) => ({ ...p, moneda: e.target.value }))}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <label className="form-label" style={{ opacity: 0 }}>.</label>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : '+ Registrar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
