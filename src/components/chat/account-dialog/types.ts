// Chart view type
export type ChartView = 'progress' | 'area';

// Timeline entry type for merged right panel
export type TimelineEntry = 
  | { kind: 'usage'; data: import('@/lib/store').UsageLogEntry } 
  | { kind: 'credit'; data: import('@/lib/store').CreditLogEntry };

// Model data for breakdown
export interface ModelData {
  count: number;
  cost: number;
  tokens: number;
  inputTokens: number;
  outputTokens: number;
  provider: string;
}

// Token chart data
export interface TokenChartData {
  name: string;
  inputTokens: number;
  outputTokens: number;
  provider: string;
}

// Per-model area chart data
export interface PerModelAreaChartData {
  data: Array<Record<string, number | string>>;
  models: Array<{ name: string; provider: string; key: string }>;
}