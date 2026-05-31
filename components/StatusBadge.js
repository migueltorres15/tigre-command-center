const statusMap = {
  frio: { label: 'Frío', cls: 'badge--blue' },
  tibio: { label: 'Tibio', cls: 'badge--yellow' },
  caliente: { label: 'Caliente', cls: 'badge--orange' },
  cerrado: { label: 'Cerrado', cls: 'badge--green' },
  en_proceso: { label: 'En proceso', cls: 'badge--yellow' },
  entregado: { label: 'Entregado', cls: 'badge--blue' },
  cobrado: { label: 'Cobrado', cls: 'badge--green' },
  pendiente: { label: 'Pendiente', cls: 'badge--muted' },
  confirmado: { label: 'Confirmado', cls: 'badge--green' },
  urgente: { label: 'Urgente', cls: 'badge--red' },
  hoy: { label: 'Hoy', cls: 'badge--yellow' },
  mensual: { label: 'Mensual', cls: 'badge--accent' },
  unica: { label: 'Única vez', cls: 'badge--muted' },
  personal: { label: 'Personal', cls: 'badge--muted' },
  'Tigre Studio': { label: 'Tigre Studio', cls: 'badge--accent' },
  'Sitios Web': { label: 'Sitios Web', cls: 'badge--blue' },
  'Fotografía': { label: 'Fotografía', cls: 'badge--yellow' },
  YAO: { label: 'YAO', cls: 'badge--orange' },
};

export default function StatusBadge({ status }) {
  const map = statusMap[status] || { label: status, cls: 'badge--muted' };
  return <span className={`badge ${map.cls}`}>{map.label}</span>;
}
