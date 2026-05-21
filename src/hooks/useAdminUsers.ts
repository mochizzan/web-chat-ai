'use client';

import { useState, useCallback } from 'react';
import { useChatStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export function useAdminUsers() {
  const { toast } = useToast();
  const { setUserCredit, addUserCredit } = useChatStore();
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const fetchUsers = useCallback(async (page: number, limit: number, search: string) => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch(`/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      const result = await response.json();
      
      if (response.ok && result.success && result.data?.users) {
        return { 
          users: result.data.users, 
          total: result.data.total || 0 
        };
      }
      
      const errorMessage = result.error?.message || result.error || 'Gagal mengambil data pengguna';
      throw new Error(errorMessage);
    } catch (error) {
      console.error('Error fetching users:', error);
      throw new Error(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const setCredit = useCallback(async (userId: string, amount: number) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, credit: amount }),
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        const errorMessage = result.error?.message || result.error || 'Gagal memperbarui kredit';
        throw new Error(errorMessage);
      }
      
      setUserCredit(userId, amount);
      toast({ title: 'Berhasil', description: 'Kredit pengguna diperbarui' });
      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return { success: false, error: err.message };
    }
  }, [setUserCredit, toast]);

  const addCredit = useCallback(async (userId: string, amount: number) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add-credit', userId, amount }),
      });
      
      const result = await response.json();
      if (!response.ok || !result.success) {
        const errorMessage = result.error?.message || result.error || 'Gagal menambahkan kredit';
        throw new Error(errorMessage);
      }
      
      addUserCredit(userId, amount);
      toast({ title: 'Berhasil', description: `+$${amount.toFixed(2)} kredit ditambahkan` });
      return { success: true };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error occurred');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      return { success: false, error: err.message };
    }
  }, [addUserCredit, toast]);

  return {
    isLoadingUsers,
    fetchUsers,
    setCredit,
    addCredit,
  };
}
