import { z } from 'zod';
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

// Per-entity shape validation. Until this existed, `validateBackup` only
// checked container shape — an imported file with malformed / injected /
// oversized entity fields would pass through `importAll` straight into
// localStorage and corrupt the app state. Schemas below mirror the domain
// types exactly; any drift here needs to match `src/domain/types.ts`.
const idSchema = z.string().min(1).max(128);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoTimestampSchema = z.string().datetime().or(z.string().min(1));
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const currencySchema = z.enum(['USD', 'EUR', 'GBP', 'SAR', 'AED']);
const moneySchema = z.object({
  amount: z.number().finite(),
  currency: currencySchema,
});
const paymentMethodSchema = z.enum([
  'cash',
  'card',
  'bank_transfer',
  'whish',
  'omt',
  'western_union',
  'ltn',
  'other',
]);
const paymentStatusSchema = z.enum(['paid', 'pending', 'failed', 'refunded']);
const sessionStatusSchema = z.enum(['scheduled', 'completed', 'cancelled']);
const attendanceStatusSchema = z.enum(['present', 'absent', 'late', 'excused']);
const dayOfWeekSchema = z.enum(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
const courseTypeSchema = z.enum(['group', 'private']);
const shortText = z.string().max(200);
const longText = z.string().max(4000);

const studentSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  name: shortText.min(1),
  email: z.string().email().max(200).optional(),
  phone: shortText.optional(),
  preferredPaymentMethod: paymentMethodSchema.optional(),
  notes: longText.optional(),
  createdAt: isoTimestampSchema,
});
const courseSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  name: shortText.min(1),
  type: courseTypeSchema,
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  days: z.array(dayOfWeekSchema),
  startTime: timeSchema,
  defaultDurationMin: z.number().int().min(1).max(24 * 60),
  price: moneySchema,
  status: z.enum(['active', 'archived']),
  notes: longText.optional(),
  createdAt: isoTimestampSchema,
});
const installmentPlanSchema = z.object({
  label: shortText.optional(),
  amount: z.number().finite().min(0),
  currency: currencySchema,
  dueDate: isoDateSchema.optional(),
  paymentId: idSchema.optional(),
});
const registrationSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  studentId: idSchema,
  courseId: idSchema,
  isPaid: z.boolean(),
  registrationDate: isoDateSchema,
  paymentDueDate: isoDateSchema.optional(),
  installments: z.array(installmentPlanSchema).max(2).optional(),
  createdAt: isoTimestampSchema,
});
const paymentSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  registrationId: idSchema,
  amount: moneySchema,
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  paidAt: isoDateSchema,
  note: longText.optional(),
  createdAt: isoTimestampSchema,
});
const sessionSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  courseId: idSchema,
  date: isoDateSchema,
  startTime: timeSchema,
  durationMin: z.number().int().min(1).max(24 * 60),
  status: sessionStatusSchema,
  note: longText.optional(),
  createdAt: isoTimestampSchema,
});
const attendanceSchema = z.object({
  id: idSchema,
  ownerId: idSchema.optional(),
  sessionId: idSchema,
  studentId: idSchema,
  status: attendanceStatusSchema,
  note: longText.optional(),
  createdAt: isoTimestampSchema,
});

const ENTITY_SCHEMAS: Record<EntityKey, z.ZodTypeAny> = {
  students: studentSchema,
  courses: courseSchema,
  registrations: registrationSchema,
  payments: paymentSchema,
  sessions: sessionSchema,
  attendance: attendanceSchema,
};

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
  const shapeErrors: string[] = [];
  for (const key of ENTITY_KEYS) {
    const arr = bucket[key];
    if (arr !== undefined && !Array.isArray(arr)) {
      throw new Error(`Invalid file: ${key} must be an array`);
    }
    const rows = Array.isArray(arr) ? arr : [];
    const schema = ENTITY_SCHEMAS[key];
    const validated: unknown[] = [];
    for (let i = 0; i < rows.length; i++) {
      const parsed = schema.safeParse(rows[i]);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join('.') || '<root>';
        shapeErrors.push(`${key}[${i}].${path}: ${issue?.message ?? 'invalid'}`);
        if (shapeErrors.length >= 5) break;
      } else {
        validated.push(parsed.data);
      }
    }
    if (shapeErrors.length >= 5) break;
    result[key] = validated;
  }
  if (shapeErrors.length > 0) {
    const more = shapeErrors.length >= 5 ? ' (and more…)' : '';
    throw new Error(`Invalid file — entity shape errors:\n  ${shapeErrors.join('\n  ')}${more}`);
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    data: result,
  };
}

export async function applyBackup(repo: Repo, backup: BackupFile): Promise<void> {
  // Snapshot current data first so we can roll back if `importAll` throws
  // mid-write (e.g. localStorage QuotaExceededError after a partial import).
  // Previously: reset() succeeded, importAll() could throw halfway, user lost
  // everything with no recovery. See Phase 3 §3.2.2 in AUDIT_REPORT.md.
  const snapshot = await repo.exportAll();
  try {
    await repo.reset();
    await repo.importAll(backup.data);
  } catch (err) {
    try {
      await repo.reset();
      await repo.importAll(snapshot);
    } catch {
      // Double failure — snapshot couldn't be restored. Surface the original
      // error to the caller; data state is now whatever survived the partial
      // write. There isn't a cleaner recovery path from inside the app.
    }
    throw new Error(
      `Backup import failed; prior data was restored: ${(err as Error).message}`,
    );
  }
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
