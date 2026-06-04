import { useMemo } from 'react';
import type { UsageLogEntry, UsageLogSource, CreditLogEntry } from '@/lib/store';
import type { FilterPeriod } from '../../filter-badges';
import type { TimelineEntry, TokenChartData, PerModelAreaChartData, ModelData } from '../types';
import { filterLogsByPeriod, filterCreditLogsByPeriod } from '../utils';

export type SourceFilter = 'all' | UsageLogSource;

export interface UseAccountDataResult {
  leftFilteredLogs: UsageLogEntry[];
  rightFilteredCreditLogs: CreditLogEntry[];
  rightMergedTimeline: TimelineEntry[];
  modelBreakdown: Array<[string, ModelData]>;
  tokenChartData: TokenChartData[];
  perModelAreaChartData: PerModelAreaChartData;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
}

function filterLogsBySource(logs: UsageLogEntry[], sourceFilter: SourceFilter): UsageLogEntry[] {
  if (sourceFilter === 'all') return logs;
  return logs.filter((l) => l.source === sourceFilter);
}

export function useAccountData(
  usageLogs: UsageLogEntry[],
  creditLogs: CreditLogEntry[],
  leftFilter: FilterPeriod,
  rightFilter: FilterPeriod,
  sourceFilter: SourceFilter = 'all'
): UseAccountDataResult {
  // Filtered logs by period
  const periodFiltered = useMemo(
    () => filterLogsByPeriod(usageLogs, leftFilter),
    [usageLogs, leftFilter]
  );

  // Apply source filter on top of period filter for LEFT panel
  const leftFilteredLogs = useMemo(
    () => filterLogsBySource(periodFiltered, sourceFilter),
    [periodFiltered, sourceFilter]
  );

  // Filtered credit logs for RIGHT panel — topup & bonus (bukan duplikat usage AI)
  const rightFilteredCreditLogs = useMemo(
    () => filterCreditLogsByPeriod(creditLogs, rightFilter).filter((l) => l.type === 'topup' || l.type === 'bonus'),
    [creditLogs, rightFilter]
  );

  const rightFilteredLogs = useMemo(() => {
    const periodFiltered = filterLogsByPeriod(usageLogs, rightFilter);
    return filterLogsBySource(periodFiltered, sourceFilter);
  }, [usageLogs, rightFilter, sourceFilter]);

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

  // Model usage breakdown (left panel)
  const modelBreakdown = useMemo(() => {
    const map: Record<string, ModelData> = {};
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
    if (leftFilteredLogs.length === 0 || modelBreakdown.length === 0) {
      return { data: [], models: [] as { name: string; provider: string; key: string }[] };
    }

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

  // Total stats
  const totalInputTokens = useMemo(
    () => leftFilteredLogs.reduce((sum, log) => sum + (log.inputTokens ?? 0), 0),
    [leftFilteredLogs]
  );
  const totalOutputTokens = useMemo(
    () => leftFilteredLogs.reduce((sum, log) => sum + (log.outputTokens ?? 0), 0),
    [leftFilteredLogs]
  );
  const totalCost = useMemo(
    () => leftFilteredLogs.reduce((sum, log) => sum + (log.totalCost ?? 0), 0),
    [leftFilteredLogs]
  );

  return {
    leftFilteredLogs,
    rightFilteredCreditLogs,
    rightFilteredLogs,
    rightMergedTimeline,
    modelBreakdown,
    tokenChartData,
    perModelAreaChartData,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
  };
}