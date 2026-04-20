import type {
  Attendance,
  AttendanceStatus,
  Course,
  CourseType,
  Currency,
  DayOfWeek,
  InstallmentPlan,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Registration,
  Session,
  SessionStatus,
  Student,
} from '@/domain/types';
import type { EntityRepo, Repo } from './repo';
import { supabase } from './supabaseClient';

/*
 * Supabase-backed implementation of the Repo interface.
 *
 * The client domain uses camelCase and nested shapes (e.g. `course.price =
 * { amount, currency }`); Postgres uses snake_case and flattens those into
 * columns (`price_amount`, `price_currency`). Every entity gets two
 * converters — `dbTo*` on the way in, `*ToDb` on the way out — so the
 * service/UI layers don't need to know the DB exists.
 *
 * Every row is stamped with `owner_id = auth.uid()` on insert; RLS
 * enforces that the user only reads/writes their own rows.
 */

// ---------------------------------------------------------------------------
// Per-entity converters
// ---------------------------------------------------------------------------

interface StudentRow {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferred_payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
}

function dbToStudent(row: StudentRow): Student {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    preferredPaymentMethod: row.preferred_payment_method ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function studentToDb(
  input: Partial<Omit<Student, 'id' | 'createdAt'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('name' in input) out.name = input.name ?? '';
  if ('email' in input) out.email = input.email ?? null;
  if ('phone' in input) out.phone = input.phone ?? null;
  if ('preferredPaymentMethod' in input)
    out.preferred_payment_method = input.preferredPaymentMethod ?? null;
  if ('notes' in input) out.notes = input.notes ?? null;
  return out;
}

interface CourseRow {
  id: string;
  owner_id: string;
  name: string;
  type: CourseType;
  start_date: string;
  end_date: string;
  days: string[];
  start_time: string;
  default_duration_min: number;
  price_amount: number | string;
  price_currency: Currency;
  status: 'active' | 'archived';
  notes: string | null;
  created_at: string;
}

function dbToCourse(row: CourseRow): Course {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    days: row.days as DayOfWeek[],
    startTime: row.start_time,
    defaultDurationMin: row.default_duration_min,
    price: {
      amount: Number(row.price_amount),
      currency: row.price_currency,
    },
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function courseToDb(
  input: Partial<Omit<Course, 'id' | 'createdAt'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('name' in input) out.name = input.name;
  if ('type' in input) out.type = input.type;
  if ('startDate' in input) out.start_date = input.startDate;
  if ('endDate' in input) out.end_date = input.endDate;
  if ('days' in input) out.days = input.days;
  if ('startTime' in input) out.start_time = input.startTime;
  if ('defaultDurationMin' in input) out.default_duration_min = input.defaultDurationMin;
  if ('price' in input && input.price) {
    out.price_amount = input.price.amount;
    out.price_currency = input.price.currency;
  }
  if ('status' in input) out.status = input.status;
  if ('notes' in input) out.notes = input.notes ?? null;
  return out;
}

interface RegistrationRow {
  id: string;
  owner_id: string;
  student_id: string;
  course_id: string;
  is_paid: boolean;
  registration_date: string;
  payment_due_date: string | null;
  installments: InstallmentPlan[] | null;
  created_at: string;
}

function dbToRegistration(row: RegistrationRow): Registration {
  return {
    id: row.id,
    ownerId: row.owner_id,
    studentId: row.student_id,
    courseId: row.course_id,
    isPaid: row.is_paid,
    registrationDate: row.registration_date,
    paymentDueDate: row.payment_due_date ?? undefined,
    installments: row.installments ?? undefined,
    createdAt: row.created_at,
  };
}

function registrationToDb(
  input: Partial<Omit<Registration, 'id' | 'createdAt'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('studentId' in input) out.student_id = input.studentId;
  if ('courseId' in input) out.course_id = input.courseId;
  if ('isPaid' in input) out.is_paid = input.isPaid;
  if ('registrationDate' in input) out.registration_date = input.registrationDate;
  if ('paymentDueDate' in input) out.payment_due_date = input.paymentDueDate ?? null;
  if ('installments' in input) out.installments = input.installments ?? null;
  return out;
}

interface PaymentRow {
  id: string;
  owner_id: string;
  registration_id: string;
  amount: number | string;
  currency: Currency;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string;
  note: string | null;
  created_at: string;
}

function dbToPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    registrationId: row.registration_id,
    amount: { amount: Number(row.amount), currency: row.currency },
    method: row.method,
    status: row.status,
    paidAt: row.paid_at,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function paymentToDb(
  input: Partial<Omit<Payment, 'id' | 'createdAt'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('registrationId' in input) out.registration_id = input.registrationId;
  if ('amount' in input && input.amount) {
    out.amount = input.amount.amount;
    out.currency = input.amount.currency;
  }
  if ('method' in input) out.method = input.method;
  if ('status' in input) out.status = input.status;
  if ('paidAt' in input) out.paid_at = input.paidAt;
  if ('note' in input) out.note = input.note ?? null;
  return out;
}

interface SessionRow {
  id: string;
  owner_id: string;
  course_id: string;
  date: string;
  start_time: string;
  duration_min: number;
  status: SessionStatus;
  note: string | null;
  created_at: string;
}

function dbToSession(row: SessionRow): Session {
  return {
    id: row.id,
    ownerId: row.owner_id,
    courseId: row.course_id,
    date: row.date,
    startTime: row.start_time,
    durationMin: row.duration_min,
    status: row.status,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function sessionToDb(
  input: Partial<Omit<Session, 'id' | 'createdAt'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('courseId' in input) out.course_id = input.courseId;
  if ('date' in input) out.date = input.date;
  if ('startTime' in input) out.start_time = input.startTime;
  if ('durationMin' in input) out.duration_min = input.durationMin;
  if ('status' in input) out.status = input.status;
  if ('note' in input) out.note = input.note ?? null;
  return out;
}

interface AttendanceRow {
  id: string;
  owner_id: string;
  session_id: string;
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
}

function dbToAttendance(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sessionId: row.session_id,
    studentId: row.student_id,
    status: row.status,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function attendanceToDb(
  input: Partial<Omit<Attendance, 'id' | 'createdAt'>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('sessionId' in input) out.session_id = input.sessionId;
  if ('studentId' in input) out.student_id = input.studentId;
  if ('status' in input) out.status = input.status;
  if ('note' in input) out.note = input.note ?? null;
  return out;
}

// ---------------------------------------------------------------------------
// Generic entity repo factory
// ---------------------------------------------------------------------------

function makeEntityRepo<TDomain extends { id: string }, TRow>(
  table: string,
  ownerId: string,
  dbToDomain: (row: TRow) => TDomain,
  domainToDb: (input: Partial<TDomain>) => Record<string, unknown>,
): EntityRepo<TDomain> {
  return {
    async list() {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw error;
      return (data ?? []).map((r) => dbToDomain(r as TRow));
    },
    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToDomain(data as TRow) : undefined;
    },
    async create(input) {
      const payload = { ...domainToDb(input as Partial<TDomain>), owner_id: ownerId };
      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select('*')
        .single();
      if (error) throw error;
      return dbToDomain(data as TRow);
    },
    async update(id, patch) {
      const payload = domainToDb(patch as Partial<TDomain>);
      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return dbToDomain(data as TRow);
    },
    async remove(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Build a Repo scoped to a specific user. The ownerId is stamped on every
 * `create` payload; RLS enforces that reads/writes can only touch rows
 * matching the signed-in user anyway, so the stamp is belt-and-braces.
 */
export function createSupabaseRepo(ownerId: string): Repo {
  const students = makeEntityRepo<Student, StudentRow>(
    'students',
    ownerId,
    dbToStudent,
    (p) => studentToDb(p as Partial<Omit<Student, 'id' | 'createdAt'>>),
  );
  const courses = makeEntityRepo<Course, CourseRow>(
    'courses',
    ownerId,
    dbToCourse,
    (p) => courseToDb(p as Partial<Omit<Course, 'id' | 'createdAt'>>),
  );
  const registrations = makeEntityRepo<Registration, RegistrationRow>(
    'registrations',
    ownerId,
    dbToRegistration,
    (p) => registrationToDb(p as Partial<Omit<Registration, 'id' | 'createdAt'>>),
  );
  const payments = makeEntityRepo<Payment, PaymentRow>(
    'payments',
    ownerId,
    dbToPayment,
    (p) => paymentToDb(p as Partial<Omit<Payment, 'id' | 'createdAt'>>),
  );
  const sessions = makeEntityRepo<Session, SessionRow>(
    'sessions',
    ownerId,
    dbToSession,
    (p) => sessionToDb(p as Partial<Omit<Session, 'id' | 'createdAt'>>),
  );
  const attendance = makeEntityRepo<Attendance, AttendanceRow>(
    'attendance',
    ownerId,
    dbToAttendance,
    (p) => attendanceToDb(p as Partial<Omit<Attendance, 'id' | 'createdAt'>>),
  );

  return {
    students,
    courses,
    registrations,
    payments,
    sessions,
    attendance,
    // Delete in reverse FK order. CASCADE on the course→session and
    // student→registration FKs means deleting students + courses on its
    // own would chain-delete the rest; explicit order here just keeps the
    // ordering intention clear even if the schema changes later.
    async reset() {
      for (const t of ['attendance', 'sessions', 'payments', 'registrations', 'courses', 'students']) {
        const { error } = await supabase.from(t).delete().eq('owner_id', ownerId);
        if (error) throw error;
      }
    },
    async exportAll() {
      const [s, c, r, p, se, a] = await Promise.all([
        students.list(),
        courses.list(),
        registrations.list(),
        payments.list(),
        sessions.list(),
        attendance.list(),
      ]);
      return {
        students: s,
        courses: c,
        registrations: r,
        payments: p,
        sessions: se,
        attendance: a,
      };
    },
    // Insert in FK order: students + courses first, then registrations,
    // then sessions, then payments + attendance. Payloads are transformed
    // to DB shape and stamped with owner_id.
    async importAll(data) {
      const insertIntoTable = async (
        table: string,
        rows: unknown[],
        toDb: (r: Record<string, unknown>) => Record<string, unknown>,
      ) => {
        if (!Array.isArray(rows) || rows.length === 0) return;
        const payload = rows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            ...toDb(row),
            id: row.id, // preserve backup IDs so FK references stay valid
            owner_id: ownerId,
            created_at: row.createdAt,
          };
        });
        const { error } = await supabase.from(table).insert(payload);
        if (error) throw error;
      };
      await insertIntoTable(
        'students',
        (data.students as unknown[]) ?? [],
        (r) => studentToDb(r as Partial<Student>),
      );
      await insertIntoTable(
        'courses',
        (data.courses as unknown[]) ?? [],
        (r) => courseToDb(r as Partial<Course>),
      );
      await insertIntoTable(
        'registrations',
        (data.registrations as unknown[]) ?? [],
        (r) => registrationToDb(r as Partial<Registration>),
      );
      await insertIntoTable(
        'sessions',
        (data.sessions as unknown[]) ?? [],
        (r) => sessionToDb(r as Partial<Session>),
      );
      await insertIntoTable(
        'payments',
        (data.payments as unknown[]) ?? [],
        (r) => paymentToDb(r as Partial<Payment>),
      );
      await insertIntoTable(
        'attendance',
        (data.attendance as unknown[]) ?? [],
        (r) => attendanceToDb(r as Partial<Attendance>),
      );
    },
  };
}
