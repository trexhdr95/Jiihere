import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepo } from '@/data/RepoContext';
import {
  loadNotifications,
  type NotificationItem,
  type NotificationKind,
} from '@/features/notifications/notificationsService';

const KIND_STYLES: Record<NotificationKind, string> = {
  overdue: 'bg-red-500',
  due_soon: 'bg-accent-500',
  missing_attendance: 'bg-slate-400',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  missing_attendance: 'Attendance',
};

export function NotificationBell() {
  const repo = useRepo();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const xs = await loadNotifications(repo);
      setItems(xs);
    } catch {
      setItems([]);
    }
  }, [repo]);

  // Initial load + refresh when the window gets focus.
  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const count = items?.length ?? 0;

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void refresh();
        }}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ''}`}
        aria-expanded={open}
        className="relative rounded-md p-2.5 md:p-2 text-slate-600 hover:bg-slate-100"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white shadow-lg z-40">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-[11px] text-slate-500">{count} active</div>
          </div>
          {items === null ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">Loading…</div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Nothing to act on — you're all caught up.
            </div>
          ) : (
            <ul className="max-h-[min(26rem,calc(100vh-8rem))] overflow-y-auto divide-y divide-slate-200">
              {items.slice(0, 12).map((n) => (
                <li key={n.id} className="px-4 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 inline-block h-2 w-2 rounded-full shrink-0 ${KIND_STYLES[n.kind]}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {n.title}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{n.detail}</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                      {KIND_LABEL[n.kind]}
                    </span>
                  </div>
                </li>
              ))}
              {items.length > 12 && (
                <li className="px-4 py-2 text-center text-xs text-slate-500">
                  + {items.length - 12} more
                </li>
              )}
            </ul>
          )}
          <div className="px-4 py-2 border-t border-slate-200 text-right">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              View all →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
