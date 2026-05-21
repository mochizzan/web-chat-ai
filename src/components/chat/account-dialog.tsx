'use client';

import { useCallback, useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  Cpu,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Zap,
  BarChart3,
  Calendar,
  Hash,
  ArrowDown,
  ArrowUp,
  Activity,
  Clock,
  LogIn,
  CreditCard,
  Sparkles,
  Package,
  Shield,
  PlusCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useChatStore, type UsageLogEntry, type CreditLogEntry } from '@/lib/store';
import { useMounted } from '@/hooks/use-mounted';
import { useToast } from '@/hooks/use-toast';

import { FilterBadges, type FilterPeriod } from './filter-badges';

// Chart view toggle type
type ChartView = 'progress' | 'area';

// Chart colors for models (cycle through these)
const MODEL_INPUT_COLORS = [
  { stroke: '#5a8a7a', fillId: 'modelInGrad0' },
  { stroke: '#4a7a9a', fillId: 'modelInGrad1' },
  { stroke: '#7a6aaa', fillId: 'modelInGrad2' },
  { stroke: '#b07a5a', fillId: 'modelInGrad3' },
  { stroke: '#b06070', fillId: 'modelInGrad4' },
  { stroke: '#5a8a9a', fillId: 'modelInGrad5' },
  { stroke: '#6a6aaa', fillId: 'modelInGrad6' },
  { stroke: '#9a8a4a', fillId: 'modelInGrad7' },
];

const MODEL_OUTPUT_COLORS = [
  { stroke: '#9a7a4a', fillId: 'modelOutGrad0' },
  { stroke: '#4a8a9a', fillId: 'modelOutGrad1' },
  { stroke: '#8a7aaa', fillId: 'modelOutGrad2' },
  { stroke: '#b08a5a', fillId: 'modelOutGrad3' },
  { stroke: '#b07a8a', fillId: 'modelOutGrad4' },
  { stroke: '#5a9aaa', fillId: 'modelOutGrad5' },
  { stroke: '#7a7aaa', fillId: 'modelOutGrad6' },
  { stroke: '#aa9a5a', fillId: 'modelOutGrad7' },
];

// Topup packages
const TOPUP_PACKAGES = [
  { kredit: 1, price: 12000 },
  { kredit: 5, price: 60000 },
  { kredit: 10, price: 120000 },
  { kredit: 25, price: 300000 },
  { kredit: 50, price: 600000 },
];

// Format currency - always show 8 decimal places for precision
function formatCurrency(amount: number | undefined | null): string {
  const safe = amount ?? 0;
  return `$${safe.toFixed(8)}`;
}

// Short currency for compact displays (8 decimals)
function formatCurrencyShort(amount: number | undefined | null): string {
  const safe = amount ?? 0;
  return `$${safe.toFixed(8)}`;
}

// Format Rupiah
function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Format number with commas - safe against undefined/null
function formatNumber(n: number | undefined | null): string {
  return (n ?? 0).toLocaleString();
}

// Format number with K/M suffix
function formatCompact(n: number | undefined | null): string {
  const safe = n ?? 0;
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(1)}M`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(1)}K`;
  return `${safe}`;
}

