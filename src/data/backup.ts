import type { Repo } from './repo';

export const BACKUP_VERSION = 1;
const ENTITY_KEYS = [
  'students',
  'courses',
  'registrations',
  'payments',
  'sessions',
  'attendance',
] as const;

export type EntityKey = (typeof ENTITY_KEYS)[number];

export interface BackupFile {
  version: number;
  exportedAt: string;
  data: Record<EntityKey, unknown[]>;
}

export async function buildBackup(repo: Repo): Promise<BackupFile> {
  const data = (await repo.exportAll()) as Record<EntityKey, unknown[]>;
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function validateBackup(raw: unknown): BackupFile {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid file: not an object');
  const obj = raw as Record<string, unknown>;
  if (obj.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${String(obj.version)}`);
  }
  const data = obj.data;
  if (!data || typeof data !== 'object') throw new Error('Invalid file: missing data');
  const bucket = data as Record<string, unknown>;
  const result: Record<EntityKey, unknown[]> = {
    students: [],
    courses: [],
    registrations: [],
    payments: [],
    sessions: [],
    attendance: [],
  };
  for (const key of ENTITY_KEYS) {
    const arr = bucket[key];
    if (arr !== undefined && !Array.isArray(arr)) {
      throw new Error(`Invalid file: ${key} must be an array`);
    }
    result[key] = Array.isArray(arr) ? arr : [];
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    data: result,
  };
}

export async function applyBackup(repo: Repo, backup: BackupFile): Promise<void> {
  await repo.reset();
  await repo.importAll(backup.data);
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teacher-dashboard-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
