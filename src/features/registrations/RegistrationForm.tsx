import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, PaymentMethod, Registration, Student } from '@/domain/types';
import { PAYMENT_METHOD_LABEL, PAYMENT_METHODS } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { Input, Select } from '@/ui/primitives/Input';
import { formatMoney } from '@/lib/format';

// Three mutually-exclusive modes, gated by `paymentMode`:
//   'paid_full'     — single method; page creates a full-price paid Payment.
//   'single_later'  — one due date for the whole course price.
//   'two_installments' — deposit + balance, each independently either paid
//                     now (with a method) or due later (with a due date).

const methodEnum = z.enum([
  'cash',
  'card',
  'bank_transfer',
  'whish',
  'omt',
  'western_union',
  'ltn',
  'other',
]);

const schema = z
  .object({
    studentId: z.string().min(1, 'Pick a student'),
    courseId: z.string().min(1, 'Pick a course'),
    registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    paymentMode: z.enum(['paid_full', 'single_later', 'two_installments']),
    // paid_full
    paymentMethod: methodEnum.optional(),
    // single_later
    paymentDueDate: z.string().optional(),
    // two_installments — each installment can be "paid now" or "due later"
    firstAmount: z.coerce.number().optional(),
    firstPaidNow: z.boolean().optional(),
    firstMethod: methodEnum.optional(),
    firstDueDate: z.string().optional(),
    secondAmount: z.coerce.number().optional(),
    secondPaidNow: z.boolean().optional(),
    secondMethod: methodEnum.optional(),
    secondDueDate: z.string().optional(),
    // Reference values we need at refine-time
    coursePriceAmount: z.coerce.number().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.paymentMode === 'paid_full') {
      if (!v.paymentMethod) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentMethod'],
          message: 'Pick how the student paid',
        });
      }
    } else if (v.paymentMode === 'single_later') {
      if (!v.paymentDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(v.paymentDueDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['paymentDueDate'],
          message: 'Pick a payment due date',
        });
      }
    } else {
      // two_installments — validate each independently.
      const checkInstallment = (
        amount: number | undefined,
        paidNow: boolean | undefined,
        method: string | undefined,
        dueDate: string | undefined,
        amountPath: 'firstAmount' | 'secondAmount',
        methodPath: 'firstMethod' | 'secondMethod',
        datePath: 'firstDueDate' | 'secondDueDate',
        label: string,
      ) => {
        if (!amount || amount <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [amountPath],
            message: `${label} amount must be > 0`,
          });
        }
        if (paidNow) {
          if (!method) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [methodPath],
              message: `${label}: pick how it was paid`,
            });
          }
        } else {
          if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [datePath],
              message: `${label}: pick a due date`,
            });
          }
        }
      };
      checkInstallment(
        v.firstAmount,
        v.firstPaidNow,
        v.firstMethod,
        v.firstDueDate,
        'firstAmount',
        'firstMethod',
        'firstDueDate',
        '1st installment',
      );
      checkInstallment(
        v.secondAmount,
        v.secondPaidNow,
        v.secondMethod,
        v.secondDueDate,
        'secondAmount',
        'secondMethod',
        'secondDueDate',
        '2nd installment',
      );
      if (
        v.firstAmount &&
        v.secondAmount &&
        v.coursePriceAmount &&
        Math.abs(v.firstAmount + v.secondAmount - v.coursePriceAmount) > 0.01
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['secondAmount'],
          message: `Installments must total ${v.coursePriceAmount.toFixed(2)}. Current: ${(
            v.firstAmount + v.secondAmount
          ).toFixed(2)}`,
        });
      }
      if (
        !v.firstPaidNow &&
        !v.secondPaidNow &&
        v.firstDueDate &&
        v.secondDueDate &&
        v.secondDueDate < v.firstDueDate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['secondDueDate'],
          message: '2nd due date must be on or after the 1st',
        });
      }
    }
  });

