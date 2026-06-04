'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UsageSummary {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
}

interface UsageLog {
  id: string;
  model: string;
  stream: boolean;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  status: string;
  created_at: string;
}

interface UsageData {
  summary: UsageSummary;
  logs: UsageLog[];
}

const PERIODS = [
  { value: 'today', label: 'Hari Ini' },
  { value: '24h', label: '24 Jam' },
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: '1y', label: '1 Tahun' },
] as const;

export function UsageTab() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('7d');

  const fetchUsage = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/v1/usage?period=${period}&limit=100`);
      if (!res.ok) throw new Error('Gagal memuat data penggunaan');
      const json = await res.json();
      setData(json.data || { summary: { total_requests: 0, total_tokens: 0, total_cost: 0 }, logs: [] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchUsage}>Coba Lagi</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Request</CardDescription>
            <CardTitle className="text-2xl">
              {data?.summary.total_requests.toLocaleString('id-ID')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Token</CardDescription>
            <CardTitle className="text-2xl">
              {data?.summary.total_tokens.toLocaleString('id-ID')}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Biaya</CardDescription>
            <CardTitle className="text-2xl">
              {data?.summary.total_cost.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Period Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant={period === p.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="icon" onClick={fetchUsage}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Usage Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Riwayat Penggunaan
          </CardTitle>
          <CardDescription>
            Log penggunaan API key berdasarkan model dan waktu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.logs || data.logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <BarChart3 className="h-8 w-8" />
              <p className="text-sm">Belum ada data penggunaan.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground text-[11px] uppercase tracking-wider">
                    <th className="pb-2 pr-4 font-medium">Model</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium text-right">Prompt</th>
                    <th className="pb-2 pr-4 font-medium text-right">Completion</th>
                    <th className="pb-2 pr-4 font-medium text-right">Token</th>
                    <th className="pb-2 pr-4 font-medium text-right">Biaya</th>
                    <th className="pb-2 font-medium text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                      <td className="py-2.5 pr-4">
                        <code className="text-xs font-mono">{log.model}</code>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={log.status === 'success' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground text-xs">
                        {log.prompt_tokens.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground text-xs">
                        {log.completion_tokens.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs font-medium">
                        {log.total_tokens.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-xs font-medium">
                        {log.cost.toFixed(4)}
                      </td>
                      <td className="py-2.5 text-right text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
