'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useChatStore, useChatDataStore, type UsageLogEntry, type CreditLogEntry } from '@/lib/store';
import { useMounted } from '@/hooks/use-mounted';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FilterBadges, type FilterPeriod } from '../filter-badges';

// Import sub-components
import { AccountHeader } from './components/account-header';
import { AccountTabs } from './components/account-tabs';
import { TopupTab } from './components/topup-tab';
import { OverviewTab } from './components/overview-tab';
import { useAccountData } from './hooks/use-account-data';
import type { ChartView } from './types';

export function AccountDialog() {
  const router = useRouter();
  const mounted = useMounted();
  const { toast } = useToast();

  const {
    accountDialogOpen,
    setAccountDialogOpen,
    credit,
    usageLogs,
    creditLogs,
    resetAccount,
    user,
    isLoggedIn,
    setCredit,
    accountTab,
    setAccountTab,
  } = useChatStore();

  // Local state
  const [leftFilter, setLeftFilter] = useState<FilterPeriod>('all');
  const [rightFilter, setRightFilter] = useState<FilterPeriod>('all');
  const [chartView, setChartView] = useState<ChartView>('area');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<import('./hooks/use-account-data').SourceFilter>('all');

  // Data processing hook
  const {
    leftFilteredLogs,
    rightMergedTimeline,
    modelBreakdown,
    tokenChartData,
    perModelAreaChartData,
    totalInputTokens,
    totalOutputTokens,
    totalCost,
  } = useAccountData(usageLogs, creditLogs, leftFilter, rightFilter, sourceFilter);

  // Event handlers
  const handleReset = useCallback(() => {
    resetAccount();
    toast({ title: 'Reset Berhasil', description: 'Kredit dan riwayat penggunaan telah direset' });
  }, [resetAccount, toast]);

  const handleGoToLogin = useCallback(() => {
    setAccountDialogOpen(false);
    router.push('/login');
  }, [setAccountDialogOpen, router]);

  const handleTopup = useCallback(async (amount: number) => {
    if (!amount || amount <= 0) return;
    setTopupLoading(true);
    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description: `Top up ${amount} kredit` }),
      });
      const json = await res.json();
      console.log('[DEBUG:B7] Topup response status=%d amount=%s', res.status, amount);
      if (res.ok) {
        const data = json.data;
        setCredit(data?.credit);
        console.log('[DEBUG:B7] Topup success, new credit=%s', data?.credit);
        toast({ title: 'Berhasil', description: `${amount} kredit ditambahkan ke akun Anda` });
        setSelectedPackage(null);
        setCustomAmount('');
      } else {
        const errMsg = json.error?.message || json.error || 'Topup gagal';
        console.warn('[DEBUG:B7] Topup failed: %s', errMsg);
        toast({ title: 'Gagal', description: errMsg, variant: 'destructive' });
      }
    } catch (error) {
      console.error('[DEBUG:B7] Topup network error:', error);
      toast({ title: 'Error', description: 'Koneksi server terputus', variant: 'destructive' });
    } finally {
      setTopupLoading(false);
    }
  }, [setCredit, toast]);

  // Safety re-fetch on dialog open to ensure fresh data from server
  useEffect(() => {
    if (!accountDialogOpen || !isLoggedIn) return;

    let cancelled = false;

    const fetchData = async () => {
      try {
        const [usageRes, accountRes] = await Promise.all([
          fetch('/api/usage?limit=100'),
          fetch('/api/account'),
        ]);

        if (cancelled) return;

        if (usageRes.ok) {
          const usageJson = await usageRes.json();
          const usageLogsData = usageJson?.data?.usageLogs;
          if (Array.isArray(usageLogsData)) {
            useChatDataStore.getState().setUsageLogs(usageLogsData);
          }
        }

        if (accountRes.ok) {
          const accountJson = await accountRes.json();
          const data = accountJson?.data;
          if (data) {
            if (Array.isArray(data.creditLogs)) {
              useChatDataStore.getState().setCreditLogs(data.creditLogs);
            }
            if (data.user?.credit !== undefined) {
              useChatDataStore.getState().setCredit(data.user.credit);
            }
            if (data.user?.totalSpent !== undefined) {
              useChatDataStore.getState().setTotalSpent(data.user.totalSpent);
            }
          }
        }
      } catch (err) {
        // Gracefully fall back to cached localStorage data — no blocking error UI
        console.warn('[AccountDialog] Background re-fetch failed, using cached data:', err);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [accountDialogOpen, isLoggedIn]);

  // Calculate derived values
  const effectiveTopupAmount = selectedPackage ?? (customAmount ? parseInt(customAmount, 10) : 0);
  const avgCostPerMsg = leftFilteredLogs.length > 0 ? totalCost / leftFilteredLogs.length : 0;
  const creditPercent = (credit ?? 0) > 0
    ? Math.min(100, ((credit ?? 0) / Math.max((credit ?? 0) + totalCost, 1)) * 100)
    : 0;

  return (
    <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
      <DialogContent className="sm:max-w-[1050px] lg:max-w-[1320px] p-0 gap-0 overflow-hidden h-[85vh] max-h-[850px] flex flex-col rounded-xl border border-border/40">
        <AccountHeader
          isLoggedIn={isLoggedIn}
          user={user}
          onLoginClick={handleGoToLogin}
        />
        
        <AccountTabs 
          value={accountTab}
          onChange={setAccountTab}
        />
        
        {accountTab === 'topup' ? (
          <TopupTab 
            credit={credit}
            selectedPackage={selectedPackage}
            customAmount={customAmount}
            topupLoading={topupLoading}
            effectiveTopupAmount={effectiveTopupAmount}
            onPackageSelect={setSelectedPackage}
            onCustomAmountChange={(v) => {
              setCustomAmount(v);
              setSelectedPackage(null);
            }}
            onTopup={handleTopup}
          />
        ) : (
          <OverviewTab
            credit={credit}
            leftFilter={leftFilter}
            onFilterChange={setLeftFilter}
            rightFilter={rightFilter}
            onRightFilterChange={setRightFilter}
            sourceFilter={sourceFilter}
            onSourceFilterChange={setSourceFilter}
            chartView={chartView}
            onChartViewChange={setChartView}
            totalCost={totalCost}
            totalInputTokens={totalInputTokens}
            totalOutputTokens={totalOutputTokens}
            avgCostPerMsg={avgCostPerMsg}
            creditPercent={creditPercent}
            modelBreakdown={modelBreakdown}
            tokenChartData={tokenChartData}
            perModelAreaChartData={perModelAreaChartData}
            rightMergedTimeline={rightMergedTimeline}
            onReset={handleReset}
            onExpandedLogChange={setExpandedLog}
            expandedLog={expandedLog}
            mounted={mounted}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}