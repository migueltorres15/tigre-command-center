export default function MetricCard({ label, value, sub, color }) {
  const colorClass = color ? `metric-card--${color}` : '';
  return (
    <div className={`metric-card ${colorClass}`}>
      <div className="metric-card-label">{label}</div>
      <div className="metric-card-value">{value}</div>
      {sub && <div className="metric-card-sub">{sub}</div>}
    </div>
  );
}