export type RegistrationFormValues = z.infer<typeof schema>;

export interface RegistrationFormProps {
  initial?: Registration;
  students: Student[];
  courses: Course[];
  existing: Registration[];
  busy?: boolean;
  onSubmit: (values: RegistrationFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function in30DaysISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function RegistrationForm({
  initial,
  students,
  courses,
  existing,
  busy,
  onSubmit,
  onCancel,
}: RegistrationFormProps) {
  const defaults = useMemo<RegistrationFormValues>(
    () => ({
      studentId: initial?.studentId ?? '',
      courseId: initial?.courseId ?? '',
      registrationDate: initial?.registrationDate ?? todayISO(),
      paymentMode: initial?.isPaid ? 'paid_full' : 'single_later',
      paymentMethod: undefined,
      paymentDueDate: initial?.paymentDueDate ?? '',
      firstAmount: undefined,
      firstPaidNow: false,
      firstMethod: undefined,
      firstDueDate: '',
      secondAmount: undefined,
      secondPaidNow: false,
      secondMethod: undefined,
      secondDueDate: '',
      coursePriceAmount: undefined,
    }),
    [initial],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const studentId = watch('studentId');
  const courseId = watch('courseId');
  const paymentMode = watch('paymentMode');
  const firstAmount = watch('firstAmount');
  const firstPaidNow = watch('firstPaidNow');
  const secondPaidNow = watch('secondPaidNow');

  const duplicate = useMemo(() => {
    if (!studentId || !courseId) return null;
    return existing.find(
      (r) =>
        r.studentId === studentId && r.courseId === courseId && r.id !== initial?.id,
    );
  }, [existing, studentId, courseId, initial]);

  useEffect(() => {
    if (duplicate) {
      setError('courseId', {
        type: 'duplicate',
        message: 'This student is already enrolled in this course.',
      });
    } else {
      clearErrors('courseId');
    }
  }, [duplicate, setError, clearErrors]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId),
    [students, studentId],
  );
  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );

  useEffect(() => {
    if (selectedCourse) {
      setValue('coursePriceAmount', selectedCourse.price.amount, {
        shouldValidate: false,
      });
    }
  }, [selectedCourse, setValue]);

  // Seed sensible defaults whenever the user flips to the 2-installments mode
  // so they don't need to type from scratch: half-and-half, 1st due today,
  // 2nd in 30 days, neither paid yet.
  useEffect(() => {
    if (paymentMode !== 'two_installments' || !selectedCourse) return;
    const half = Math.round((selectedCourse.price.amount / 2) * 100) / 100;
    setValue('firstAmount', half, { shouldValidate: false });
    setValue('firstDueDate', todayISO(), { shouldValidate: false });
    setValue('secondAmount', selectedCourse.price.amount - half, {
      shouldValidate: false,
    });
    setValue('secondDueDate', in30DaysISO(), { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMode, selectedCourse?.id]);

  // When first amount changes, keep second as the remaining balance.
  useEffect(() => {
    if (paymentMode !== 'two_installments' || !selectedCourse || !firstAmount) return;
    const remaining =
      Math.round((selectedCourse.price.amount - firstAmount) * 100) / 100;
    if (remaining >= 0) {
      setValue('secondAmount', remaining, { shouldValidate: false });
    }
  }, [firstAmount, paymentMode, selectedCourse, setValue]);

  const disabled = busy || isSubmitting || !!duplicate;

  const sortedStudents = useMemo(
    () => [...students].sort((a, b) => a.name.localeCompare(b.name)),
    [students],
  );
  const sortedCourses = useMemo(
    () =>
      [...courses]
        .filter((c) => c.status === 'active' || c.id === initial?.courseId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [courses, initial],
  );

  const suggestedMethod: PaymentMethod =
    selectedStudent?.preferredPaymentMethod ?? 'cash';

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-4"
    >
      <Select label="Student" error={errors.studentId?.message} {...register('studentId')}>
        <option value="">Choose a student…</option>
        {sortedStudents.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
      <Select label="Course" error={errors.courseId?.message} {...register('courseId')}>
        <option value="">Choose a course…</option>
        {sortedCourses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input
        label="Registration date"
        type="date"
        error={errors.registrationDate?.message}
        {...register('registrationDate')}
      />

      {!initial && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
            Payment plan
          </div>
          <div className="space-y-2">
            {(
              [
                { v: 'paid_full', label: 'Paid in full now' },
                { v: 'single_later', label: 'One payment on a due date' },
                { v: 'two_installments', label: 'Split into 2 installments' },
              ] as const
            ).map((opt) => (
              <label key={opt.v} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value={opt.v}
                  {...register('paymentMode')}
                  className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-slate-800">{opt.label}</span>
              </label>
            ))}
          </div>

          {paymentMode === 'paid_full' && (
            <div className="mt-3">
              <Select
                label="Payment method"
                error={errors.paymentMethod?.message}
                defaultValue={suggestedMethod}
                {...register('paymentMethod')}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
              {selectedCourse && (
                <div className="mt-1 text-[11px] text-slate-500">
                  {formatMoney(selectedCourse.price)} will be recorded as a paid
                  payment.
                </div>
              )}
            </div>
          )}

          {paymentMode === 'single_later' && (
            <div className="mt-3">
              <Input
                label="Payment due date"
                type="date"
                error={errors.paymentDueDate?.message}
                hint="When the student is expected to pay."
                {...register('paymentDueDate')}
              />
            </div>
          )}

          {paymentMode === 'two_installments' && (
            <div className="mt-3 space-y-4">
              {selectedCourse && (
                <div className="text-[11px] text-slate-500">
                  Course price {formatMoney(selectedCourse.price)}. The two
                  installments must total this.
                </div>
              )}

              <InstallmentBlock
                title="1st installment"
                amountName="firstAmount"
                paidNowName="firstPaidNow"
                methodName="firstMethod"
                dueDateName="firstDueDate"
                amountError={errors.firstAmount?.message}
                methodError={errors.firstMethod?.message}
                dueDateError={errors.firstDueDate?.message}
                paidNow={!!firstPaidNow}
                register={register}
                suggestedMethod={suggestedMethod}
              />

              <InstallmentBlock
                title="2nd installment"
                amountName="secondAmount"
                paidNowName="secondPaidNow"
                methodName="secondMethod"
                dueDateName="secondDueDate"
                amountError={errors.secondAmount?.message}
                methodError={errors.secondMethod?.message}
                dueDateError={errors.secondDueDate?.message}
                paidNow={!!secondPaidNow}
                register={register}
                suggestedMethod={suggestedMethod}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {initial ? 'Save changes' : 'Enroll'}
        </Button>
      </div>
    </form>
  );
}

function InstallmentBlock(props: {
  title: string;
  amountName: 'firstAmount' | 'secondAmount';
  paidNowName: 'firstPaidNow' | 'secondPaidNow';
  methodName: 'firstMethod' | 'secondMethod';
  dueDateName: 'firstDueDate' | 'secondDueDate';
  amountError?: string;
  methodError?: string;
  dueDateError?: string;
  paidNow: boolean;
  register: ReturnType<typeof useForm<RegistrationFormValues>>['register'];
  suggestedMethod: PaymentMethod;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {props.title}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-700">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            {...props.register(props.paidNowName)}
          />
          Already paid
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min={0}
          error={props.amountError}
          {...props.register(props.amountName)}
        />
        {props.paidNow ? (
          <Select
            label="Method"
            error={props.methodError}
            defaultValue={props.suggestedMethod}
            {...props.register(props.methodName)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            label="Due date"
            type="date"
            error={props.dueDateError}
            {...props.register(props.dueDateName)}
          />
        )}
      </div>
    </div>
  );
}
