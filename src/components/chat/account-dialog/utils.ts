import type { FilterPeriod } from '../filter-badges';
import type { UsageLogEntry, CreditLogEntry } from '@/lib/store';

// Format currency - always show 8 decimal places for precision
export function formatCurrency(amount: number | string | undefined | null): string {
  const safe = Number(amount ?? 0);
  if (isNaN(safe)) return '$0.00000000';
  return `$${safe.toFixed(8)}`;
}

// Short currency for compact displays (8 decimals)
export function formatCurrencyShort(amount: number | string | undefined | null): string {
  const safe = Number(amount ?? 0);
  if (isNaN(safe)) return '$0.00000000';
  return `$${safe.toFixed(8)}`;
}

// Format Rupiah
export function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Format number with commas - safe against undefined/null
export function formatNumber(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString();
}

// Format number with K/M suffix
export function formatCompact(n: number | undefined | null): string {
  const safe = n ?? 0;
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(1)}M`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(1)}K`;
  return `${safe}`;
}

// Format date for display - safe against hydration
export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  try {
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    if (hours < 24) return `${hours} jam lalu`;
    if (days < 7) return `${days} hari lalu`;

    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}

export function formatFullTime(iso: string | undefined | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  try {
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '-';
  }
}

// Compute cutoff date from filter period
export function getCutoff(period: FilterPeriod): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  switch (period) {
    case '24h':
      return new Date(now.getTime() - 24 * 3600000);
    case '7d':
      return new Date(now.getTime() - 7 * 86400000);
    case '30d':
      return new Date(now.getTime() - 30 * 86400000);
    case '1y':
      return new Date(now.getTime() - 365 * 86400000);
    default:
      return null;
  }
}

// Filter logs by period
export function filterLogsByPeriod(logs: UsageLogEntry[], period: FilterPeriod): UsageLogEntry[] {
  const cutoff = getCutoff(period);
  if (!cutoff) return logs;
  return logs.filter((log) => {
    if (!log.createdAt) return false;
    return new Date(log.createdAt) >= cutoff;
  });
}

// Filter credit logs by period
export function filterCreditLogsByPeriod(logs: CreditLogEntry[], period: FilterPeriod): CreditLogEntry[] {
  const cutoff = getCutoff(period);
  if (!cutoff) return logs;
  return logs.filter((log) => {
    if (!log.createdAt) return false;
    return new Date(log.createdAt) >= cutoff;
  });
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}