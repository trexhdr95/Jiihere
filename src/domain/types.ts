export type ID = string;

export type Currency = 'USD' | 'EUR' | 'GBP' | 'SAR' | 'AED';

export interface Money {
  amount: number;
  currency: Currency;
}

export type CourseType = 'group' | 'private';

export type DayOfWeek = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type SessionStatus = 'scheduled' | 'completed' | 'cancelled';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'whish'
  | 'omt'
  | 'western_union'
  | 'ltn'
  | 'other';

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  whish: 'Whish',
  omt: 'OMT',
  western_union: 'Western Union',
  ltn: 'LTN',
  other: 'Other',
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'card',
  'bank_transfer',
  'whish',
  'omt',
  'western_union',
  'ltn',
  'other',
];

export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded';

export interface Student {
  id: ID;
  ownerId?: ID;
  name: string;
  email?: string;
  phone?: string;
  preferredPaymentMethod?: PaymentMethod;
  notes?: string;
  createdAt: string;
}

export interface Course {
  id: ID;
  ownerId?: ID;
  name: string;
  type: CourseType;
  startDate: string;
  endDate: string;
  days: DayOfWeek[];
  startTime: string;
  defaultDurationMin: number;
  price: Money;
  status: 'active' | 'archived';
  notes?: string;
  createdAt: string;
}

/**
 * A planned installment on a registration — the teacher expects the student
 * to pay this amount by `dueDate`. When `paymentId` is set, the installment
 * has been settled by that Payment record; until then it's outstanding and
 * shows up in overdue / due-soon reports if past its date.
 *
 * Stored on `Registration.installments` so the plan travels with the
 * registration (one source of truth), while the actual receipts live as
 * normal Payment records (double-entry: plan + receipt).
 */
export interface InstallmentPlan {
  /** Short label like "Deposit" / "Balance" / "1st" / "2nd". Optional. */
  label?: string;
  amount: number;
  currency: Currency;
  /**
   * YYYY-MM-DD. Optional — an installment paid at enrolment (e.g. "1st in
   * cash now, 2nd by bank transfer in 30 days") has no future due date.
   * When `paymentId` is set but `dueDate` is missing, treat the payment's
   * `paidAt` as the effective date.
   */
  dueDate?: string;
  /** When set, this installment has been settled by that Payment. */
  paymentId?: ID;
}

export interface Registration {
  id: ID;
  ownerId?: ID;
  studentId: ID;
  courseId: ID;
  isPaid: boolean;
  registrationDate: string;
  /**
   * Legacy single-payment due date. Kept for backwards compat with backups
   * created before the `installments` field existed. New records should
   * use `installments` instead (a single-installment plan expresses the
   * same thing with more structure).
   */
  paymentDueDate?: string;
  /**
   * Planned installments. Length 0 (implicit — prop omitted) means no plan
   * was recorded. Length 1 means a single scheduled payment. Length 2 is
   * the "deposit + balance" split the teacher commonly agrees to. The app
   * caps at 2 per the 2-payment business rule.
   */
  installments?: InstallmentPlan[];
  createdAt: string;
}

export interface Payment {
  id: ID;
  ownerId?: ID;
  registrationId: ID;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string;
  note?: string;
  createdAt: string;
}

export interface Session {
  id: ID;
  ownerId?: ID;
  courseId: ID;
  date: string;
  startTime: string;
  durationMin: number;
  status: SessionStatus;
  note?: string;
  createdAt: string;
}

export interface Attendance {
  id: ID;
  ownerId?: ID;
  sessionId: ID;
  studentId: ID;
  status: AttendanceStatus;
  note?: string;
  createdAt: string;
}

export const DAYS_OF_WEEK: DayOfWeek[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
