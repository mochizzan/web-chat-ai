'use client';

export type FilterPeriod = 'all' | '24h' | '7d' | '30d' | '1y';

export const FILTER_PERIODS: { value: FilterPeriod; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: '24h', label: '24 Jam' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: '1y', label: '1 Tahun' },
];

export function FilterBadges({ value, onChange }: { value: FilterPeriod; onChange: (v: FilterPeriod) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {FILTER_PERIODS.map((p) => {
        const isActive = value === p.value;
        return (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/30 text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}