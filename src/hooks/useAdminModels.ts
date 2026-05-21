'use client';

import { useState, useCallback } from 'react';
import { useChatStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

export function useAdminModels() {
  const { toast } = useToast();
  const { 
    models, 
    setModels, 
    updateModel, 
    removeModel, 
    toggleModelFree 
  } = useChatStore();
  
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchModels = useCallback(async (all = true) => {
    try {
      const response = await fetch(`/api/models?all=${all}`);
      if (response.ok) {
        const json = await response.json();
        const data = json.data;
        if (data?.models) {
          setModels(data.models);
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }, [setModels]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addModel = useCallback(async (modelData: any) => {
     
    try {
      const response = await fetch('/api/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modelData),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gagal menambahkan model');
      }
      await fetchModels(true);
      toast({ title: 'Berhasil', description: `Model "${modelData.name}" ditambahkan` });
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return { success: false, error: error.message };
      }
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak diketahui', variant: 'destructive' });
      return { success: false, error: 'Terjadi kesalahan yang tidak diketahui' };
    }
  }, [fetchModels, toast]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateModelData = useCallback(async (modelId: string, updates: any) => {
     
    try {
      const response = await fetch('/api/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modelId, ...updates }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gagal memperbarui model');
      }
      updateModel(modelId, updates);
      toast({ title: 'Berhasil', description: 'Model diperbarui' });
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return { success: false, error: error.message };
      }
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak diketahui', variant: 'destructive' });
      return { success: false, error: 'Terjadi kesalahan yang tidak diketahui' };
    }
  }, [updateModel, toast]);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      const response = await fetch(`/api/models?id=${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gagal menghapus model');
      }
      removeModel(modelId);
      toast({ title: 'Berhasil', description: 'Model berhasil dihapus' });
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return { success: false, error: error.message };
      }
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak diketahui', variant: 'destructive' });
      return { success: false, error: 'Terjadi kesalahan yang tidak diketahui' };
    }
  }, [removeModel, toast]);

  const toggleFreeStatus = useCallback(async (modelId: string, currentFree: boolean) => {
    try {
      const response = await fetch('/api/models', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modelId, free: !currentFree }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Gagal mengubah status gratis');
      }
      toggleModelFree(modelId);
      toast({ title: 'Berhasil', description: `Model ${!currentFree ? 'gratis' : 'berbayar'}` });
      return { success: true };
    } catch (error) {
      if (error instanceof Error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return { success: false, error: error.message };
      }
      toast({ title: 'Error', description: 'Terjadi kesalahan yang tidak diketahui', variant: 'destructive' });
      return { success: false, error: 'Terjadi kesalahan yang tidak diketahui' };
    }
  }, [toggleModelFree, toast]);

  const syncModels = useCallback(async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/admin/sync-models', { method: 'POST' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error?.message || 'Gagal melakukan sinkronisasi model');
      
      const data = json.data;
      await fetchModels(true);
      toast({
        title: 'Berhasil',
        description: `Berhasil sinkronisasi ${data.synced} model. Baru: ${data.new}, Diperbarui: ${data.updated}`
      });
      return { success: true, data };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [fetchModels, toast]);

  return {
    models,
    isSyncing,
    fetchModels,
    addModel,
    updateModelData,
    deleteModel,
    toggleFreeStatus,
    syncModels,
  };
}
