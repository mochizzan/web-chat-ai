'use client';
import Image from 'next/image';
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
import {
  TrendingDown,
  Gauge,
  Users,
  UserPlus,
  Activity,
  MessageSquare,
  MessageCircle,
  DollarSign,
  PiggyBank,
  Cpu,
  Server,
  CheckCircle,
  Key,
  KeyRound,
  BarChart3,
  Globe,
} from 'lucide-react';
import { formatCurrency8 } from '@/lib/admin-utils';

export function AdminOverview() {
  const { data, loading, error, period, handlePeriodChange } = useAdminAnalytics('30d', 'day');

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
        {/* Card 1: Total Users */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Pengguna
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalUsers ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 2: New Users 24h */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-green-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Pengguna Baru 24j
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.newUsers24h ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 3: New Users 7d */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Pengguna Baru 7h
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.newUsers7d ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 4: Active Users 30d */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Pengguna Aktif 30h
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.activeUsers30d ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 5: Total Conversations */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Percakapan
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalConversations ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 6: Total Messages */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-indigo-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Pesan
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalMessages ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 7: Total Revenue */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Pendapatan
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">
              {formatCurrency8(s.totalRevenue ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* Card 8: Total Cost */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Biaya
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">
              {formatCurrency8(s.totalCost ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* Card 9: Profit */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-yellow-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Keuntungan
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground font-mono">
              {formatCurrency8(s.profit ?? 0)}
            </p>
          </CardContent>
        </Card>

        {/* Card 10: Total Requests */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Requests
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalRequests?.toLocaleString() ?? '0'}</p>
          </CardContent>
        </Card>

        {/* Card 11: Total Tokens */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Token
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalTokens?.toLocaleString() ?? '0'}</p>
          </CardContent>
        </Card>

        {/* Card 12: Avg Tokens/Request */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-sky-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Rata-rata Tokens/Request
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {s.avgTokensPerRequest?.toLocaleString() ?? '0'}
            </p>
          </CardContent>
        </Card>

        {/* Card 13: Total Models */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-purple-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Total Model
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.totalModels ?? 0}</p>
          </CardContent>
        </Card>

        {/* Card 14: Active Models */}
        <Card className="border-border/40 hover:shadow-sm transition-all duration-200">
          <CardContent className="p-4 h-[110px] flex flex-col justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Model Aktif
              </span>
            </div>
            <p className="text-2xl font-bold text-foreground">{s.activeModels ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* BYOK Summary Cards */}
      <div className="pt-2">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-foreground">BYOK / API Gateway</h3>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 ml-1">
            Statistik API Key
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* BYOK Card 1: Total API Keys */}
          <Card className="border-border/40 hover:shadow-sm transition-all duration-200 border-indigo-500/20">
            <CardContent className="p-4 h-[110px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-indigo-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Total API Keys
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.byokTotalKeys ?? 0}</p>
            </CardContent>
          </Card>

          {/* BYOK Card 2: Active API Keys */}
          <Card className="border-border/40 hover:shadow-sm transition-all duration-200 border-indigo-500/20">
            <CardContent className="p-4 h-[110px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  API Key Aktif
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.byokActiveKeys ?? 0}</p>
            </CardContent>
          </Card>

          {/* BYOK Card 3: Total BYOK Requests */}
          <Card className="border-border/40 hover:shadow-sm transition-all duration-200 border-indigo-500/20">
            <CardContent className="p-4 h-[110px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  BYOK Requests
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.byokTotalRequests ?? 0}</p>
            </CardContent>
          </Card>

          {/* BYOK Card 4: Total BYOK Cost */}
          <Card className="border-border/40 hover:shadow-sm transition-all duration-200 border-indigo-500/20">
            <CardContent className="p-4 h-[110px] flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Total Biaya BYOK
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground font-mono">
                {formatCurrency8(s.byokTotalCost ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>
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
                  color="#3b82f6"
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
                  color="#f59e0b"
                  valueFormat="token"
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
                  colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']}
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
                  colors={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']}
                  valueFormat="token"
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

      {/* BYOK Charts */}
      <div className="space-y-6 mt-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-foreground">BYOK / API Gateway Charts</h3>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 ml-1">
            Grafik Penggunaan API Key
          </span>
        </div>

        {/* BYOK Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart: BYOK Requests over Time */}
          <Card className="border-border/40 border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">BYOK Requests</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.byokUsageOverTime && data.byokUsageOverTime.length > 0 ? (
                <AnalyticsChart
                  data={data.byokUsageOverTime}
                  chartType="line"
                  labelKey="time"
                  valueKey="tokens"
                  color="#6366f1"
                  valueFormat="token"
                  height={280}
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
                  Belum ada data
                </div>
              )}
            </CardContent>
          </Card>
          {/* Bar Chart: BYOK Requests per Model */}
          <Card className="border-border/40 border-indigo-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">BYOK Request per Model</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.byokRequestsPerModel && data.byokRequestsPerModel.length > 0 ? (
                <AnalyticsChart
                  data={data.byokRequestsPerModel}
                  chartType="bar"
                  labelKey="name"
                  valueKey="requests"
                  colors={['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#312e81', '#4338ca', '#4f46e5', '#6366f1']}
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
      </div>

      {/* Top Users Table */}
      <Separator className="my-6" />
      <div>
        <h3 className="text-md font-semibold text-foreground mb-4">
          Top Pengguna (Berdasarkan Pengeluaran)
        </h3>
        <Table>
          <TableCaption>10 pengguna dengan pengeluaran tertinggi</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Total Dibelanjakan</TableHead>
              <TableHead className="text-right">Kredit</TableHead>
              <TableHead className="text-right">Total Request</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.topUsersBySpending && data.topUsersBySpending.length > 0 ? (
              data.topUsersBySpending.map((user: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency8(user.totalSpent)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {user.credit?.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right">{user.requestCount}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                  Belum ada data pengguna
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* BYOK Tables */}
      <Separator className="my-6" />
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Key className="h-5 w-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-foreground">BYOK / API Gateway Tables</h3>
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/50 ml-1">
            Detail Penggunaan API Key
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top API Keys Table */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Top API Keys (Berdasarkan Request)
            </h4>
            <Table>
              <TableCaption>10 API Key dengan request terbanyak</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Key</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead className="text-right">Request</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                  <TableHead className="text-right">Biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.topApiKeys && data.topApiKeys.length > 0 ? (
                  data.topApiKeys.map((key: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell className="font-mono text-xs">{key.key_prefix}...</TableCell>
                      <TableCell className="text-right">{key.requestCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {key.totalTokens?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency8(key.totalCost)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Belum ada data API Key
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Top API Users Table */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              Top BYOK Users (Berdasarkan Request)
            </h4>
            <Table>
              <TableCaption>10 pengguna dengan request BYOK terbanyak</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Request</TableHead>
                  <TableHead className="text-right">Token</TableHead>
                  <TableHead className="text-right">Biaya</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.topApiUsers && data.topApiUsers.length > 0 ? (
                  data.topApiUsers.map((user: any, idx: number) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-right">{user.requestCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {user.totalTokens?.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {formatCurrency8(user.totalCost)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                      Belum ada data pengguna BYOK
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
