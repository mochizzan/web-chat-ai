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
  height?: number;
  width?: string | number;
  showLegend?: boolean;
  showTooltip?: boolean;
}

export function AnalyticsChart({
  data,
  chartType,
  xAxisKey = 'name',
  yAxisKey = 'value',
  labelKey = 'name',
  valueKey = 'value',
  color = '#10b981',
  height = 280,
  width = '100%',
  showLegend = true,
  showTooltip = true,
}: AnalyticsChartProps) {
  const barData = useMemo(() => {
    if (chartType === 'bar') {
      return data.map(item => ({
        name: String(item[xAxisKey]),
        [valueKey]: Number(item[yAxisKey] || 0),
      }));
    }
    return [];
  }, [data, chartType, xAxisKey, yAxisKey, valueKey]);

  const lineData = useMemo(() => {
    if (chartType === 'line') {
      return data.map(item => ({
        [xAxisKey]: item[xAxisKey],
        [yAxisKey]: Number(item[yAxisKey] || 0),
      }));
    }
    return [];
  }, [data, chartType, xAxisKey, yAxisKey]);

  const pieData = useMemo(() => {
    if (chartType === 'pie') {
      return data.map(item => ({
        name: String(item[labelKey]),
        value: Number(item[valueKey] || 0),
      }));
    }
    return [];
  }, [data, chartType, labelKey, valueKey]);

  if (chartType === 'bar') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend verticalAlign="bottom" height={36} />}
          <Bar dataKey={valueKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width={width} height={height}>
        <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisKey as string} 
            tick={{ fontSize: 11 }} 
            tickFormatter={(v) => {
              // Handle date formatting if needed
              if (v instanceof Date) return v.toLocaleDateString();
              return v;
            }} 
          />
          <YAxis tick={{ fontSize: 11 }} />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend verticalAlign="bottom" height={36} />}
          <Line 
            type="monotone" 
            dataKey={yAxisKey as string} 
            stroke={color} 
            strokeWidth={2} 
            dot={{ fill: color, r: 4 }} 
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
            labelLine={false} 
            label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={color} />
            ))}
          </Pie>
          {showTooltip && <Tooltip />}
          {showLegend && <Legend verticalAlign="bottom" height={36} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
