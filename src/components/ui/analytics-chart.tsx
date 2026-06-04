'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from 'recharts';

interface ChartDataItem {
  name: string;
  [key: string]: number | string;
}

interface AnalyticsChartProps {
  data: ChartDataItem[];
  chartType: 'bar' | 'line' | 'pie';
  xAxisKey?: string;
  yAxisKey?: string;
  labelKey?: string;
  valueKey?: string;
  color?: string;
  colors?: string[];
  height?: number;
  width?: string | number;
  showLegend?: boolean;
  showTooltip?: boolean;
  valueFormat?: 'number' | 'currency' | 'token';
}

const DEFAULT_COLORS = [
  '#10b981', // emerald
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#a855f7', // purple
];

function formatValue(value: number, format?: 'number' | 'currency' | 'token'): string {
  switch (format) {
    case 'currency':
      return `Rp ${value.toLocaleString('id-ID')}`;
    case 'token':
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toLocaleString('id-ID');
    case 'number':
    default:
      return value.toLocaleString('id-ID');
  }
}

function CustomTooltip({
  active,
  payload,
  label,
  valueFormat: format,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormat?: 'number' | 'currency' | 'token';
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {payload.map((item: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: item.color }}>
          {item.name || item.dataKey}: {formatValue(Number(item.value), format)}
        </p>
      ))}
    </div>
  );
}

export function AnalyticsChart({
  data,
  chartType,
  xAxisKey = 'name',
  yAxisKey = 'value',
  labelKey = 'name',
  valueKey = 'value',
  color = '#10b981',
  colors,
  height = 280,
  width = '100%',
  showLegend = true,
  showTooltip = true,
  valueFormat,
}: AnalyticsChartProps) {
  const resolvedColors = colors ?? [color];

  const barData = useMemo(() => {
    if (chartType === 'bar') {
      return data.map(item => ({
        [labelKey]: String(item[labelKey]),
        [valueKey]: Number(item[valueKey] || 0),
      }));
    }
    return [];
  }, [data, chartType, labelKey, valueKey]);

  const lineData = useMemo(() => {
    if (chartType === 'line') {
      return data.map(item => ({
        [labelKey]: item[labelKey],
        [valueKey]: Number(item[valueKey] || 0),
      }));
    }
    return [];
  }, [data, chartType, labelKey, valueKey]);

  const pieData = useMemo(() => {
    if (chartType === 'pie') {
      return data.map(item => ({
        name: String(item[labelKey]),
        value: Number(item[valueKey] || 0),
      }));
    }
    return [];
  }, [data, chartType, labelKey, valueKey]);

  const getColor = (index: number) =>
    resolvedColors[index % resolvedColors.length];

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatValue(v, valueFormat)}
          />
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip valueFormat={valueFormat} />}
            />
          )}
          {showLegend && <Legend verticalAlign="bottom" height={36} />}
          <Bar dataKey={valueKey} radius={[4, 4, 0, 0]}>
            {barData.map((_entry, index) => (
              <Cell key={`bar-${index}`} fill={getColor(index)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={labelKey as string}
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => {
              if (v instanceof Date) return v.toLocaleDateString();
              if (typeof v === 'string' && v.length <= 4) return v;
              if (typeof v === 'string' && v.includes('-')) return v.slice(5);
              return String(v);
            }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => formatValue(v, valueFormat)}
          />
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip valueFormat={valueFormat} />}
            />
          )}
          {showLegend && <Legend verticalAlign="bottom" height={36} />}
          <Line
            type="monotone"
            dataKey={valueKey as string}
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 4, strokeWidth: 0 }}
            activeDot={{ r: 6, fill: color, strokeWidth: 2, stroke: 'white' }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={3}
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {pieData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getColor(index)}
                stroke="hsl(var(--background))"
                strokeWidth={2}
              />
            ))}
          </Pie>
          {showLegend && (
            <Legend
              verticalAlign="bottom"
              height={60}
              formatter={(value: string) => (
                <span className="text-xs text-foreground/80">{value}</span>
              )}
            />
          )}
          {showTooltip && (
            <Tooltip
              content={<CustomTooltip valueFormat={valueFormat} />}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
