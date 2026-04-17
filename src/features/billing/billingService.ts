import type { Repo } from '@/data/repo';
import type {
  Course,
  Currency,
  Money,
  Payment,
  Registration,
  Student,
} from '@/domain/types';

export interface RegistrationView {
  registration: Registration;
  student?: Student;
  course?: Course;
  payments: Payment[];
  paidTotal: Money;
  balance: Money;
  offCurrencyPayments: Payment[];
}

export function sumPayments(payments: Payment[], currency: Currency): Money {
  const amount = payments
    .filter((p) => p.status === 'paid' && p.amount.currency === currency)
    .reduce((acc, p) => acc + p.amount.amount, 0);
  return { amount: round2(amount), currency };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeIsPaid(course: Course, payments: Payment[]): boolean {
  const paid = sumPayments(payments, course.price.currency);
  return paid.amount + 1e-9 >= course.price.amount;
}

export async function recomputeIsPaid(
  repo: Repo,
  registrationId: string,
): Promise<Registration | undefined> {
  const registration = await repo.registrations.get(registrationId);
  if (!registration) return undefined;
  const course = await repo.courses.get(registration.courseId);
  if (!course) return registration;
  const allPayments = await repo.payments.list();
  const payments = allPayments.filter((p) => p.registrationId === registrationId);
  const isPaid = computeIsPaid(course, payments);
  if (registration.isPaid !== isPaid) {
    return repo.registrations.update(registrationId, { isPaid });
  }
  return registration;
}

export async function listRegistrationViews(repo: Repo): Promise<RegistrationView[]> {
  const [registrations, students, courses, payments] = await Promise.all([
    repo.registrations.list(),
    repo.students.list(),
    repo.courses.list(),
    repo.payments.list(),
  ]);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return registrations.map((r) => {
    const course = courseById.get(r.courseId);
    const regPayments = payments.filter((p) => p.registrationId === r.id);
    const currency = course?.price.currency ?? 'USD';
    const paidTotal = sumPayments(regPayments, currency);
    const balanceAmount = course ? round2(course.price.amount - paidTotal.amount) : 0;
    const offCurrencyPayments = regPayments.filter(
      (p) => p.amount.currency !== currency && p.status === 'paid',
    );
    return {
      registration: r,
      student: studentById.get(r.studentId),
      course,
      payments: regPayments,
      paidTotal,
      balance: { amount: balanceAmount, currency },
      offCurrencyPayments,
    };
  });
}

export interface PaymentView {
  payment: Payment;
  registration?: Registration;
  student?: Student;
  course?: Course;
}

export async function listPaymentViews(repo: Repo): Promise<PaymentView[]> {
  const [payments, registrations, students, courses] = await Promise.all([
    repo.payments.list(),
    repo.registrations.list(),
    repo.students.list(),
    repo.courses.list(),
  ]);
  const registrationById = new Map(registrations.map((r) => [r.id, r]));
  const studentById = new Map(students.map((s) => [s.id, s]));
  const courseById = new Map(courses.map((c) => [c.id, c]));
  return payments.map((p) => {
    const reg = registrationById.get(p.registrationId);
    return {
      payment: p,
      registration: reg,
      student: reg ? studentById.get(reg.studentId) : undefined,
      course: reg ? courseById.get(reg.courseId) : undefined,
    };
  });
}
