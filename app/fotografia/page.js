'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import Table from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';

const EMPTY_FORM = {
  cliente: '',
  tipo: '',
  monto: '',
  moneda: 'MXN',
  fecha: '',
  status: 'pendiente',
  notas: '',
};

function fmt(n, moneda = 'MXN') {
  if (!n && n !== 0) return '—';
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0 })} ${moneda}`;
}

export default function FotografiaPage() {
  const router = useRouter();

  const [sesiones, setSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sesiones', { cache: 'no-store' });
      const data = await res.json();
      setSesiones(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (sesion) => {
    setEditing(sesion);
    setForm({
      cliente: sesion.cliente || '',
      tipo: sesion.tipo || '',
      monto: sesion.monto || '',
      moneda: sesion.moneda || 'MXN',
      fecha: sesion.fecha || '',
      status: sesion.status || 'pendiente',
      notas: sesion.notas || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, monto: form.monto ? parseFloat(form.monto) : null };
      if (editing) {
        await fetch(`/api/sesiones/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/sesiones', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      load(); router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sesion) => {
    await fetch(`/api/sesiones/${sesion.id}`, { method: 'DELETE' });
    load(); router.refresh();
  };

  const confirmadas = sesiones.filter((s) => s.status === 'confirmado').length;
  const ingresoTotal = sesiones.reduce((acc, s) => acc + (s.monto || 0), 0);

  const columns = [
    { key: 'cliente', label: 'Cliente', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
    { key: 'tipo', label: 'Tipo', render: (v) => v ? <span style={{ color: 'var(--text2)' }}>{v}</span> : '—' },
    { key: 'monto', label: 'Monto', render: (v, row) => fmt(v, row.moneda) },
    { key: 'fecha', label: 'Fecha', render: (v) => v ? new Date(v + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { key: 'notas', label: 'Notas', render: (v) => v ? <span style={{ color: 'var(--text2)', fontSize: 12.5 }}>{v}</span> : '—' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fotografía</h1>
          <p className="page-subtitle">Sesiones fotográficas y clientes</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva sesión</button>
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stats-bar-item">
          <div className="stats-bar-label">Total sesiones</div>
          <div className="stats-bar-value">{sesiones.length}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Confirmadas</div>
          <div className="stats-bar-value stats-bar-value--green">{confirmadas}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Ingresos fotografía</div>
          <div className="stats-bar-value stats-bar-value--accent">{fmt(ingresoTotal)}</div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <Table
          columns={columns}
          data={sesiones}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar sesión' : 'Nueva sesión'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">Cliente *</label>
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={form.cliente}
                onChange={(e) => setForm((p) => ({ ...p, cliente: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de sesión</label>
              <input
                type="text"
                placeholder="Maternidad, Boda, Retrato..."
                value={form.tipo}
                onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((p) => ({ ...p, fecha: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                step="0.01"
                value={form.monto}
                onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Moneda</label>
              <select value={form.moneda} onChange={(e) => setForm((p) => ({ ...p, moneda: e.target.value }))}>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Status</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="pendiente">Pendiente</option>
                <option value="confirmado">Confirmado</option>
                <option value="entregado">Entregado</option>
                <option value="cobrado">Cobrado</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label className="form-label">Notas</label>
              <textarea
                placeholder="Notas de la sesión..."
                value={form.notas}
                onChange={(e) => setForm((p) => ({ ...p, notas: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear sesión'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
