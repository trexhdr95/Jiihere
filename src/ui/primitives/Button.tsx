import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white',
  secondary:
    'bg-slate-200 hover:bg-slate-300 text-slate-900',
  ghost:
    'bg-transparent hover:bg-slate-100 text-slate-700',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

// `min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0` keeps mobile taps reliable
// (Apple HIG / WCAG 2.5.5 AAA target) without bloating desktop density. Was
// 28-36 px on mobile for inline row buttons — fat-finger territory next to
// 12-row tables. Short-label buttons like "Edit" need the min-w too.
const SIZES: Record<Size, string> = {
  sm: 'text-xs px-2.5 py-1.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0',
  md: 'text-sm px-3 py-2 min-h-[44px] md:min-h-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}
