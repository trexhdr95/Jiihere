import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

// text-base (16px) on mobile prevents iOS Safari from auto-zooming when a
// field is tapped; md:text-sm keeps desktop density tight.
const fieldBase =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base md:text-sm shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, error, hint, className = '', id, ...rest }, ref) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedById = error || hint ? `${fieldId}-desc` : undefined;
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </span>
      <input
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        {...rest}
        className={`${fieldBase} ${className}`}
      />
      {error ? (
        <span id={describedById} className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span id={describedById} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select(
  { label, error, hint, className = '', id, children, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedById = error || hint ? `${fieldId}-desc` : undefined;
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </span>
      <select
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        {...rest}
        className={`${fieldBase} ${className}`}
      >
        {children}
      </select>
      {error ? (
        <span id={describedById} className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span id={describedById} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea(
  { label, error, hint, className = '', id, rows = 3, ...rest },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedById = error || hint ? `${fieldId}-desc` : undefined;
  return (
    <label className="block" htmlFor={fieldId}>
      <span className="block text-xs font-medium text-slate-700 mb-1">
        {label}
      </span>
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedById}
        {...rest}
        className={`${fieldBase} resize-y ${className}`}
      />
      {error ? (
        <span id={describedById} className="mt-1 block text-xs text-red-600">
          {error}
        </span>
      ) : hint ? (
        <span id={describedById} className="mt-1 block text-xs text-slate-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
});
