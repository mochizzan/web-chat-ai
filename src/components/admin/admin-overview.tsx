'use client';
import { useState } from 'react';
import { useAdminAnalytics } from '@/hooks/useAdminAnalytics';
import { AnalyticsChart } from '@/components/ui/analytics-chart';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Bot, TrendingDown, Gauge } from 'lucide-react';
import { formatCurrency8 } from '@/lib/admin-utils';

export function AdminOverview() {
  const { data, loading, error } = useAdminAnalytics('30d', 'day');
  const [period, setPeriod] = useState('30d');

  const handlePeriodChange = (p: string) => {
    setPeriod(p);
  };

  if (loading) {
    return <div className="text-center py-8">Memuat data...</div>;
  }

  if (error) {
    return <div className="text-center text-destructive py-8">Gagal memuat data: {error}</div>;
  }

  const s = data?.summary || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground">Overview Admin</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Ringkasan statistik sistem
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Pengguna
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalUsers || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Pendapatan
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">
              {formatCurrency8(s.totalRevenue || 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-sky-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Rata-rata Tokens/Request
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {s.avgTokensPerRequest?.toFixed(2) || '0'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Requests
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalRequests?.toLocaleString() || '0'}</p>
          </CardContent>
        </Card>
      </div>

      <Separator className="my-6" />

      {/* Charts */}
      <div className="space-y-6">
        {/* Period Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Periode:</span>
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2 py-1">
              <button
                onClick={() => handlePeriodChange('7d')}
                className={`px-3 py-1 text-sm rounded-md ${
                  period === '7d' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                7 Hari
              </button>
              <button
                onClick={() => handlePeriodChange('30d')}
                className={`px-3 py-1 text-sm rounded-md ${
                  period === '30d' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                30 Hari
              </button>
              <button
                onClick={() => handlePeriodChange('90d')}
                className={`px-3 py-1 text-sm rounded-md ${
                  period === '90d' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                90 Hari
              </button>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart: New Users over Time */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Pengguna Baru</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.newUsersOverTime && data.newUsersOverTime.length > 0 ? (
                <AnalyticsChart
                  data={data.newUsersOverTime}
                  chartType="line"
                  labelKey="date"
                  valueKey="count"
                  height={280}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
          {/* Line Chart: Token Usage */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Penggunaan Token</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.usageOverTime && data.usageOverTime.length > 0 ? (
                <AnalyticsChart
                  data={data.usageOverTime}
                  chartType="line"
                  labelKey="time"
                  valueKey="tokens"
                  height={280}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bar Chart: Requests per Model */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Request per Model</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.requestsPerModel && data.requestsPerModel.length > 0 ? (
                <AnalyticsChart
                  data={data.requestsPerModel}
                  chartType="bar"
                  labelKey="name"
                  valueKey="requests"
                  height={280}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
          {/* Pie Chart: Token Distribution by Provider */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Distribusi Token per Provider</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.tokenByProvider && data.tokenByProvider.length > 0 ? (
                <AnalyticsChart
                  data={data.tokenByProvider}
                  chartType="pie"
                  labelKey="name"
                  valueKey="value"
                  height={300}
                  showLegend={true}
                  showTooltip={true}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}