import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Course, DayOfWeek } from '@/domain/types';
import { DAYS_OF_WEEK } from '@/domain/types';
import { Button } from '@/ui/primitives/Button';
import { Input, Select } from '@/ui/primitives/Input';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED'] as const;

const schema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(160),
    type: z.enum(['group', 'private']),
    status: z.enum(['active', 'archived']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
    days: z.array(z.enum(DAYS_OF_WEEK as unknown as [DayOfWeek, ...DayOfWeek[]])).min(1, 'Pick at least one day'),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
    defaultDurationMin: z.coerce.number().int().min(5).max(600),
    priceAmount: z.coerce.number().min(0),
    priceCurrency: z.enum(CURRENCIES),
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v === '' || v === undefined ? undefined : v)),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ['endDate'],
    message: 'End date must be on or after start date',
  });

export type CourseFormInput = z.input<typeof schema>;
export type CourseFormValues = z.output<typeof schema>;

export interface CourseFormProps {
  initial?: Course;
  busy?: boolean;
  onSubmit: (values: CourseFormValues) => void | Promise<void>;
  onCancel: () => void;
}

function initialValues(initial?: Course): CourseFormInput {
  return {
    name: initial?.name ?? '',
    type: initial?.type ?? 'group',
    status: initial?.status ?? 'active',
    startDate: initial?.startDate ?? '',
    endDate: initial?.endDate ?? '',
    days: initial?.days ?? [],
    startTime: initial?.startTime ?? '17:00',
    defaultDurationMin: initial?.defaultDurationMin ?? 60,
    priceAmount: initial?.price.amount ?? 0,
    priceCurrency: initial?.price.currency ?? 'USD',
    notes: initial?.notes ?? '',
  };
}

export function CourseForm({ initial, busy, onSubmit, onCancel }: CourseFormProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseFormInput, unknown, CourseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(initial),
  });

  useEffect(() => {
    reset(initialValues(initial));
  }, [initial, reset]);

  const disabled = busy || isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(async (v) => {
        await onSubmit(v);
      })}
      className="space-y-4"
    >
      <Input
        label="Course name"
        placeholder="English B1 - Evening"
        autoFocus
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Type" error={errors.type?.message} {...register('type')}>
          <option value="group">Group</option>
          <option value="private">Private</option>
        </Select>
        <Select label="Status" error={errors.status?.message} {...register('status')}>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Start date"
          type="date"
          error={errors.startDate?.message}
          {...register('startDate')}
        />
        <Input
          label="End date"
          type="date"
          error={errors.endDate?.message}
          {...register('endDate')}
        />
      </div>

      <div>
        <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
          Days of week
        </span>
        <Controller
          control={control}
          name="days"
          render={({ field }) => {
            const value = new Set(field.value ?? []);
            return (
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const active = value.has(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => {
                        const next = new Set(value);
                        if (active) next.delete(day);
                        else next.add(day);
                        field.onChange(Array.from(next));
                      }}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium border transition ${
                        active
                          ? 'bg-brand-600 border-brand-600 text-white'
                          : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            );
          }}
        />
        {errors.days && (
          <span className="mt-1 block text-xs text-red-600">{errors.days.message}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Start time"
          type="time"
          error={errors.startTime?.message}
          {...register('startTime')}
        />
        <Input
          label="Default duration (min)"
          type="number"
          min={5}
          max={600}
          step={5}
          error={errors.defaultDurationMin?.message}
          {...register('defaultDurationMin')}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Input
          label="Price"
          type="number"
          min={0}
          step="0.01"
          error={errors.priceAmount?.message}
          {...register('priceAmount')}
        />
        <Select
          label="Currency"
          className="min-w-[6rem]"
          error={errors.priceCurrency?.message}
          {...register('priceCurrency')}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Notes"
        placeholder="Optional"
        error={errors.notes?.message}
        {...register('notes')}
      />

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={disabled}>
          Cancel
        </Button>
        <Button type="submit" disabled={disabled}>
          {initial ? 'Save changes' : 'Create course'}
        </Button>
      </div>
    </form>
  );
}
