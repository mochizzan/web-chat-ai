'use client';

import { useCallback } from 'react';
import { useChatStore, useChatDataStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { UsageLogEntry, CreditLogEntry } from '@/lib/store';

/**
 * Hook untuk chat actions dan billing actions.
 * 
 * Chat Actions:
 * - handleLoadConversation
 * - handleDeleteConversation
 * - handleEditConfirm
 * - handleRegenerate
 * 
 * Billing Actions (menggantikan methods async di store):
 * - deductCredit
 * - addCredit
 * - addUsageLog
 * - addCreditLog
 * 
 * PRINSIP: 
 * - Lakukan API call ke server
 * - Hanya update store jika API call sukses
 * - Tidak ada optimistic updates tanpa konfirmasi
 */
export function useChatActions(handleSend: (message: string) => void) {
  const { toast } = useToast();
  const store = useChatDataStore();

  // ============================================
  // CHAT ACTIONS
  // ============================================

  const handleLoadConversation = useCallback(
    async (id: string) => {
      const { setMessages, setActiveCategory } = useChatStore.getState();
      try {
        console.log(`[${new Date().toISOString()}] [useChatActions] handleLoadConversation: Fetching conversation`, { id });
        const res = await fetch(`/api/conversations/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages) {
            setMessages(data.messages);
          }
          if (data.conversation?.category) {
            setActiveCategory(data.conversation.category);
          }
        }
      } catch (error) {
        console.log(`[${new Date().toISOString()}] [useChatActions] handleLoadConversation: Error`, { error });
      }
    },
    []
  );

  const removeConversation = useChatStore((s) => s.removeConversation);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        console.log(`[${new Date().toISOString()}] [useChatActions] handleDeleteConversation: Deleting conversation`, { id });
        const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
        if (res.ok) {
          removeConversation(id);
          toast({ title: 'Deleted', description: 'Conversation deleted successfully.' });
        } else {
          const errData = await res.json().catch(() => ({}));
          toast({
            title: 'Gagal',
            description: errData.error || 'Gagal menghapus percakapan',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.log(`[${new Date().toISOString()}] [useChatActions] handleDeleteConversation: Error`, { error });
        toast({ title: 'Error', description: 'Gagal terhubung ke server', variant: 'destructive' });
      }
    },
    [removeConversation, toast]
  );

  const setRegeneratingMessageId = useChatStore((s) => s.setRegeneratingMessageId);

  const handleEditConfirm = useCallback(
    (messageId: string, newContent: string) => {
      console.log(`[${new Date().toISOString()}] [useChatActions] handleEditConfirm: Starting edit`, { messageId });
      if (useChatStore.getState().isGenerating) return;

      const currentMessages = useChatStore.getState().messages;
      const editIndex = currentMessages.findIndex((m) => m.id === messageId);
      if (editIndex === -1) return;

      const keptMessages = currentMessages.slice(0, editIndex);
      useChatStore.getState().setMessages(keptMessages);

      setTimeout(() => {
        handleSend(newContent);
      }, 50);
    },
    [handleSend]
  );

  const handleRegenerate = useCallback(() => {
    console.log(`[${new Date().toISOString()}] [useChatActions] handleRegenerate: Starting regeneration`);
    if (useChatStore.getState().isGenerating) return;
    const currentMessages = useChatStore.getState().messages;

    let lastAssistantIdx = -1;
    let lastAssistantId = '';
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].role === 'assistant') {
        lastAssistantIdx = i;
        lastAssistantId = currentMessages[i].id;
        break;
      }
    }
    if (lastAssistantIdx === -1) return;

    setRegeneratingMessageId(lastAssistantId);

    const keptMessages = currentMessages.slice(0, lastAssistantIdx);
    useChatStore.getState().setMessages(keptMessages);

    let lastUserContent = '';
    for (let i = keptMessages.length - 1; i >= 0; i--) {
      if (keptMessages[i].role === 'user') {
        lastUserContent = keptMessages[i].content;
        break;
      }
    }
    if (!lastUserContent) return;

    setTimeout(() => {
      handleSend(lastUserContent);
    }, 50);
  }, [handleSend, setRegeneratingMessageId]);

  // ============================================
  // BILLING ACTIONS
  // ============================================

  /**
   * Deduct credit dari user setelah penggunaan AI
   * Hanya update store jika API call sukses
   */
  const deductCredit = useCallback(async (amount: number): Promise<boolean> => {
    if (amount <= 0) return true; // tidak ada yang dipotong

    try {
      console.log(`[${new Date().toISOString()}] [useChatActions] deductCredit: Starting deduction`, { amount });
      const response = await fetch('/api/billing/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        console.log(`[${new Date().toISOString()}] [useChatActions] deductCredit: API error`, { status: response.status });
        const error = await response.json();
        throw new Error(error.error || 'Gagal mengurangi kredit');
      }

      const data = await response.json();
      
      // Update store HANYA setelah sukses
      store.setCredit(data.credit ?? store.credit - amount);
      if (data.totalSpent !== undefined) {
        store.setTotalSpent(data.totalSpent);
      }
      if (data.creditLog) {
        const existing = store.creditLogs.find(l => l.id === data.creditLog.id);
        if (!existing) {
          store.setCreditLogs([data.creditLog, ...store.creditLogs]);
        }
      }

      return true;
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Gagal Mengurangi Kredit',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [store, toast]);

  /**
   * Add credit (topup) ke user
   * Hanya update store jika API call sukses
   */
  const addCredit = useCallback(async (amount: number): Promise<boolean> => {
    if (amount <= 0) return false;

    try {
      console.log(`[${new Date().toISOString()}] [useChatActions] addCredit: Starting topup`, { amount });
      const response = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        console.log(`[${new Date().toISOString()}] [useChatActions] addCredit: API error`, { status: response.status });
        const error = await response.json();
        throw new Error(error.error || 'Gagal menambahkan kredit');
      }

      const data = await response.json();
      
      // Update store HANYA setelah sukses
      store.setCredit(data.credit ?? store.credit + amount);
      if (data.creditLog) {
        const existing = store.creditLogs.find(l => l.id === data.creditLog.id);
        if (!existing) {
          store.setCreditLogs([data.creditLog, ...store.creditLogs]);
        }
      }

      toast({
        title: 'Berhasil',
        description: `+${amount} kredit ditambahkan`,
      });
      return true;
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Gagal Top Up',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [store, toast]);

  /**
   * Save usage log ke server dan update store
   * Hanya update store jika API call sukses
   */
  const addUsageLog = useCallback(async (entry: UsageLogEntry): Promise<boolean> => {
    try {
      console.log(`[${new Date().toISOString()}] [useChatActions] addUsageLog: Starting log addition`, { entry });
      const response = await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        console.log(`[${new Date().toISOString()}] [useChatActions] addUsageLog: API error`, { status: response.status });
        const error = await response.json();
        throw new Error(error.error || 'Gagal menyimpan log penggunaan');
      }

      // Update store HANYA setelah sukses
      const existing = store.usageLogs.find(l => l.id === entry.id);
      if (!existing) {
        store.setUsageLogs([entry, ...store.usageLogs]);
      }
      return true;
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Gagal Menyimpan Log',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [store, toast]);

  /**
   * Add credit log ke server dan update store
   * Hanya update store jika API call sukses
   */
  const addCreditLog = useCallback(async (entry: CreditLogEntry): Promise<boolean> => {
    try {
      console.log(`[${new Date().toISOString()}] [useChatActions] addCreditLog: Starting log addition`, { entry });
      const response = await fetch('/api/billing/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        console.log(`[${new Date().toISOString()}] [useChatActions] addCreditLog: API error`, { status: response.status });
        const error = await response.json();
        throw new Error(error.error || 'Gagal menyimpan log kredit');
      }

      // Update store HANYA setelah sukses
      const existing = store.creditLogs.find(l => l.id === entry.id);
      if (!existing) {
        store.setCreditLogs([entry, ...store.creditLogs]);
      }
      return true;
    } catch (error) {
      const err = error as Error;
      toast({
        title: 'Gagal Menyimpan Log',
        description: err.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [store, toast]);

  return {
    // Chat actions
    handleLoadConversation,
    handleDeleteConversation,
    handleEditConfirm,
    handleRegenerate,
    // Billing actions
    deductCredit,
    addCredit,
    addUsageLog,
    addCreditLog,
  };
}
