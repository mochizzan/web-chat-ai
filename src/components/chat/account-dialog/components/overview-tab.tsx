import { useState, useMemo } from 'react';
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Zap,
  ArrowDown,
  ArrowUp,
  DollarSign,
  Hash,
  Calendar,
  Activity,
  BarChart3,
  ChevronDown,
  ChevronUp,
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FilterBadges, type FilterPeriod } from '../../filter-badges';
import type { UsageLogEntry, CreditLogEntry } from '@/lib/store';
import type { ChartView, TimelineEntry, TokenChartData, PerModelAreaChartData, ModelData } from '../types';
import {
  formatCurrency,
  formatCurrencyShort,
  formatCompact,
  formatDate,
  formatFullTime,
  formatNumber,
} from '../utils';
import {
  MODEL_INPUT_COLORS,
  MODEL_OUTPUT_COLORS,
  PROVIDER_COLORS,
  PROVIDER_BAR_COLORS,
} from '../constants';
import { LogItem } from './log-item';
import { CreditLogItem } from './credit-log-item';
import type { SourceFilter } from '../hooks/use-account-data';

interface OverviewTabProps {
  credit: number | null;
  leftFilter: FilterPeriod;
  onFilterChange: (filter: FilterPeriod) => void;
  rightFilter: FilterPeriod;
  onRightFilterChange: (filter: FilterPeriod) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (filter: SourceFilter) => void;
  chartView: ChartView;
  onChartViewChange: (view: ChartView) => void;
  // data props
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgCostPerMsg: number;
  creditPercent: number;
  modelBreakdown: Array<[string, ModelData]>;
  tokenChartData: TokenChartData[];
  perModelAreaChartData: PerModelAreaChartData;
  rightMergedTimeline: TimelineEntry[];
  onReset: () => void;
  onExpandedLogChange: (id: string | null) => void;
  expandedLog: string | null;
  mounted: boolean;
}

const SOURCE_TABS: { value: SourceFilter; label: string; icon: string }[] = [
  { value: 'all', label: 'Semua', icon: '📋' },
  { value: 'chat', label: 'Chat', icon: '💬' },
  { value: 'api', label: 'API', icon: '🔑' },
];

export function OverviewTab({
  credit,
  leftFilter,
  onFilterChange,
  rightFilter,
  onRightFilterChange,
  sourceFilter,
  onSourceFilterChange,
  chartView,
  onChartViewChange,
  totalCost,
  totalInputTokens,
  totalOutputTokens,
  avgCostPerMsg,
  creditPercent,
  modelBreakdown,
  tokenChartData,
  perModelAreaChartData,
  rightMergedTimeline,
  onReset,
  onExpandedLogChange,
  expandedLog,
  mounted,
}: OverviewTabProps) {
  return (
    <div className="flex-1 overflow-hidden flex min-h-0">
      {/* LEFT PANEL - Credit + Stats + Chart + Breakdown */}
      <div className="flex-[3] flex flex-col border-r border-border/20 overflow-y-auto custom-scrollbar">
        {/* Left panel filter badges + Source filter */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap">
          <FilterBadges value={leftFilter} onChange={onFilterChange} />
          <div className="flex items-center gap-0.5 ml-auto bg-muted/20 rounded-lg p-0.5 border border-border/20">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onSourceFilterChange(tab.value)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  sourceFilter === tab.value
                    ? 'bg-background text-foreground shadow-sm border border-border/30'
                    : 'text-muted-foreground/60 hover:text-foreground/80'
                }`}
              >
                <span className="text-[11px]" aria-hidden="true">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
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
                onClick={onReset}
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Reset
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold tracking-tight text-foreground font-mono" suppressHydrationWarning>
                ${mounted ? Number(credit ?? 0).toFixed(8) : '0.00000000'}
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
              <p className="text-xs font-bold text-foreground">{modelBreakdown.length > 0 ? modelBreakdown.reduce((sum, [, data]) => sum + data.count, 0) : 0}</p>
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
                      onClick={() => onChartViewChange('progress')}
                      className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold transition-all ${
                        chartView === 'progress'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Progress
                    </button>
                    <button
                      onClick={() => onChartViewChange('area')}
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
          <FilterBadges value={rightFilter} onChange={onRightFilterChange} />
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
                  ? <LogItem 
                      key={entry.data.id} 
                      log={entry.data} 
                      isExpanded={expandedLog === entry.data.id}
                      onToggle={() => onExpandedLogChange(expandedLog === entry.data.id ? null : entry.data.id)}
                    />
                  : <CreditLogItem key={entry.data.id} log={entry.data} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}