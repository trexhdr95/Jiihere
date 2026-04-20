import type { Money } from '@/domain/types';

export function formatMoney(m: Money): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: m.currency,
      maximumFractionDigits: 2,
    }).format(m.amount);
  } catch {
    return `${m.amount.toFixed(2)} ${m.currency}`;
  }
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const dt = new Date();
  dt.setHours(h ?? 0, m ?? 0, 0, 0);
  return dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Compact date-range formatter for table cells where "Feb 17, 2026 to May 17,
 * 2026" would otherwise wrap to 4 lines on narrow viewports. Same year →
 * "Feb 17 → May 17, 2026"; cross-year → "Feb 17, 2025 → May 17, 2026".
 */
export function formatDateRange(startIso: string, endIso: string): string {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const start = new Date(sy, (sm ?? 1) - 1, sd ?? 1);
  const end = new Date(ey, (em ?? 1) - 1, ed ?? 1);
  const sameYear = sy === ey;
  const startStr = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endStr = end.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return `${startStr} → ${endStr}`;
}
