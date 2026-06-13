'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';

export interface AdminLogEntry {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  logType: 'chat' | 'byok';
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  creditBefore: number | null;
  creditAfter: number | null;
  status: 'success' | 'error';
  createdAt: string;
}

interface LogsResponse {
  logs: AdminLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export function useAdminLogs() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('24h');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [newLogIds, setNewLogIds] = useState<Set<string>>(new Set());
  const logsRef = useRef<AdminLogEntry[]>([]);

  // Use the WebSocket context for reactive connection status
  const { isConnected: wsConnected } = useWebSocket();

  // Keep ref in sync
  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  const fetchLogs = useCallback(async (p: number, q: string, periodVal: string, typeVal: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(limit),
        search: q,
        period: periodVal,
        type: typeVal,
      });
      const response = await fetch(`/api/admin/logs?${params}`);
      const result = await response.json();

      if (response.ok && result.success && result.data?.logs) {
        setLogs(result.data.logs);
        setTotal(result.data.total || 0);
      } else {
        console.error('[AdminLogs] Failed to fetch:', result.error);
      }
    } catch (error) {
      console.error('[AdminLogs] Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  // Initial fetch and re-fetch when filters change
  useEffect(() => {
    fetchLogs(page, search, period, typeFilter);
  }, [page, search, period, typeFilter, fetchLogs]);

  // Listen for real-time log events
  useEffect(() => {
    const handleNewLog = (e: Event) => {
      const customEvent = e as CustomEvent<AdminLogEntry>;
      const newLog = customEvent.detail;
      if (!newLog || !newLog.id) return;

      setIsConnected(true);

      // Prepend to logs, keep max 100
      setLogs((prev) => {
        // Avoid duplicates
        if (prev.some((l) => l.id === newLog.id)) return prev;
        const updated = [newLog, ...prev].slice(0, 100);
        return updated;
      });
      setTotal((prev) => prev + 1);

      // Highlight new log
      setNewLogIds((prev) => new Set(prev).add(newLog.id));
      setTimeout(() => {
        setNewLogIds((prev) => {
          const next = new Set(prev);
          next.delete(newLog.id);
          return next;
        });
      }, 3000);
    };

    window.addEventListener('admin-log-new', handleNewLog);
    return () => window.removeEventListener('admin-log-new', handleNewLog);
  }, []);

  // Sync connection status from WebSocket context (reactive, not event-based)
  useEffect(() => {
    setIsConnected(wsConnected);
  }, [wsConnected]);

  const goToPage = useCallback((p: number) => {
    setPage(p);
  }, []);

  const updateSearch = useCallback((q: string) => {
    setSearch(q);
    setPage(1);
  }, []);

  const updatePeriod = useCallback((p: string) => {
    setPeriod(p);
    setPage(1);
  }, []);

  const updateTypeFilter = useCallback((t: string) => {
    setTypeFilter(t);
    setPage(1);
  }, []);

  return {
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
    refetch: () => fetchLogs(page, search, period, typeFilter),
  };
}
