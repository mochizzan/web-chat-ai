'use client';

import { useState } from 'react';
import {
  FileText,
  Search,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Globe,
} from 'lucide-react';
import { useAdminLogs, AdminLogEntry } from '@/hooks/useAdminLogs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

function formatCost(cost: unknown): string {
  const n = Number(cost) || 0;
  if (n === 0) return '0';
  if (n < 0.001) return n.toExponential(1);
  return n.toFixed(4);
}

function formatTokens(value: unknown): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  if (diff < 60_000) return 'baru saja';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}j lalu`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}h lalu`;
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function LogRow({ log, isNew }: { log: AdminLogEntry; isNew: boolean }) {
  const isChat = log.logType === 'chat';

  return (
    <tr
      className={`border-b border-border/40 transition-colors duration-500 ${
        isNew ? 'bg-primary/5 animate-pulse' : ''
      } hover:bg-muted/30`}
    >
      {/* Type badge */}
      <td className="py-2.5 px-3 whitespace-nowrap">
        <Badge
          variant={isChat ? 'secondary' : 'default'}
          className={`gap-1 text-[11px] font-medium ${
            isChat
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
              : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
          }`}
        >
          {isChat ? (
            <>
              <Globe className="w-3 h-3" />
              Chat
            </>
          ) : (
            <>
              <Terminal className="w-3 h-3" />
              BYOK
            </>
          )}
        </Badge>
      </td>

      {/* User */}
      <td className="py-2.5 px-3 max-w-[140px]">
        <div className="text-sm font-medium text-foreground truncate">
          {log.userName || log.userEmail || 'Unknown'}
        </div>
        {log.userEmail && log.userName && (
          <div className="text-[11px] text-muted-foreground truncate">
            {log.userEmail}
          </div>
        )}
      </td>

      {/* Model */}
      <td className="py-2.5 px-3">
        <code className="text-xs bg-muted/60 px-1.5 py-0.5 rounded font-mono">
          {log.model}
        </code>
      </td>

      {/* Tokens */}
      <td className="py-2.5 px-3 whitespace-nowrap">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span title={`Input: ${log.inputTokens}`}>
            ↓{formatTokens(log.inputTokens)}
          </span>
          <span title={`Output: ${log.outputTokens}`}>
            ↑{formatTokens(log.outputTokens)}
          </span>
        </div>
      </td>

      {/* Cost */}
      <td className="py-2.5 px-3 whitespace-nowrap text-right">
        <span className="text-xs font-mono font-medium">
          {formatCost(log.cost)}
        </span>
      </td>

      {/* Status */}
      <td className="py-2.5 px-3 whitespace-nowrap">
        <Badge
          variant={log.status === 'success' ? 'outline' : 'destructive'}
          className={`text-[10px] font-medium ${
            log.status === 'success'
              ? 'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800'
              : ''
          }`}
        >
          {log.status === 'success' ? 'OK' : 'Error'}
        </Badge>
      </td>

      {/* Time */}
      <td className="py-2.5 px-3 whitespace-nowrap text-xs text-muted-foreground text-right">
        {getRelativeTime(log.createdAt)}
      </td>
    </tr>
  );
}

function LogSkeleton() {
  return (
    <tr className="border-b border-border/40">
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} className="py-3 px-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function AdminLogsView() {
  const {
    logs,
    total,
    page,
    limit,
    search,
    period,
    typeFilter,
    isLoading,
    isConnected,
    newLogIds,
    goToPage,
    updateSearch,
    updatePeriod,
    updateTypeFilter,
    refetch,
  } = useAdminLogs();

  const [localSearch, setLocalSearch] = useState(search);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearch(localSearch);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Logs</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log aktivitas sistem · Real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-green-500" />
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Reconnecting...</span>
              </>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari user, model, provider..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </form>

        <Select value={typeFilter} onValueChange={updateTypeFilter}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Tipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="chat">Chat</SelectItem>
            <SelectItem value="byok">BYOK</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={updatePeriod}>
          <SelectTrigger className="w-[130px] h-9">
            <SelectValue placeholder="Periode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">24 Jam</SelectItem>
            <SelectItem value="7d">7 Hari</SelectItem>
            <SelectItem value="30d">30 Hari</SelectItem>
            <SelectItem value="1y">1 Tahun</SelectItem>
            <SelectItem value="all">Semua</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground">
          {total > 0 ? `${total} log` : ''}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border/40 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border/40">
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[80px]">
                  Tipe
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3">
                  User
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3">
                  Model
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[100px]">
                  Tokens
                </th>
                <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[70px]">
                  Cost
                </th>
                <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[60px]">
                  Status
                </th>
                <th className="text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-2.5 px-3 w-[80px]">
                  Waktu
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && logs.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => <LogSkeleton key={i} />)
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center text-muted-foreground">
                      <FileText className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm font-medium">Belum ada log</p>
                      <p className="text-xs mt-1 opacity-60">
                        Log akan muncul ketika ada aktivitas chat atau API
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    isNew={newLogIds.has(log.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
            <div className="text-xs text-muted-foreground">
              {(page - 1) * limit + 1}–{Math.min(page * limit, total)} dari {total}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => goToPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(1, page - 2);
                const p = start + i;
                if (p > totalPages) return null;
                return (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    className="min-w-[32px]"
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => goToPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
