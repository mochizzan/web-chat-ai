export function formatCurrency8(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  if (isNaN(num)) return '$0.00000000';
  return `$${num.toFixed(8)}`;
}

// HAPUS formatCompact — tidak dipakai