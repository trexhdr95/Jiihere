import { useEffect, useState } from 'react';

const THEME_KEY = 'td:theme';

export interface HeaderProps {
  onToggleMobileNav: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY);
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved ? saved === 'dark' : prefers;
    setDark(initial);
    document.documentElement.classList.toggle('dark', initial);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  };

  return (
    <header className="h-14 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="md:hidden flex items-center gap-3">
        <button
          onClick={onToggleMobileNav}
          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Open menu"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M3 5h14v2H3zM3 9h14v2H3zM3 13h14v2H3z" />
          </svg>
        </button>
        <div className="font-semibold text-brand-600">Teacher's Dashboard</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggle}
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Toggle dark mode"
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
    </header>
  );
}
