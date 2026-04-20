import type { Repo } from './repo';
import type {
  AttendanceStatus,
  Course,
  DayOfWeek,
  PaymentMethod,
  Student,
} from '@/domain/types';
import { applyCourseSessions } from '@/features/courses/courseService';

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

export async function seedDemoData(repo: Repo): Promise<void> {
  await repo.reset();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const studentSpecs: Array<Omit<Student, 'id' | 'createdAt'>> = [
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1 555 0101', preferredPaymentMethod: 'card' },
    { name: 'Bob Martinez', email: 'bob@example.com', phone: '+1 555 0102', preferredPaymentMethod: 'cash' },
    { name: 'Chen Wei', email: 'chen@example.com', phone: '+1 555 0103', preferredPaymentMethod: 'bank_transfer' },
    { name: 'Diana Prince', email: 'diana@example.com', phone: '+1 555 0104', preferredPaymentMethod: 'card' },
    { name: 'Ethan Hunt', email: 'ethan@example.com', phone: '+1 555 0105', preferredPaymentMethod: 'cash' },
    { name: 'Fatima Al-Rashid', email: 'fatima@example.com', phone: '+1 555 0106', preferredPaymentMethod: 'bank_transfer' },
    { name: 'Gabriel Silva', email: 'gabriel@example.com', phone: '+1 555 0107', preferredPaymentMethod: 'card' },
    { name: 'Hana Tanaka', email: 'hana@example.com', phone: '+1 555 0108', preferredPaymentMethod: 'card' },
    { name: 'Ivan Petrov', email: 'ivan@example.com', phone: '+1 555 0109', preferredPaymentMethod: 'cash' },
    { name: 'Julia Romano', email: 'julia@example.com', phone: '+1 555 0110', preferredPaymentMethod: 'card' },
    { name: 'Kwame Mensah', email: 'kwame@example.com', phone: '+1 555 0111', preferredPaymentMethod: 'bank_transfer' },
    { name: 'Lena Müller', email: 'lena@example.com', phone: '+1 555 0112', preferredPaymentMethod: 'card' },
  ];

  const students: Student[] = [];
  for (const spec of studentSpecs) {
    students.push(await repo.students.create(spec));
  }

  const courseSpecs: Array<{
    spec: Omit<Course, 'id' | 'createdAt'>;
    enrolled: number[];
  }> = [
    {
      spec: {
        name: 'English B1 - Evening',
        type: 'group',
        startDate: isoDate(addMonths(today, -2)),
        endDate: isoDate(addDays(today, 30)),
        days: ['Mon', 'Wed'] as DayOfWeek[],
        startTime: '18:00',
        defaultDurationMin: 60,
        price: { amount: 300, currency: 'USD' },
        status: 'active',
      },
      enrolled: [0, 1, 2, 3, 6],
    },
    {
      spec: {
        name: 'English B2 - Morning',
        type: 'group',
        startDate: isoDate(addMonths(today, -1)),
        endDate: isoDate(addMonths(today, 1)),
        days: ['Tue', 'Thu'] as DayOfWeek[],
        startTime: '09:00',
        defaultDurationMin: 75,
        price: { amount: 350, currency: 'USD' },
        status: 'active',
      },
      enrolled: [4, 5, 7, 10],
    },
    {
      spec: {
        name: 'Private - Conversation',
        type: 'private',
        startDate: isoDate(addDays(today, -14)),
        endDate: isoDate(addDays(today, 30)),
        days: ['Tue', 'Thu'] as DayOfWeek[],
        startTime: '17:00',
        defaultDurationMin: 45,
        price: { amount: 400, currency: 'USD' },
        status: 'active',
      },
      enrolled: [1],
    },
    {
      spec: {
        name: 'Private - Business English',
        type: 'private',
        startDate: isoDate(addDays(today, -7)),
        endDate: isoDate(addMonths(today, 2)),
        days: ['Mon', 'Fri'] as DayOfWeek[],
        startTime: '12:00',
        defaultDurationMin: 60,
        price: { amount: 500, currency: 'USD' },
        status: 'active',
      },
      enrolled: [8],
    },
    {
      spec: {
        name: 'IELTS Prep - Weekend',
        type: 'group',
        startDate: isoDate(addDays(today, -21)),
        endDate: isoDate(addMonths(today, 2)),
        days: ['Sat'] as DayOfWeek[],
        startTime: '10:00',
        defaultDurationMin: 120,
        price: { amount: 450, currency: 'USD' },
        status: 'active',
      },
      enrolled: [0, 4, 9, 11],
    },
    {
      spec: {
        name: 'Kids English - Beginner (Archived)',
        type: 'group',
        startDate: isoDate(addMonths(today, -4)),
        endDate: isoDate(addMonths(today, -1)),
        days: ['Wed'] as DayOfWeek[],
        startTime: '16:00',
        defaultDurationMin: 45,
        price: { amount: 200, currency: 'USD' },
        status: 'archived',
      },
      enrolled: [2, 7],
    },
  ];

  const paymentMethods: PaymentMethod[] = ['card', 'cash', 'bank_transfer'];

  for (const { spec, enrolled } of courseSpecs) {
    const course = await repo.courses.create(spec);

    for (let i = 0; i < enrolled.length; i++) {
      const student = students[enrolled[i]];
      const regDate = isoDate(addDays(new Date(spec.startDate), i));
      const isPaid = i % 3 !== 0;
      const registration = await repo.registrations.create({
        studentId: student.id,
        courseId: course.id,
        isPaid,
        registrationDate: regDate,
      });

      if (isPaid) {
        await repo.payments.create({
          registrationId: registration.id,
          amount: spec.price,
          method: student.preferredPaymentMethod ?? paymentMethods[i % paymentMethods.length],
          status: 'paid',
          paidAt: regDate,
          note: 'Full payment',
        });
      } else if (i % 4 === 0) {
        await repo.payments.create({
          registrationId: registration.id,
          amount: { amount: Math.round(spec.price.amount / 2), currency: spec.price.currency },
          method: paymentMethods[i % paymentMethods.length],
          status: 'paid',
          paidAt: regDate,
          note: 'Partial payment',
        });
      }
    }

    await applyCourseSessions(repo, course);
  }

  const allSessions = await repo.sessions.list();
  const allRegistrations = await repo.registrations.list();
  const regsByCourse = new Map<string, string[]>();
  for (const reg of allRegistrations) {
    const list = regsByCourse.get(reg.courseId) ?? [];
    list.push(reg.studentId);
    regsByCourse.set(reg.courseId, list);
  }

  const todayIso = isoDate(today);
  const attendanceStatuses: AttendanceStatus[] = ['present', 'present', 'present', 'late', 'absent', 'excused'];

  let rng = 0;
  for (const session of allSessions) {
    if (session.date >= todayIso) continue;
    const studentIds = regsByCourse.get(session.courseId) ?? [];
    const newStatus: 'completed' | 'cancelled' = rng % 20 === 0 ? 'cancelled' : 'completed';
    await repo.sessions.update(session.id, { status: newStatus });

    if (newStatus === 'cancelled') {
      rng++;
      continue;
    }

    for (const studentId of studentIds) {
      const status = attendanceStatuses[rng % attendanceStatuses.length];
      await repo.attendance.create({
        sessionId: session.id,
        studentId,
        status,
      });
      rng++;
    }
  }
}
