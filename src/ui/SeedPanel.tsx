import { useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import { seedDemoData } from '@/data/seed';

export function SeedPanel({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const repo = useRepo();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>, label: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg(`${label} done`);
      await onChanged?.();
    } catch (err) {
      setMsg(`${label} failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-medium">Dev tools</div>
          <div className="text-sm text-slate-500">
            Load demo data or wipe everything. Local-only; safe to use.
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void run(() => seedDemoData(repo), 'Seed')}
            disabled={busy}
            className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
          >
            Seed demo data
          </button>
          <button
            onClick={() => void run(() => repo.reset(), 'Reset')}
            disabled={busy}
            className="rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium px-3 py-1.5 disabled:opacity-50"
          >
            Reset all
          </button>
        </div>
      </div>
      {msg && <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">{msg}</div>}
    </div>
  );
}
