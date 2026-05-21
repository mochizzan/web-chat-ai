'use client';

import { useEffect, useState } from 'react';
import { useChatDataStore } from '@/lib/store';

export function useAuthSession() {
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const {
    isLoggedIn,
    login,
    logout,
    setConversations,
    setTotalSpent,
    setUsageLogs,
    setCreditLogs,
    setCredit,
  } = useChatDataStore();

  // 1. Initialize session on mount — replaces the removed initializeSession store action
  useEffect(() => {
    async function initializeSession() {
      console.log(`[${new Date().toISOString()}] [useAuthSession] initializeSession: Starting session initialization`);
      try {
        const response = await fetch('/api/auth/me');
        console.log(`[${new Date().toISOString()}] [useAuthSession] initializeSession: Received response`, { status: response.status });
        if (response.ok) {
          const data = await response.json();
          const userData = data.user ?? data.data?.user ?? data;
          // Only login if we have valid user data with at least an id
          if (userData && userData.id) {
            console.log(`[${new Date().toISOString()}] [useAuthSession] initializeSession: User logged in`, { userId: userData.id });
            login(userData);
            setCredit(userData.credit ?? 0);
            setTotalSpent(userData.totalSpent ?? 0);
          } else {
            // No valid user data — ensure logged out
            console.log(`[${new Date().toISOString()}] [useAuthSession] initializeSession: No valid user data, logging out`);
            logout();
          }
        } else {
          // Session invalid — clear all user-specific data
          console.log(`[${new Date().toISOString()}] [useAuthSession] initializeSession: Session invalid, logging out`);
          logout();
        }
      } catch (error) {
        console.log(`[${new Date().toISOString()}] [useAuthSession] initializeSession: Error occurred`, { error });
        console.error('Session initialization error:', error);
        logout();
      }
    }

    initializeSession();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Fetch server data when logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Starting data fetch`);
    let cancelled = false;

    async function fetchServerData() {
      setIsLoadingConversations(true);
      console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Loading conversations`);
      try {
        // Fetch conversations list
        const convRes = await fetch('/api/conversations');
        console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Conversations response`, { status: convRes.status });
        if (convRes.ok) {
          const convData = await convRes.json();
          if (!cancelled && convData.conversations) {
            console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Setting conversations`, { count: convData.conversations.length });
            setConversations(convData.conversations);
          }
        } else {
          console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Conversations fetch failed`, { status: convRes.status });
        }

        // Fetch account data (usage logs, credit logs, total spent)
        const accountRes = await fetch('/api/account');
        console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Account response`, { status: accountRes.status });
        if (accountRes.ok) {
          const accountJson = await accountRes.json();
          const accountData = accountJson.data || accountJson;
          if (!cancelled) {
            if (accountData.totalSpent !== undefined) {
              console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Setting total spent`, { totalSpent: accountData.totalSpent });
              setTotalSpent(accountData.totalSpent);
            }
            if (accountData.user?.credit !== undefined) {
              setCredit(accountData.user.credit);
            }
            if (Array.isArray(accountData.creditLogs)) {
              setCreditLogs(accountData.creditLogs);
            }
          }
        }

        // Fetch usage logs
        const usageRes = await fetch('/api/usage?limit=100');
        console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Usage response`, { status: usageRes.status });
        if (usageRes.ok) {
          const usageJson = await usageRes.json();
          const usageData = usageJson.data || usageJson;
          if (!cancelled && usageData.usageLogs) {
            console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Setting usage logs`, { count: usageData.usageLogs.length });
            setUsageLogs(usageData.usageLogs);
          }
        }
      } catch (error) {
        console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Error occurred`, { error });
      } finally {
        if (!cancelled) {
          console.log(`[${new Date().toISOString()}] [useAuthSession] fetchServerData: Finished loading`);
          setIsLoadingConversations(false);
        }
      }
    }

    fetchServerData();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, setConversations, setUsageLogs, setTotalSpent, setCreditLogs, setCredit]);

  return {
    isLoggedIn,
    isLoadingConversations,
  };
}
