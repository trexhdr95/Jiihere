import { useMemo, useState } from 'react';
import type { Currency } from '@/domain/types';
import type { MonthBucket } from './revenue';
import { formatMoney } from '@/lib/format';

export interface RevenueChartProps {
  series: MonthBucket[];
  currency: Currency;
}

const PADDING = { top: 16, right: 12, bottom: 28, left: 44 };
const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 240;

function niceCeil(n: number): number {
  if (n <= 0) return 10;
  const exponent = Math.floor(Math.log10(n));
  const base = Math.pow(10, exponent);
  const leading = n / base;
  let step: number;
  if (leading <= 1) step = 1;
  else if (leading <= 2) step = 2;
  else if (leading <= 5) step = 5;
  else step = 10;
  return step * base;
}

export function RevenueChart({ series, currency }: RevenueChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const { maxY, yTicks, bars } = useMemo(() => {
    const rawMax = Math.max(0, ...series.map((b) => b.amount));
    const max = niceCeil(rawMax || 1);
    const chartW = VIEW_WIDTH - PADDING.left - PADDING.right;
    const chartH = VIEW_HEIGHT - PADDING.top - PADDING.bottom;
    const barGap = 8;
    const barWidth = series.length > 0 ? (chartW - barGap * series.length) / series.length : 0;
    const ticks = 4;
    const yTicks: { value: number; y: number }[] = [];
    for (let i = 0; i <= ticks; i += 1) {
      const value = (max / ticks) * i;
      const y = PADDING.top + chartH - (value / max) * chartH;
      yTicks.push({ value, y });
    }
    const bars = series.map((b, i) => {
      const height = max === 0 ? 0 : (b.amount / max) * chartH;
      const x = PADDING.left + i * (barWidth + barGap) + barGap / 2;
      const y = PADDING.top + chartH - height;
      return { x, y, width: barWidth, height, bucket: b };
    });
    return { maxY: max, yTicks, bars };
  }, [series]);

  if (series.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-slate-500">No revenue data yet.</div>
    );
  }

  const formatTick = (v: number) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: v >= 1000 ? 'compact' : 'standard',
    }).format(v);

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={`Monthly revenue in ${currency}`}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
      >
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={VIEW_WIDTH - PADDING.right}
              y1={t.y}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity={i === 0 ? 0.3 : 0.08}
              className="text-slate-400"
            />
            <text
              x={PADDING.left - 6}
              y={t.y}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-slate-500 text-[10px]"
            >
              {formatTick(t.value)}
            </text>
          </g>
        ))}

        {bars.map((bar, i) => {
          const active = hover === i;
          return (
            <g key={bar.bucket.key}>
              <rect
                x={bar.x}
                y={PADDING.top}
                width={bar.width}
                height={VIEW_HEIGHT - PADDING.top - PADDING.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx={3}
                className={active ? 'fill-brand-700' : 'fill-brand-500'}
                pointerEvents="none"
              />
              <text
                x={bar.x + bar.width / 2}
                y={VIEW_HEIGHT - PADDING.bottom + 14}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
                pointerEvents="none"
              >
                {bar.bucket.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && bars[hover] && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 text-white text-xs px-2 py-1 shadow-lg dark:bg-slate-100 dark:text-slate-900"
          style={{
            left: `${((bars[hover].x + bars[hover].width / 2) / VIEW_WIDTH) * 100}%`,
            top: `${(bars[hover].y / VIEW_HEIGHT) * 100}%`,
          }}
        >
          <div className="font-medium">{bars[hover].bucket.label}</div>
          <div>{formatMoney({ amount: bars[hover].bucket.amount, currency })}</div>
        </div>
      )}

      <div className="sr-only" aria-hidden={false}>
        Max: {maxY}
      </div>
    </div>
  );
}
