// ============================================================
// رِفق — تخطيط التطبيق (Layout)
// شريط تنقل سفلي للجوال/سطح المكتب مع مسار المحتوى.
// ============================================================

import { Outlet, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/', label: 'اليوم', icon: '🏠' },
  { to: '/planning', label: 'التخطيط', icon: '📅' },
  { to: '/learning', label: 'رحلتي', icon: '🎓' },
  { to: '/vault', label: 'المعرفة', icon: '🧠' },
  { to: '/heart', label: 'القلب', icon: '🤍' },
  { to: '/settings', label: 'النظام', icon: '⚙️' }
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}