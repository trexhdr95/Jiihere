import type { BackupFile } from './backup';

export type IntegrityKind =
  | 'registration.missing_student'
  | 'registration.missing_course'
  | 'payment.missing_registration'
  | 'session.missing_course'
  | 'attendance.missing_session'
  | 'attendance.missing_student'
  | 'duplicate.id';

export interface IntegrityIssue {
  kind: IntegrityKind;
  entity: string;
  id?: string;
  detail: string;
}

function idsOf(rows: unknown[]): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    const id = (r as { id?: unknown })?.id;
    if (typeof id === 'string') set.add(id);
  }
  return set;
}

function detectDuplicates(entity: string, rows: unknown[]): IntegrityIssue[] {
  const seen = new Set<string>();
  const issues: IntegrityIssue[] = [];
  for (const r of rows) {
    const id = (r as { id?: unknown })?.id;
    if (typeof id !== 'string') continue;
    if (seen.has(id)) {
      issues.push({
        kind: 'duplicate.id',
        entity,
        id,
        detail: `${entity} has duplicate id ${id}`,
      });
    } else {
      seen.add(id);
    }
  }
  return issues;
}

export function validateBackupIntegrity(backup: BackupFile): IntegrityIssue[] {
  const { data } = backup;
  const issues: IntegrityIssue[] = [];

  for (const key of [
    'students',
    'courses',
    'registrations',
    'payments',
    'sessions',
    'attendance',
  ] as const) {
    issues.push(...detectDuplicates(key, data[key] ?? []));
  }

  const studentIds = idsOf(data.students ?? []);
  const courseIds = idsOf(data.courses ?? []);
  const registrationIds = idsOf(data.registrations ?? []);
  const sessionIds = idsOf(data.sessions ?? []);

  for (const r of (data.registrations ?? []) as Array<{
    id: string;
    studentId?: string;
    courseId?: string;
  }>) {
    if (r.studentId && !studentIds.has(r.studentId)) {
      issues.push({
        kind: 'registration.missing_student',
        entity: 'registration',
        id: r.id,
        detail: `Registration ${r.id} references missing student ${r.studentId}`,
      });
    }
    if (r.courseId && !courseIds.has(r.courseId)) {
      issues.push({
        kind: 'registration.missing_course',
        entity: 'registration',
        id: r.id,
        detail: `Registration ${r.id} references missing course ${r.courseId}`,
      });
    }
  }

  for (const p of (data.payments ?? []) as Array<{
    id: string;
    registrationId?: string;
  }>) {
    if (p.registrationId && !registrationIds.has(p.registrationId)) {
      issues.push({
        kind: 'payment.missing_registration',
        entity: 'payment',
        id: p.id,
        detail: `Payment ${p.id} references missing registration ${p.registrationId}`,
      });
    }
  }

  for (const s of (data.sessions ?? []) as Array<{
    id: string;
    courseId?: string;
  }>) {
    if (s.courseId && !courseIds.has(s.courseId)) {
      issues.push({
        kind: 'session.missing_course',
        entity: 'session',
        id: s.id,
        detail: `Session ${s.id} references missing course ${s.courseId}`,
      });
    }
  }

  for (const a of (data.attendance ?? []) as Array<{
    id: string;
    sessionId?: string;
    studentId?: string;
  }>) {
    if (a.sessionId && !sessionIds.has(a.sessionId)) {
      issues.push({
        kind: 'attendance.missing_session',
        entity: 'attendance',
        id: a.id,
        detail: `Attendance ${a.id} references missing session ${a.sessionId}`,
      });
    }
    if (a.studentId && !studentIds.has(a.studentId)) {
      issues.push({
        kind: 'attendance.missing_student',
        entity: 'attendance',
        id: a.id,
        detail: `Attendance ${a.id} references missing student ${a.studentId}`,
      });
    }
  }

  return issues;
}

export function summarizeIntegrityIssues(issues: IntegrityIssue[]): string {
  if (issues.length === 0) return 'Clean.';
  const counts = new Map<IntegrityKind, number>();
  for (const i of issues) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([kind, n]) => `${n}× ${kind}`)
    .join(', ');
}
