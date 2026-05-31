'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const FREELANCE_ITEMS = [
  { href: '/',              icon: '🏠', label: 'Dashboard' },
  { href: '/studio',        icon: '🎨', label: 'Tigre Studio' },
  { href: '/llamadas-usa',  icon: '📞', label: 'Cold Calls USA' },
  { href: '/sitios',        icon: '🌐', label: 'Sitios Web' },
  { href: '/fotografia',    icon: '📷', label: 'Fotografía' },
];

const TOOLS_ITEMS = [
  { href: '/agentes',    icon: '🤖', label: 'Agentes' },
  { href: '/finanzas',   icon: '💰', label: 'Finanzas' },
  { href: '/tareas',     icon: '✅', label: 'Tareas' },
  { href: '/calendario', icon: '📅', label: 'Calendario' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [urgentes, setUrgentes]     = useState(0);
  const [yaoUrgentes, setYaoUrgentes] = useState(0);

  useEffect(() => {
    // Tigre CC urgent tasks
    fetch('/api/tareas')
      .then(r => r.json())
      .then(t => { if (Array.isArray(t)) setUrgentes(t.filter(x => x.tag === 'urgente' && !x.completada).length); })
      .catch(() => {});

    // YAO urgent tasks (best-effort, offline-safe)
    fetch('/api/yao-proxy?resource=summary', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (typeof d.tareasUrgentes === 'number') setYaoUrgentes(d.tareasUrgentes); })
      .catch(() => {});
  }, [pathname]);

  const isActive = (href) => href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-icon">⚡</span>
        <span className="sidebar-logo-text">TIGRE</span>
      </div>

      <nav className="sidebar-nav">
        {/* ── Freelance verticals ── */}
        {FREELANCE_ITEMS.map(item => (
          <Link key={item.href} href={item.href} className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}>
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
          </Link>
        ))}

        {/* ── YAO Baja divider ── */}
        <div className="sidebar-section-divider">
          <span className="sidebar-section-label">🍺 YAO Baja</span>
        </div>

        <Link href="/yao" className={`sidebar-nav-item sidebar-nav-item--yao${isActive('/yao') ? ' active-yao' : ''}`}>
          <span className="sidebar-nav-icon">🍶</span>
          <span className="sidebar-nav-label">YAO Dashboard</span>
          {yaoUrgentes > 0 && <span className="sidebar-badge sidebar-badge--amber">{yaoUrgentes}</span>}
        </Link>

        {/* ── Tools ── */}
        <div className="sidebar-section-divider" style={{ marginTop: 6 }}>
          <span className="sidebar-section-label" style={{ color: 'var(--text3)' }}>Personal</span>
        </div>

        {TOOLS_ITEMS.map(item => (
          <Link key={item.href} href={item.href} className={`sidebar-nav-item${isActive(item.href) ? ' active' : ''}`}>
            <span className="sidebar-nav-icon">{item.icon}</span>
            <span className="sidebar-nav-label">{item.label}</span>
            {item.label === 'Tareas' && urgentes > 0 && <span className="sidebar-badge">{urgentes}</span>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">Command Center</div>
        <div className="sidebar-footer-sub">v0.2.0</div>
      </div>
    </aside>
  );
}
