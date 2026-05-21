'use client';

import { useState, useEffect, useCallback } from 'react';

export function useAdminAnalytics(initialPeriod = '30d', initialGranularity = 'day') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [period, setPeriod] = useState(initialPeriod);
  const [granularity, setGranularity] = useState(initialGranularity);

  const handlePeriodChange = useCallback((p: string) => {
    setPeriod(p);
    if (p === 'today' || p === '24h') {
      setGranularity('hour');
    } else {
      setGranularity('day');
    }
  }, []);

  const fetchData = useCallback(async (p: string, g: string) => {
    setLoading(true);
    setError(null);

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 1000;

    let lastError: any;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await fetch(`/api/admin/analytics?period=${p}&granularity=${g}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message || 'Gagal memuat data');
        setData(json.data || json);
        setLoading(false);
        return;
      } catch (err: any) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    setError(lastError?.message || 'Gagal memuat data');
    setLoading(false);
  }, []);

  useEffect(() => {
    // Wrap in timeout to avoid 'set-state-in-effect' warning/error
    const timer = setTimeout(() => {
      fetchData(period, granularity);
    }, 0);
    return () => clearTimeout(timer);
  }, [period, granularity, fetchData]);

  const handleExport = useCallback((format: 'csv' | 'json') => {
    if (!data) return;
    const filename = `analytics-${new Date().toISOString().slice(0, 10)}`;

    const downloadBlob = (blob: Blob, fname: string) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    };

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `${filename}.json`);
    } else {
      const headers = ['Metric', 'Value'];
      const rows: [string, any][] = [
        ['Total Users', data.summary?.totalUsers],
        ['New Users 24h', data.summary?.newUsers24h],
        ['New Users 7d', data.summary?.newUsers7d],
        ['Active Users 30d', data.summary?.activeUsers30d],
        ['Total Conversations', data.summary?.totalConversations],
        ['Total Messages', data.summary?.totalMessages],
        ['Total Revenue', data.summary?.totalRevenue],
        ['Total Cost', data.summary?.totalCost],
        ['Profit', data.summary?.profit],
        ['Total Requests', data.summary?.totalRequests],
        ['Total Tokens', data.summary?.totalTokens],
        ['Avg Tokens/Request', data.summary?.avgTokensPerRequest],
        ['Total Models', data.summary?.totalModels],
        ['Active Models', data.summary?.activeModels],
      ];
      const csvContent = [headers, ...rows].map((r) => r.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${filename}.csv`);
    }
  }, [data]);

  return {
    data,
    loading,
    error,
    period,
    granularity,
    setGranularity,
    handlePeriodChange,
    refetch: () => fetchData(period, granularity),
    handleExport,
  };
}