// Format date for display - safe against hydration
function formatDate(iso: string | undefined | null): string {
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

function formatFullTime(iso: string | undefined | null): string {
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
function getCutoff(period: FilterPeriod): Date | null {
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
function filterLogsByPeriod(logs: UsageLogEntry[], period: FilterPeriod): UsageLogEntry[] {
  const cutoff = getCutoff(period);
  if (!cutoff) return logs;
  return logs.filter((log) => {
    if (!log.createdAt) return false;
    return new Date(log.createdAt) >= cutoff;
  });
}

// Filter credit logs by period
function filterCreditLogsByPeriod(logs: CreditLogEntry[], period: FilterPeriod): CreditLogEntry[] {
  const cutoff = getCutoff(period);
  if (!cutoff) return logs;
  return logs.filter((log) => {
    if (!log.createdAt) return false;
    return new Date(log.createdAt) >= cutoff;
  });
}

// Timeline entry type for merged right panel
type TimelineEntry = { kind: 'usage'; data: UsageLogEntry } | { kind: 'credit'; data: CreditLogEntry };

// Provider colors
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-primary/8 text-primary/8 dark:text-primary/70',
  Anthropic: 'bg-stone-600/8 text-stone-600/80 dark:text-stone-400/60',
  Google: 'bg-sky-600/8 text-sky-700/80 dark:text-sky-400/60',
  DeepSeek: 'bg-violet-600/8 text-violet-700/80 dark:text-violet-400/60',
  Meta: 'bg-orange-600/8 text-orange-700/80 dark:text-orange-400/60',
  xAI: 'bg-rose-600/8 text-rose-700/80 dark:text-rose-400/60',
  Mistral: 'bg-cyan-600/8 text-cyan-700/80 dark:text-cyan-400/60',
};

// Chart bar colors for providers - full opacity for visibility
const PROVIDER_BAR_COLORS: Record<string, string> = {
  OpenAI: 'bg-primary/50',
  Anthropic: 'bg-stone-500',
  Google: 'bg-sky-500',
  DeepSeek: 'bg-violet-500',
  Meta: 'bg-orange-500',
  xAI: 'bg-rose-500',
  Mistral: 'bg-cyan-500',
};

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

export function AccountDialog() {
  const router = useRouter();
  const mounted = useMounted();
  const { toast } = useToast();

  const {
    accountDialogOpen,
    setAccountDialogOpen,
    credit,
    usageLogs,
    creditLogs,
    resetAccount,
    user,
    isLoggedIn,
    setCredit,
    accountTab,
    setAccountTab,
    setUsageLogs,
  } = useChatStore();

  // Filter states
  const [leftFilter, setLeftFilter] = useState<FilterPeriod>('all');
  const [rightFilter, setRightFilter] = useState<FilterPeriod>('all');
  const [chartView, setChartView] = useState<ChartView>('area');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  // Filtered logs for LEFT panel
  const leftFilteredLogs = useMemo(
    () => filterLogsByPeriod(usageLogs, leftFilter),
    [usageLogs, leftFilter]
  );

  // Filtered credit logs for RIGHT panel — hanya topup (bukan duplikat usage AI)
  const rightFilteredCreditLogs = useMemo(
    () => filterCreditLogsByPeriod(creditLogs, rightFilter).filter((log) => log.type === 'topup'),
    [creditLogs, rightFilter]
  );

  const rightFilteredLogs = useMemo(
    () => filterLogsByPeriod(usageLogs, rightFilter),
    [usageLogs, rightFilter]
  );

  // Merged timeline: AI usage + TopUp only (no duplicate "Penggunaan AI" credit logs)
  const rightMergedTimeline = useMemo(() => {
    const usageEntries: TimelineEntry[] = rightFilteredLogs.map((log) => ({ kind: 'usage' as const, data: log }));
    const creditEntries: TimelineEntry[] = rightFilteredCreditLogs.map((log) => ({ kind: 'credit' as const, data: log }));
    return [...usageEntries, ...creditEntries].sort((a, b) => {
      const da = new Date(a.data.createdAt).getTime();
      const db = new Date(b.data.createdAt).getTime();
      return db - da; // descending
    });
  }, [rightFilteredLogs, rightFilteredCreditLogs]);

  // Determine effective topup amount
  const effectiveTopupAmount = selectedPackage ?? (customAmount ? parseInt(customAmount, 10) : 0);

  // Total stats
  const totalInputTokens = leftFilteredLogs.reduce((sum, log) => sum + (log.inputTokens ?? 0), 0);
  const totalOutputTokens = leftFilteredLogs.reduce((sum, log) => sum + (log.outputTokens ?? 0), 0);
  const totalCost = leftFilteredLogs.reduce((sum, log) => sum + (log.totalCost ?? 0), 0);
  const avgCostPerMsg = leftFilteredLogs.length > 0 ? totalCost / leftFilteredLogs.length : 0;
  const creditPercent = 0;

  // Model usage breakdown (left panel)
  const modelBreakdown = useMemo(() => {
    const map: Record<string, { count: number; cost: number; tokens: number; inputTokens: number; outputTokens: number; provider: string }> = {};
    leftFilteredLogs.forEach((log) => {
      const name = log.modelName || 'Unknown';
      if (!map[name]) map[name] = { count: 0, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0, provider: log.provider || '' };
      map[name].count++;
      map[name].cost += log.totalCost ?? 0;
      map[name].inputTokens += log.inputTokens ?? 0;
      map[name].outputTokens += log.outputTokens ?? 0;
      map[name].tokens += (log.inputTokens ?? 0) + (log.outputTokens ?? 0);
    });
    return Object.entries(map)
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 8);
  }, [leftFilteredLogs]);

  // Token distribution for chart (input vs output per model)
  const tokenChartData = useMemo(() => {
    return modelBreakdown.map(([name, data]) => ({
      name,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      provider: data.provider,
    }));
  }, [modelBreakdown]);

  // Per-model area chart data: input/output per model over time
  const perModelAreaChartData = useMemo(() => {
    if (leftFilteredLogs.length === 0 || modelBreakdown.length === 0) return { data: [], models: [] as { name: string; provider: string; key: string }[] };

    // Get top models (up to 6 for readability)
    // Use sanitized keys (no spaces/special chars) for recharts dataKey compatibility
    const topModels = modelBreakdown.slice(0, 6).map(([name, data]) => ({
      name,
      provider: data.provider,
      key: name.replace(/[^a-zA-Z0-9]/g, '_'),
    }));

    // Sort logs by createdAt ascending, filtering out those without timestamps
    const sorted = leftFilteredLogs
      .filter((log) => log.createdAt)
      .sort((a, b) => {
        const da = new Date(a.createdAt!).getTime();
        const db = new Date(b.createdAt!).getTime();
        return da - db;
      });

    if (sorted.length === 0) return { data: [], models: topModels };

    // Determine bucket size based on span
    const first = new Date(sorted[0].createdAt!).getTime();
    const last = new Date(sorted[sorted.length - 1].createdAt!).getTime();
    const spanMs = last - first;
    const spanHours = spanMs / 3600000;

    let bucketMs: number;
    let fmtFn: (d: Date) => string;
    if (spanHours < 2) {
      bucketMs = 5 * 60000;
      fmtFn = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } else if (spanHours < 48) {
      bucketMs = 3600000;
      fmtFn = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } else if (spanHours < 24 * 30) {
      bucketMs = 86400000;
      fmtFn = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } else {
      bucketMs = 7 * 86400000;
      fmtFn = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }

    // Build a model name -> sanitized key lookup
    const modelKeyMap: Record<string, string> = {};
    topModels.forEach((m) => { modelKeyMap[m.name] = m.key; });

    // Group into buckets with per-model input/output
    const buckets: Record<string, Record<string, number | string>> = {};
    sorted.forEach((log) => {
      if (!log.createdAt) return;
      const modelName = log.modelName || 'Unknown';
      const modelKey = modelKeyMap[modelName];
      // Only track top models
      if (!modelKey) return;

      const t = new Date(log.createdAt).getTime();
      const bucketStart = Math.floor(t / bucketMs) * bucketMs;
      const bKey = String(bucketStart);
      if (!buckets[bKey]) {
        const bucket: Record<string, number | string> = { time: bucketStart };
        topModels.forEach((m) => {
          bucket[`${m.key}_in`] = 0;
          bucket[`${m.key}_out`] = 0;
        });
        buckets[bKey] = bucket;
      }
      buckets[bKey][`${modelKey}_in`] = (buckets[bKey][`${modelKey}_in`] as number) + (log.inputTokens ?? 0);
      buckets[bKey][`${modelKey}_out`] = (buckets[bKey][`${modelKey}_out`] as number) + (log.outputTokens ?? 0);
    });

    const data = Object.values(buckets)
      .sort((a, b) => (a.time as number) - (b.time as number))
      .map((b) => {
        const result: Record<string, number | string> = { label: fmtFn(new Date(b.time as number)) };
        topModels.forEach((m) => {
          result[`${m.key}_in`] = b[`${m.key}_in`] ?? 0;
          result[`${m.key}_out`] = b[`${m.key}_out`] ?? 0;
        });
        return result;
      });

    return { data, models: topModels };
  }, [leftFilteredLogs, modelBreakdown]);

  // Reset account handler — purely client-side now
  const handleReset = useCallback(() => {
    resetAccount();
    toast({ title: 'Reset Berhasil', description: 'Kredit dan riwayat penggunaan telah direset' });
  }, [resetAccount, toast]);

  const handleGoToLogin = useCallback(() => {
    setAccountDialogOpen(false);
    router.push('/login');
  }, [setAccountDialogOpen, router]);

  // [FIX B7] Topup handler — panggil POST /api/topup
  const handleTopup = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) return;
    setTopupLoading(true);
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: `Top up ${amount} kredit` }),
      });
      const data = await res.json();
      console.log('[DEBUG:B7] Topup response status=%d amount=%s', res.status, amount);
      if (res.ok) {
        setCredit(data.credit);
        console.log('[DEBUG:B7] Topup success, new credit=%s', data.credit);
        toast({ title: 'Berhasil', description: `${amount} kredit ditambahkan ke akun Anda` });
        setSelectedPackage(null);
        setCustomAmount('');
      } else {
        console.warn('[DEBUG:B7] Topup failed: %s', data.error);
        toast({ title: 'Gagal', description: data.error || 'Topup gagal', variant: 'destructive' });
      }
    } catch (error) {
      console.error('[DEBUG:B7] Topup network error:', error);
      toast({ title: 'Error', description: 'Koneksi server terputus', variant: 'destructive' });
    } finally {
      setTopupLoading(false);
    }
  }, [setCredit, toast]);


  const renderLogItem = (log: UsageLogEntry) => {
    const isExpanded = expandedLog === log.id;
    const logTotalCost = log.totalCost ?? 0;
    return (
      <div
        key={log.id}
        className="group rounded-xl border border-border/20 bg-card/40 hover:border-primary/10 transition-all"
      >
        <button
          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
          className="w-full flex items-center gap-3 p-3.5 text-left"
        >
          {/* Model icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/30 shrink-0">
            <Cpu className="h-4 w-4 text-primary/60" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-foreground truncate">
                {log.modelName || 'Unknown'}
              </span>
              <Badge
                variant="secondary"
                className={`text-[9px] px-1 py-0 shrink-0 ${PROVIDER_COLORS[log.provider] || ''}`}
              >
                {log.provider || '?'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[11px] text-muted-foreground/60">
                  {formatFullTime(log.createdAt)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground/60">
                {formatCompact((log.inputTokens ?? 0) + (log.outputTokens ?? 0))} tok
              </span>
            </div>
          </div>

          {/* Cost */}
          <div className="text-right shrink-0">
            <p className={`text-xs font-bold font-mono ${logTotalCost > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              -{formatCurrencyShort(logTotalCost)}
            </p>
          </div>

          {/* Expand chevron */}
          <div className="shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
            )}
          </div>
        </button>

        {/* Expanded detail */}
        {isExpanded && (
          <div className="px-3.5 pb-3.5 pt-0">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/15 p-3 border border-border/10">
              <div className="flex items-center gap-2">
                <ArrowDown className="h-3.5 w-3.5 text-primary/50 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Input</p>
                  <p className="text-xs font-semibold text-foreground">{formatNumber(log.inputTokens)} <span className="text-muted-foreground/40 font-normal">tok</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ArrowUp className="h-3.5 w-3.5 text-amber-500/50 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Output</p>
                  <p className="text-xs font-semibold text-foreground">{formatNumber(log.outputTokens)} <span className="text-muted-foreground/40 font-normal">tok</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Input Cost</p>
                  <p className="text-xs font-semibold text-foreground font-mono">{formatCurrencyShort(log.inputCost)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Output Cost</p>
                  <p className="text-xs font-semibold text-foreground font-mono">{formatCurrencyShort(log.outputCost)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Kategori</p>
                  <p className="text-xs font-semibold text-foreground capitalize">{log.category || '-'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground/50">Waktu</p>
                  <p className="text-xs font-semibold text-foreground">{formatDate(log.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCreditLogItem = (log: CreditLogEntry) => {
    return (
      <div
        key={log.id}
        className="group rounded-xl border border-border/20 bg-card/40 hover:border-primary/10 transition-all"
      >
        <div className="w-full flex items-center gap-3 p-3.5">
          {/* Icon */}
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
            <PlusCircle className="h-4 w-4 text-emerald-500/80" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400/80">
                Top Up Kredit
              </span>
              <span className="inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0 text-[9px] font-bold text-emerald-600 dark:text-emerald-400/70">
                +{log.amount}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[11px] text-muted-foreground/60">
                  {formatFullTime(log.createdAt)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/30">·</span>
              <span className="text-[11px] text-muted-foreground/60">
                Sisa saldo: <span className="font-mono text-foreground/70">{formatCurrencyShort(log.balance)}</span>
              </span>
            </div>
          </div>

          {/* Amount */}
          <div className="text-right shrink-0">
            <p className="text-xs font-bold font-mono text-emerald-600/80 dark:text-emerald-400/70">
              {log.description || 'Top Up'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
      <DialogContent className="sm:max-w-[1050px] lg:max-w-[1320px] p-0 gap-0 overflow-hidden max-h-[92vh] flex flex-col rounded-xl border border-border/40">
        {/* Compact Header: Title + Profile in one row */}
        <div className="px-5 pr-10 pt-4 pb-2 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Wallet className="h-4 w-4 text-primary/70" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Akun & Penggunaan
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground/60 mt-0">
                Kelola kredit & pantau penggunaan
              </DialogDescription>
            </div>
          </div>

          {/* Profile inline - right side with visible card */}
          {isLoggedIn && user ? (
            <div className="flex items-center gap-2 ml-auto pl-3 border-l border-border/20 rounded-lg bg-muted/20 border border-border/15 px-3 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary/70 font-bold text-[10px] shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-semibold text-foreground truncate max-w-[120px]">{user.name}</p>
                  {user.role === 'admin' ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0 text-[8px] font-bold uppercase tracking-wider text-primary/80 shrink-0">
                      <Shield className="h-2 w-2" />
                      Admin
                    </span>
                  ) : null}
                </div>
                <p className="text-[10px] text-muted-foreground/50 truncate max-w-[140px]">{user.email}</p>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-[11px] ml-auto rounded-lg px-3"
              onClick={handleGoToLogin}
            >
              <LogIn className="h-3 w-3" />
              Masuk
            </Button>
          )}
        </div>

        {/* Tab system - Overview | Top Up */}
        <div className="px-6 pb-0">
          <div className="flex items-center gap-1 border-b border-border/20">
            <button
              onClick={() => setAccountTab('overview')}
              className={`px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                accountTab === 'overview'
                  ? 'border-primary/60 text-primary/70'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/30'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" />
                Overview
              </span>
            </button>
            <button
              onClick={() => setAccountTab('topup')}
              className={`px-4 py-2.5 text-xs font-semibold transition-all border-b-2 -mb-px ${
                accountTab === 'topup'
                  ? 'border-primary/60 text-primary/70'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/40'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                Top Up
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {accountTab === 'topup' ? (
          /* ===== TOP UP TAB ===== */
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 min-h-[420px]">
            {/* Current balance */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
                  Saldo Saat Ini
                </p>
                <p className="text-2xl font-bold text-foreground font-mono" suppressHydrationWarning>
                  ${mounted ? (credit ?? 0).toFixed(8) : '0.00000000'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground/50">Harga per kredit</p>
                <p className="text-sm font-bold text-foreground">1 Kredit = Rp 12.000</p>
              </div>
            </div>

            <Separator className="mb-5" />

            {/* Package grid */}
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
              <Package className="h-3.5 w-3.5 inline mr-1.5" />
              Pilih Paket
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
              {TOPUP_PACKAGES.map((pkg) => {
                const isSelected = selectedPackage === pkg.kredit;
                return (
                  <button
                    key={pkg.kredit}
                    onClick={() => {
                      setSelectedPackage(isSelected ? null : pkg.kredit);
                      setCustomAmount('');
                    }}
                    className={`rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
                      isSelected
                        ? 'border-primary bg-primary/8 shadow-sm ring-1 ring-primary/20'
                        : 'border-border/25 bg-card/40 hover:border-primary/30 hover:bg-primary/3'
                    }`}
                  >
                    <div className="flex items-center justify-center mb-2">
                      <Sparkles className={`h-5 w-5 ${isSelected ? 'text-primary/70' : 'text-muted-foreground/30'}`} />
                    </div>
                    <p className={`text-lg font-bold ${isSelected ? 'text-primary/80' : 'text-foreground'}`}>
                      {pkg.kredit}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mb-1">Kredit</p>
                    <p className="text-[11px] font-semibold text-muted-foreground/80">
                      {formatRupiah(pkg.price)}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Custom amount */}
            <div className="rounded-xl border border-border/25 bg-muted/5 p-4 mb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2.5">
                Jumlah Custom
              </p>
              <div className="flex items-center gap-2.5">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Masukkan jumlah kredit"
                    value={customAmount}
                    onChange={(e) => {
                      setCustomAmount(e.target.value);
                      setSelectedPackage(null);
                    }}
                    className="h-9 text-sm pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 font-medium">
                    kredit
                  </span>
                </div>
                {customAmount && parseInt(customAmount, 10) > 0 && (
                  <span className="text-xs text-muted-foreground/60 shrink-0">
                    = {formatRupiah(parseInt(customAmount, 10) * 12000)}
                  </span>
                )}
              </div>
            </div>

            {/* Purchase summary */}
            {effectiveTopupAmount > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Pembelian</span>
                  <span className="text-sm font-bold text-foreground">{effectiveTopupAmount} Kredit</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Total Harga</span>
                  <span className="text-sm font-bold text-foreground">{formatRupiah(effectiveTopupAmount * 12000)}</span>
                </div>
                <Button
                  className="w-full h-10 gap-2 text-sm font-bold"
                  onClick={() => handleTopup(effectiveTopupAmount)}
                  disabled={topupLoading}
                >
                  <CreditCard className="h-4 w-4" />
                  {topupLoading ? 'Memproses...' : 'Beli Sekarang'}
                </Button>
              </div>
            )}

            {/* Info note */}
          </div>
        ) : (
          /* ===== OVERVIEW TAB ===== */
          /* Main content - 2 column: left (stats+chart) | right (history) */
          <div className="flex-1 overflow-hidden flex min-h-[520px]">
            {/* LEFT PANEL - Credit + Stats + Chart + Breakdown */}
            <div className="flex-[3] flex flex-col border-r border-border/20 overflow-y-auto custom-scrollbar">
              {/* Left panel filter badges */}
              <div className="px-5 pt-4 pb-2">
                <FilterBadges value={leftFilter} onChange={setLeftFilter} />
              </div>

              {/* Credit Card - compact */}
              <div className="px-5 pb-3">
                <div className="rounded-lg border border-border/25 bg-gradient-to-br from-primary/6 via-primary/3 to-transparent p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Wallet className="h-3 w-3 text-primary/70" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                        Saldo Kredit
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-1.5"
                      onClick={handleReset}
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Reset
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold tracking-tight text-foreground font-mono" suppressHydrationWarning>
                      ${mounted ? (credit ?? 0).toFixed(8) : '0.00000000'}
                    </p>
                    <div className="flex-1 min-w-0">
                      <Progress value={creditPercent} className="h-1" />
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-muted-foreground/50" suppressHydrationWarning>
                          {mounted ? creditPercent.toFixed(1) : '100.0'}% tersisa
                        </span>
                        <span className="text-[9px] text-muted-foreground/40">Saldo Kredit</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid - 2x2 compact */}
              <div className="px-5 pb-3">
                <div className="grid grid-cols-4 gap-1.5">
                  <div className="rounded-lg bg-muted/15 border border-border/15 p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <TrendingDown className="h-3 w-3 text-destructive/50" />
                      <span className="text-[9px] text-muted-foreground/50 font-medium">Spent</span>
                    </div>
                    <p className="text-xs font-bold text-foreground font-mono">{formatCurrencyShort(totalCost)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/15 border border-border/15 p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <Zap className="h-3 w-3 text-amber-500/50" />
                      <span className="text-[9px] text-muted-foreground/50 font-medium">Request</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{leftFilteredLogs.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/15 border border-border/15 p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <ArrowDown className="h-3 w-3 text-primary/50" />
                      <span className="text-[9px] text-muted-foreground/50 font-medium">In Tok</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{formatCompact(totalInputTokens)}</p>
                  </div>
                  <div className="rounded-lg bg-muted/15 border border-border/15 p-2">
                    <div className="flex items-center gap-1 mb-0.5">
                      <ArrowUp className="h-3 w-3 text-amber-500/50" />
                      <span className="text-[9px] text-muted-foreground/50 font-medium">Out Tok</span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{formatCompact(totalOutputTokens)}</p>
                  </div>
                </div>
              </div>

              {/* Token Usage Chart - toggle between progress and area views */}
              {tokenChartData.length > 0 && (
                <div className="px-5 pb-4">
                  <div className="rounded-xl bg-muted/10 border border-border/15 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        Distribusi Token
                      </p>
                      <div className="flex items-center gap-3">
                        {/* Chart view toggle */}
                        <div className="flex items-center rounded-md bg-muted/30 p-0.5 gap-0.5">
                          <button
                            onClick={() => setChartView('progress')}
                            className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-all ${
                              chartView === 'progress'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Progress
                          </button>
                          <button
                            onClick={() => setChartView('area')}
                            className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-all ${
                              chartView === 'area'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Area
                          </button>
                        </div>
                        {/* Legend - only for progress view */}
                        {chartView === 'progress' && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-primary/60" />
                              <span className="text-[9px] text-primary/80 dark:text-primary/70 font-medium">Input</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 rounded-full bg-amber-600/60" />
                              <span className="text-[9px] text-amber-700/80 dark:text-amber-400/70 font-medium">Output</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress view - horizontal stacked bars (fills 100% per model) */}
                    {chartView === 'progress' && (
                      <div className="space-y-3">
                        {tokenChartData.map((item) => {
                          const total = item.inputTokens + item.outputTokens;
                          const inputPct = total > 0 ? (item.inputTokens / total) * 100 : 0;
                          const outputPct = total > 0 ? (item.outputTokens / total) * 100 : 0;
                          // Ensure total is exactly 100%
                          const adjustedInput = inputPct + (100 - inputPct - outputPct);
                          return (
                            <div key={item.name}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-[11px] font-semibold text-foreground truncate max-w-[160px]">{item.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[8px] px-1 py-0 shrink-0 ${PROVIDER_COLORS[item.provider] || ''}`}
                                  >
                                    {item.provider || '?'}
                                  </Badge>
                                </div>
                                <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0 ml-2">{formatCompact(total)} tok</span>
                              </div>
                              {/* Bar - no gap, fills to 100% */}
                              <div className="flex h-4 rounded-full bg-muted/20 overflow-hidden">
                                <div
                                  className="h-full bg-primary/50 transition-all duration-700 ease-out"
                                  style={{ width: `${adjustedInput}%` }}
                                />
                                <div
                                  className="h-full bg-amber-500/60 transition-all duration-700 ease-out"
                                  style={{ width: `${outputPct}%` }}
                                />
                              </div>
                              {/* Token counts + percentages */}
                              <div className="flex items-center justify-between mt-1">
                                <div className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                                  <span className="text-[9px] text-primary/80 dark:text-primary/70 font-semibold">
                                    Input {formatCompact(item.inputTokens)} ({adjustedInput.toFixed(0)}%)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500/50" />
                                  <span className="text-[9px] text-amber-700/80 dark:text-amber-400/70 font-semibold">
                                    Output {formatCompact(item.outputTokens)} ({outputPct.toFixed(0)}%)
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Area view - recharts AreaChart with per-model input/output */}
                    {chartView === 'area' && perModelAreaChartData.data.length > 0 && (
                      <div className="w-full h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart
                            data={perModelAreaChartData.data}
                            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                          >
                            <defs>
                              {perModelAreaChartData.models.map((model, idx) => {
                                const inColor = MODEL_INPUT_COLORS[idx % MODEL_INPUT_COLORS.length];
                                const outColor = MODEL_OUTPUT_COLORS[idx % MODEL_OUTPUT_COLORS.length];
                                return [
                                  <linearGradient key={inColor.fillId} id={inColor.fillId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={inColor.stroke} stopOpacity={0.6} />
                                    <stop offset="50%" stopColor={inColor.stroke} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={inColor.stroke} stopOpacity={0.05} />
                                  </linearGradient>,
                                  <linearGradient key={outColor.fillId} id={outColor.fillId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={outColor.stroke} stopOpacity={0.6} />
                                    <stop offset="50%" stopColor={outColor.stroke} stopOpacity={0.25} />
                                    <stop offset="95%" stopColor={outColor.stroke} stopOpacity={0.05} />
                                  </linearGradient>,
                                ];
                              })}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.12)" vertical={false} />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10, fill: '#888888' }}
                              tickLine={false}
                              axisLine={{ stroke: 'rgba(120,120,120,0.15)' }}
                              interval="preserveStartEnd"
                            />
                            <YAxis
                              tick={{ fontSize: 10, fill: '#888888' }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v: number) => formatCompact(v)}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(255,255,255,0.97)',
                                border: '1px solid rgba(0,0,0,0.1)',
                                borderRadius: '12px',
                                fontSize: '12px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                padding: '12px 16px',
                              }}
                              itemStyle={{ padding: '3px 0' }}
                              labelStyle={{ color: '#1a1a1a', fontWeight: 700, marginBottom: '6px', fontSize: '12px' }}
                              formatter={(value: number, name: string) => {
                                // Find model name from key
                                const model = perModelAreaChartData.models.find((m) =>
                                  name === `${m.key}_in` || name === `${m.key}_out`
                                );
                                const type = name.endsWith('_in') ? 'Input' : 'Output';
                                return [`${formatNumber(value)} tok`, `${model?.name || name} (${type})`];
                              }}
                            />
                            {perModelAreaChartData.models.map((model, idx) => {
                              const inColor = MODEL_INPUT_COLORS[idx % MODEL_INPUT_COLORS.length];
                              const outColor = MODEL_OUTPUT_COLORS[idx % MODEL_OUTPUT_COLORS.length];
                              return [
                                <Area
                                  key={`${model.key}_in`}
                                  type="monotone"
                                  dataKey={`${model.key}_in`}
                                  stroke={inColor.stroke}
                                  strokeWidth={2}
                                  fill={`url(#${inColor.fillId})`}
                                  dot={{ r: 2.5, fill: inColor.stroke, stroke: '#ffffff', strokeWidth: 1.5 }}
                                  activeDot={{ r: 4, fill: inColor.stroke, stroke: '#ffffff', strokeWidth: 2 }}
                                />,
                                <Area
                                  key={`${model.key}_out`}
                                  type="monotone"
                                  dataKey={`${model.key}_out`}
                                  stroke={outColor.stroke}
                                  strokeWidth={2}
                                  strokeDasharray="4 2"
                                  fill={`url(#${outColor.fillId})`}
                                  dot={{ r: 2.5, fill: outColor.stroke, stroke: '#ffffff', strokeWidth: 1.5 }}
                                  activeDot={{ r: 4, fill: outColor.stroke, stroke: '#ffffff', strokeWidth: 2 }}
                                />,
                              ];
                            })}
                          </AreaChart>
                        </ResponsiveContainer>
                        {/* Per-model legend */}
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                          {perModelAreaChartData.models.map((model, idx) => {
                            const inColor = MODEL_INPUT_COLORS[idx % MODEL_INPUT_COLORS.length];
                            const outColor = MODEL_OUTPUT_COLORS[idx % MODEL_OUTPUT_COLORS.length];
                            return (
                              <div key={model.key} className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: inColor.stroke }} />
                                <span className="text-[9px] font-medium text-foreground truncate max-w-[100px]">{model.name}</span>
                                <span className="text-[8px] text-muted-foreground/40">IN</span>
                                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: outColor.stroke }} />
                                <span className="text-[8px] text-muted-foreground/40">OUT</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Empty area chart state */}
                    {chartView === 'area' && perModelAreaChartData.data.length === 0 && (
                      <div className="flex items-center justify-center h-[120px] text-[11px] text-muted-foreground/40">
                        Tidak cukup data untuk grafik area
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Credit History Chart (Riwayat Kredit) */}
              {creditLogs.length > 0 && (
                <div className="px-5 pb-4">
                  <div className="rounded-xl bg-muted/10 border border-border/15 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50">
                        Riwayat Kredit
                      </p>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-primary/60" />
                        <span className="text-[9px] text-muted-foreground/50">Saldo dari waktu ke waktu</span>
                      </div>
                    </div>
                    <div className="w-full h-[140px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={(() => {
                            // Build credit balance data over time
                            // Add initial $25 as first data point, then each credit log sorted ascending
                            const sortedLogs = [...creditLogs]
                              .filter((l) => l.createdAt)
                              .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                            if (sortedLogs.length === 0) return [];

                            // Determine time formatting based on span
                            const first = new Date(sortedLogs[0].createdAt).getTime();
                            const last = new Date(sortedLogs[sortedLogs.length - 1].createdAt).getTime();
                            const spanHours = (last - first) / 3600000;
                            let fmtFn: (d: Date) => string;
                            if (spanHours < 2) {
                              fmtFn = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                            } else if (spanHours < 48) {
                              fmtFn = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                            } else if (spanHours < 24 * 30) {
                              fmtFn = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                            } else {
                              fmtFn = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                            }

                            // Add initial $25 point before first log
                            const initialPoint = {
                              label: fmtFn(new Date(first - 1000)),
                              balance: 0,
                            };

                            const dataPoints = sortedLogs.map((log) => ({
                              label: fmtFn(new Date(log.createdAt)),
                              balance: log.balance,
                            }));

                            return [initialPoint, ...dataPoints];
                          })()}
                          margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="creditBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#059669" stopOpacity={0.5} />
                              <stop offset="50%" stopColor="#059669" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#059669" stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.12)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 9, fill: '#888888' }}
                            tickLine={false}
                            axisLine={{ stroke: 'rgba(120,120,120,0.15)' }}
                            interval="preserveStartEnd"
                          />
                          <YAxis
                            tick={{ fontSize: 9, fill: '#888888' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255,255,255,0.97)',
                              border: '1px solid rgba(0,0,0,0.1)',
                              borderRadius: '10px',
                              fontSize: '11px',
                              boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                              padding: '8px 12px',
                            }}
                            labelStyle={{ color: '#1a1a1a', fontWeight: 700, marginBottom: '4px', fontSize: '11px' }}
                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'Saldo']}
                          />
                          <Area
                            type="monotone"
                            dataKey="balance"
                            stroke="#059669"
                            strokeWidth={2}
                            fill="url(#creditBalanceGrad)"
                            dot={{ r: 2, fill: '#059669', stroke: '#ffffff', strokeWidth: 1.5 }}
                            activeDot={{ r: 3.5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* Model Cost Breakdown */}
              {modelBreakdown.length > 0 && (
                <div className="px-5 pb-4">
                  <div className="rounded-xl bg-muted/10 border border-border/15 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
                      Biaya per Model
                    </p>
                    <div className="space-y-2.5">
                      {modelBreakdown.map(([name, data]) => {
                        const maxCost = modelBreakdown[0]?.[1].cost || 1;
                        const barWidth = (data.cost / maxCost) * 100;
                        const barColor = PROVIDER_BAR_COLORS[data.provider] || 'bg-primary/50';
                        return (
                          <div key={name}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[11px] font-semibold text-foreground truncate">{name}</span>
                                <Badge variant="secondary" className={`text-[9px] px-1 py-0 shrink-0 ${PROVIDER_COLORS[data.provider] || ''}`}>
                                  {data.count}x
                                </Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono shrink-0 ml-2">
                                {formatCurrencyShort(data.cost)}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/25 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Avg cost footer */}
              <div className="px-5 pb-4 mt-auto">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/10">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-muted-foreground/40" />
                    <span className="text-[11px] text-muted-foreground/50">Rata-rata per pesan</span>
                  </div>
                  <span className="text-xs font-bold text-foreground font-mono">{formatCurrency(avgCostPerMsg)}</span>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL - History Log */}
            <div className="flex-[2] flex flex-col min-w-0 overflow-hidden">
              {/* Filter badges for right panel */}
              <div className="px-5 py-3 flex items-center gap-2 border-b border-border/15">
                <FilterBadges value={rightFilter} onChange={setRightFilter} />
                <span className="ml-auto text-[11px] text-muted-foreground/40">
                  {rightMergedTimeline.length} entri
                </span>
              </div>

              {/* Usage + Credit log list (merged timeline) */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-4 py-3 min-h-[360px]">
                {rightMergedTimeline.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/20 border border-border/15">
                      <BarChart3 className="h-7 w-7 text-muted-foreground/15" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground/60">
                      Belum ada riwayat penggunaan
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/40 max-w-[220px]">
                      Mulai chat untuk melihat log penggunaan kredit Anda
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {rightMergedTimeline.map((entry) =>
                      entry.kind === 'usage'
                        ? renderLogItem(entry.data)
                        : renderCreditLogItem(entry.data)
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
