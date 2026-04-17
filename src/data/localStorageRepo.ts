import type {
  Attendance,
  Course,
  Payment,
  Registration,
  Session,
  Student,
} from '@/domain/types';
import type { EntityRepo, Repo } from './repo';

const STORAGE_PREFIX = 'td:';

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadKey<T>(key: string): T[] {
  const raw = localStorage.getItem(STORAGE_PREFIX + key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function saveKey<T>(key: string, rows: T[]): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(rows));
}

function makeEntityRepo<T extends { id: string; createdAt: string }>(
  key: string,
): EntityRepo<T> {
  return {
    async list() {
      return loadKey<T>(key);
    },
    async get(id) {
      return loadKey<T>(key).find((r) => r.id === id);
    },
    async create(input) {
      const rows = loadKey<T>(key);
      const row = {
        ...(input as object),
        id: uid(),
        createdAt: new Date().toISOString(),
      } as T;
      rows.push(row);
      saveKey(key, rows);
      return row;
    },
    async update(id, patch) {
      const rows = loadKey<T>(key);
      const idx = rows.findIndex((r) => r.id === id);
      if (idx < 0) throw new Error(`${key}:${id} not found`);
      const next = { ...rows[idx], ...(patch as object) } as T;
      rows[idx] = next;
      saveKey(key, rows);
      return next;
    },
    async remove(id) {
      const rows = loadKey<T>(key).filter((r) => r.id !== id);
      saveKey(key, rows);
    },
  };
}

const KEYS = [
  'students',
  'courses',
  'registrations',
  'payments',
  'sessions',
  'attendance',
] as const;

export function createLocalStorageRepo(): Repo {
  return {
    students: makeEntityRepo<Student>('students'),
    courses: makeEntityRepo<Course>('courses'),
    registrations: makeEntityRepo<Registration>('registrations'),
    payments: makeEntityRepo<Payment>('payments'),
    sessions: makeEntityRepo<Session>('sessions'),
    attendance: makeEntityRepo<Attendance>('attendance'),
    async reset() {
      for (const k of KEYS) localStorage.removeItem(STORAGE_PREFIX + k);
    },
    async exportAll() {
      const out: Record<string, unknown[]> = {};
      for (const k of KEYS) out[k] = loadKey(k);
      return out;
    },
    async importAll(data) {
      for (const k of KEYS) {
        if (Array.isArray(data[k])) saveKey(k, data[k]!);
      }
    },
  };
}
