// ============================================================
// رِفق — تخطيط التطبيق (Layout)
// هيدر هادئ (الاسم + ⚙️ النظام) + شريط تنقل سفلي لخمس وجهات،
// وActiveTaskBar يحمّل حالة "المهمة الجارية" بنفسه (تحميل واحد فقط).
// ============================================================

import { Outlet, NavLink } from 'react-router-dom';
import { ActiveTaskBar } from '../ui/components/ActiveTaskBar';
import { voice } from '../i18n/voice';

const NAV_ITEMS = [
  { to: '/', label: 'اليوم', icon: '🏠' },
  { to: '/planning', label: 'التخطيط', icon: '📅' },
  { to: '/myplan', label: voice.myPlan.navLabel, icon: '📚' },
  { to: '/learning', label: 'رحلتي', icon: '🎓' },
  { to: '/heart', label: 'القلب', icon: '🤍' }
];

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <NavLink
          to="/settings"
          className={({ isActive }) => `header-settings${isActive ? ' active' : ''}`}
          aria-label={voice.system.navLabel}
          title={voice.system.navLabel}
        >
          ⚙️
        </NavLink>
        <h1>{voice.system.appName}</h1>
        <p className="app-tagline">{voice.system.tagline}</p>
      </header>
      <ActiveTaskBar />
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