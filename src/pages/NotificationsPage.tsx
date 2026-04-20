import { useCallback, useEffect, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import {
  loadNotifications,
  type NotificationItem,
  type NotificationKind,
} from '@/features/notifications/notificationsService';
import { EmptyState } from '@/ui/primitives/EmptyState';

const KIND_STYLES: Record<NotificationKind, string> = {
  overdue: 'bg-red-100 text-red-800 ring-red-300',
  due_soon: 'bg-accent-100 text-accent-800 ring-accent-300',
  missing_attendance: 'bg-slate-100 text-slate-700 ring-slate-300',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  missing_attendance: 'Missing attendance',
};

const ALL_KINDS: NotificationKind[] = ['overdue', 'due_soon', 'missing_attendance'];

export function NotificationsPage() {
  const repo = useRepo();
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [filter, setFilter] = useState<'all' | NotificationKind>('all');

  const refresh = useCallback(async () => {
    const xs = await loadNotifications(repo);
    setItems(xs);
  }, [repo]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts: Record<NotificationKind, number> = {
    overdue: 0,
    due_soon: 0,
    missing_attendance: 0,
  };
  for (const n of items ?? []) counts[n.kind]++;
  const filtered = (items ?? []).filter((n) => filter === 'all' || n.kind === filter);

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            {items === null
              ? 'Loading…'
              : `${items.length} active · ${counts.overdue} overdue · ${counts.due_soon} due soon · ${counts.missing_attendance} attendance`}
          </p>
        </div>
        <div
          role="group"
          aria-label="Filter notifications"
          className="inline-flex rounded-md border border-slate-200 p-0.5 bg-white flex-wrap"
        >
          {(['all', ...ALL_KINDS] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {f === 'all' ? 'All' : KIND_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {items === null ? (
          <div className="rounded-lg border border-slate-200 p-10 text-center text-slate-500">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="All caught up"
            description="No overdue payments, no due-soon payments, and no missing attendance in the last 30 days."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing in this category"
            description="Try another filter."
          />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {filtered.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">
                      {n.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{n.detail}</div>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${KIND_STYLES[n.kind]} shrink-0`}
                  >
                    {KIND_LABEL[n.kind]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
