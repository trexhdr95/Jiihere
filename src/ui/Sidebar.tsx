import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard', end: true, keys: 'g d' },
  { to: '/students', label: 'Students', keys: 'g s' },
  { to: '/courses', label: 'Courses', keys: 'g c' },
  { to: '/registrations', label: 'Registrations', keys: 'g r' },
  { to: '/payments', label: 'Payments', keys: 'g p' },
  { to: '/schedule', label: 'Schedule', keys: 'g k' },
];

export interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const location = useLocation();

  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const panel = (
    <>
      <div className="h-14 flex items-center px-5 font-semibold text-brand-600">
        Teacher's Dashboard
      </div>
      <nav className="flex-1 px-3 py-2 space-y-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            <span>{item.label}</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              {item.keys}
            </span>
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex md:w-60 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {panel}
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-slate-950/60"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="absolute left-0 top-0 h-full w-60 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
            {panel}
          </aside>
        </div>
      )}
    </>
  );
}
