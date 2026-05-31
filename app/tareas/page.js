'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';

const EMPTY_FORM = { texto: '', tag: 'pendiente', proyecto: 'Personal' };

const TAGS = ['urgente', 'hoy', 'en_proceso', 'pendiente'];
const PROYECTOS = ['Tigre Studio', 'Sitios Web', 'Fotografía', 'YAO', 'Personal'];
const TAG_FILTERS = ['Todas', 'urgente', 'hoy', 'en_proceso', 'pendiente', 'completadas'];
const TAG_LABELS = {
  Todas: 'Todas',
  urgente: 'Urgente',
  hoy: 'Hoy',
  en_proceso: 'En Proceso',
  pendiente: 'Pendiente',
  completadas: 'Completadas',
};

export default function TareasPage() {
  const router = useRouter();

  const [tareas, setTareas] = useState([]);
  const [filter, setFilter] = useState('Todas');
  const [proyectoFilter, setProyectoFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tareas', { cache: 'no-store' });
      const data = await res.json();
      setTareas(Array.isArray(data) ? data : []);
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

  const openEdit = (tarea) => {
    setEditing(tarea);
    setForm({ texto: tarea.texto, tag: tarea.tag, proyecto: tarea.proyecto });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.texto.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/tareas/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/tareas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      setModalOpen(false);
      load(); router.refresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleCompletada = async (tarea) => {
    await fetch(`/api/tareas/${tarea.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completada: !tarea.completada }),
    });
    load(); router.refresh();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar tarea?')) return;
    await fetch(`/api/tareas/${id}`, { method: 'DELETE' });
    load(); router.refresh();
  };

  // Filtered
  let filtered = tareas;
  if (filter === 'completadas') {
    filtered = tareas.filter((t) => t.completada);
  } else if (filter !== 'Todas') {
    filtered = tareas.filter((t) => t.tag === filter && !t.completada);
  } else {
    filtered = tareas.filter((t) => !t.completada);
  }

  if (proyectoFilter !== 'Todos') {
    filtered = filtered.filter((t) => t.proyecto === proyectoFilter);
  }

  const urgentes = tareas.filter((t) => t.tag === 'urgente' && !t.completada).length;
  const completadasCount = tareas.filter((t) => t.completada).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tareas</h1>
          <p className="page-subtitle">Gestión de tareas y pendientes</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva tarea</button>
      </div>

      {/* Stats */}
      <div className="stats-bar" style={{ marginBottom: 20 }}>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Total</div>
          <div className="stats-bar-value">{tareas.length}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Urgentes</div>
          <div className="stats-bar-value" style={{ color: urgentes > 0 ? 'var(--red)' : 'var(--text2)' }}>{urgentes}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Completadas</div>
          <div className="stats-bar-value stats-bar-value--green">{completadasCount}</div>
        </div>
        <div className="stats-bar-item">
          <div className="stats-bar-label">Pendientes</div>
          <div className="stats-bar-value">{tareas.filter((t) => !t.completada).length}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <div className="filter-row" style={{ margin: 0, flex: 1 }}>
          {TAG_FILTERS.map((f) => (
            <button
              key={f}
              className={`filter-pill${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {TAG_LABELS[f]}
            </button>
          ))}
        </div>
        <select
          value={proyectoFilter}
          onChange={(e) => setProyectoFilter(e.target.value)}
          style={{ width: 'auto', minWidth: 130 }}
        >
          <option value="Todos">Todos los proyectos</option>
          {PROYECTOS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Task list */}
      {loading ? (
        <div className="loading">Cargando tareas...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✅</div>
          <div>No hay tareas en esta categoría</div>
        </div>
      ) : (
        <div className="task-list">
          {filtered.map((tarea) => (
            <div key={tarea.id} className={`task-item${tarea.completada ? ' completada' : ''}`}>
              <input
                type="checkbox"
                className="task-checkbox"
                checked={!!tarea.completada}
                onChange={() => toggleCompletada(tarea)}
              />
              <span className="task-texto">{tarea.texto}</span>
              <div className="task-badges">
                <StatusBadge status={tarea.tag} />
                <StatusBadge status={tarea.proyecto} />
              </div>
              <div className="task-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tarea)}>
                  Editar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tarea.id)}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar tarea' : 'Nueva tarea'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Tarea *</label>
            <textarea
              placeholder="Describe la tarea..."
              value={form.texto}
              onChange={(e) => setForm((p) => ({ ...p, texto: e.target.value }))}
              required
              style={{ minHeight: 80 }}
            />
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Prioridad</label>
              <select value={form.tag} onChange={(e) => setForm((p) => ({ ...p, tag: e.target.value }))}>
                <option value="urgente">🔴 Urgente</option>
                <option value="hoy">🟡 Hoy</option>
                <option value="pendiente">⚪ Pendiente</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Proyecto</label>
              <select value={form.proyecto} onChange={(e) => setForm((p) => ({ ...p, proyecto: e.target.value }))}>
                {PROYECTOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
