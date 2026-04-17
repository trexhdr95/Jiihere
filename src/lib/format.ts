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
