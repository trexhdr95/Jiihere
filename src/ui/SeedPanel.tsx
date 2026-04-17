import { useRef, useState } from 'react';
import { useRepo } from '@/data/RepoContext';
import {
  applyBackup,
  buildBackup,
  downloadBackup,
  validateBackup,
} from '@/data/backup';
import {
  summarizeIntegrityIssues,
  validateBackupIntegrity,
} from '@/data/backupIntegrity';
import { seedDemoData } from '@/data/seed';

export function SeedPanel({ onChanged }: { onChanged?: () => void | Promise<void> }) {
  const repo = useRepo();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = async (fn: () => Promise<void>, label: string) => {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      await fn();
      setMsg(`${label} done`);
      await onChanged?.();
    } catch (err) {
      setError(`${label} failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    setError(null);
    setMsg(null);
    try {
      const backup = await buildBackup(repo);
      downloadBackup(backup);
      setMsg('Exported backup to JSON.');
    } catch (err) {
      setError(`Export failed: ${(err as Error).message}`);
    }
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const text = await file.text();
      const backup = validateBackup(JSON.parse(text));
      const issues = validateBackupIntegrity(backup);
      if (issues.length > 0) {
        throw new Error(
          `Backup has ${issues.length} referential issue(s): ${summarizeIntegrityIssues(issues)}`,
        );
      }
      await applyBackup(repo, backup);
      const counts = Object.entries(backup.data)
        .map(([k, arr]) => `${k}: ${(arr as unknown[]).length}`)
        .join(', ');
      setMsg(`Imported — ${counts}`);
      await onChanged?.();
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium">Dev tools</div>
          <div className="text-sm text-slate-500">
            Seed demo data, wipe everything, or back up and restore via JSON.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => void run(() => seedDemoData(repo), 'Seed')}
            disabled={busy}
            className="rounded-md bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-3 py-1.5 disabled:opacity-50"
          >
            Seed demo data
          </button>
          <button
            onClick={() => void handleExport()}
            disabled={busy}
            className="rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium px-3 py-1.5 disabled:opacity-50"
          >
            Export JSON
          </button>
          <button
            onClick={handleImportClick}
            disabled={busy}
            className="rounded-md bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium px-3 py-1.5 disabled:opacity-50"
          >
            Import JSON
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
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      {msg && !error && (
        <div className="mt-3 text-sm text-brand-700 dark:text-brand-300">{msg}</div>
      )}
      {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}
      <div className="mt-3 text-xs text-slate-500">
        Import replaces all existing data. Export first if you want to keep it.
      </div>
    </div>
  );
}
