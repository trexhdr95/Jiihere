import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, Payment, Registration, Student } from '@/domain/types';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { Input, Select, Textarea } from '@/ui/primitives/Input';
import { formatMoney } from '@/lib/format';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED'] as const;

// Upper bound kept deliberately generous so unusual-but-legitimate amounts
// (e.g. a term-long private block paid up front) don't need an override.
// A user entering $99,999,999 for a $300 course will still be blocked.
const MAX_PAYMENT_AMOUNT = 1_000_000;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const schema = z.object({
  registrationId: z.string().min(1, 'Pick a registration'),
  /**
   * When the registration has a planned installment schedule, this selects
   * which planned installment the payment settles. Undefined for ad-hoc
   * payments or registrations without a plan.
   */
  installmentIndex: z.coerce.number().int().min(0).max(1).optional(),
  amount: z.coerce
    .number()
    .min(0.01, 'Amount must be positive')
    .max(MAX_PAYMENT_AMOUNT, `Amount cannot exceed ${MAX_PAYMENT_AMOUNT.toLocaleString()}`),
  currency: z.enum(CURRENCIES),
  method: z.enum([
    'cash',
    'card',
    'bank_transfer',
    'whish',
    'omt',
    'western_union',
    'ltn',
    'other',
  ]),
  status: z.enum(['paid', 'pending', 'failed', 'refunded']),
  paidAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date')
    .refine((d) => d <= todayISO(), 'Payment date cannot be in the future'),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : v)),
});

export type PaymentFormInput = z.input<typeof schema>;
export type PaymentFormValues = z.output<typeof schema>;

export interface PaymentFormProps {
  initial?: Payment;
  lockedRegistrationId?: string;
  suggestedAmount?: number;
  registrations: Registration[];
  students: Student[];
  courses: Course[];
  busy?: boolean;
  onSubmit: (values: PaymentFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function defaultValues(props: Pick<PaymentFormProps, 'initial' | 'lockedRegistrationId' | 'suggestedAmount' | 'registrations' | 'courses'>): PaymentFormInput {
  const regId = props.initial?.registrationId ?? props.lockedRegistrationId ?? '';
  const reg = props.registrations.find((r) => r.id === regId);
  const course = reg ? props.courses.find((c) => c.id === reg.courseId) : undefined;
  const currency = props.initial?.amount.currency ?? course?.price.currency ?? 'USD';
  const amount =
    props.initial?.amount.amount ??
    (props.suggestedAmount != null && props.suggestedAmount > 0 ? props.suggestedAmount : 0);
  return {
    registrationId: regId,
    amount,
    currency,
    method: props.initial?.method ?? 'cash',
    status: props.initial?.status ?? 'paid',
    paidAt: props.initial?.paidAt ?? todayISO(),
    note: props.initial?.note ?? '',
  };
}

export function PaymentForm(props: PaymentFormProps) {
  const { initial, lockedRegistrationId, registrations, students, courses, busy, onSubmit, onCancel } = props;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(props),
  });

  useEffect(() => {
    reset(defaultValues(props));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.id, lockedRegistrationId]);

  // If the chosen registration has an installment plan with any unpaid
  // items, let the user pick which one this payment settles and pre-fill
  // amount + currency from that installment's plan.
  const selectedRegistrationId = watch('registrationId');
  const selectedRegistration = useMemo(
    () => registrations.find((r) => r.id === selectedRegistrationId),
    [registrations, selectedRegistrationId],
  );
  const unpaidInstallments = useMemo(() => {
    const plan = selectedRegistration?.installments ?? [];
    return plan
      .map((inst, idx) => ({ inst, idx }))
      .filter(({ inst }) => !inst.paymentId || inst.paymentId === initial?.id);
  }, [selectedRegistration, initial]);

  const selectedInstallmentIndex = watch('installmentIndex');

  // When the user picks an installment, pre-fill amount + currency + paidAt
  // from the plan. Only auto-fill on the initial pick so manually edited
  // amounts aren't clobbered after the fact.
  const lastAutoFilledIndexRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (selectedInstallmentIndex === undefined) return;
    if (lastAutoFilledIndexRef.current === selectedInstallmentIndex) return;
    lastAutoFilledIndexRef.current = selectedInstallmentIndex;
    const plan = selectedRegistration?.installments?.[selectedInstallmentIndex];
    if (!plan) return;
    setValue('amount', plan.amount, { shouldValidate: false });
    setValue('currency', plan.currency, { shouldValidate: false });
  }, [selectedInstallmentIndex, selectedRegistration, setValue]);

  const options = useMemo(() => {
    const studentById = new Map(students.map((s) => [s.id, s]));
    const courseById = new Map(courses.map((c) => [c.id, c]));
    return registrations
      .map((r) => {
        const student = studentById.get(r.studentId);
        const course = courseById.get(r.courseId);
        return {
          id: r.id,
          label: `${student?.name ?? 'Unknown'} — ${course?.name ?? 'Unknown course'}${
            course ? ` (${formatMoney(course.price)})` : ''
          }`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [registrations, students, courses]);

  const disabled = busy || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-4"
    >
      <Select
        label="Registration"
        error={errors.registrationId?.message}
        disabled={!!lockedRegistrationId && !initial}
        {...register('registrationId')}
      >
        <option value="">Choose a registration…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </Select>

      {/* When the chosen registration has an installment plan with any
          unpaid (or currently-being-edited) items, let the user pick which
          installment this payment settles. Picking auto-fills amount. */}
      {unpaidInstallments.length > 0 && (
        <Select
          label="Installment"
          hint="Which planned installment is this payment for?"
          error={errors.installmentIndex?.message}
          {...register('installmentIndex')}
        >
          <option value="">—</option>
          {unpaidInstallments.map(({ inst, idx }) => (
            <option key={idx} value={idx}>
              {inst.label ?? `Installment ${idx + 1}`} · {formatMoney({ amount: inst.amount, currency: inst.currency })} · due {inst.dueDate}
            </option>
          ))}
        </Select>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Input
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select
          label="Currency"
          className="min-w-[6rem]"
          error={errors.currency?.message}
          {...register('currency')}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Method" error={errors.method?.message} {...register('method')}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </Select>
        <Select label="Status" error={errors.status?.message} {...register('status')}>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>

      <Input
        label="Paid on"
        type="date"
        error={errors.paidAt?.message}
        {...register('paidAt')}
      />

      <Textarea label="Note" placeholder="Optional" rows={2} error={errors.note?.message} {...register('note')} />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {initial ? 'Save changes' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
