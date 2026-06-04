'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Cpu, AlertTriangle, Gift, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useChatStore } from '@/lib/store';
import { getProviderIcon } from '@/lib/model-utils';

export function ModelSelector() {
  const router = useRouter();
  const { activeModel, models } = useChatStore();
  const activeModelData = models.find((m) => m.id === activeModel);

  const handleOpen = useCallback(() => {
    router.push('/models');
  }, [router]);

  const triggerButtonClass = (() => {
    if (activeModelData?.status === 'maintenance') return 'border-amber-500/30 hover:border-amber-500/50 bg-amber-500/5';
    if (activeModelData?.status === 'disabled') return 'border-red-500/30 hover:border-red-500/50 bg-red-500/5';
    return 'border-border/30 hover:border-primary/40';
  })();

  const ProviderIcon = activeModelData ? getProviderIcon(activeModelData.provider) : Cpu;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpen}
      className={`h-7 gap-1.5 px-2.5 border text-xs font-semibold rounded-lg transition-all duration-200 ${triggerButtonClass}`}
    >
      <ProviderIcon size={14} className="shrink-0" />
      <span className="truncate max-w-[100px]">
        {activeModelData?.name || 'Pilih Model'}
      </span>
      {activeModelData?.status === 'maintenance' && (
        <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0">
          Maint
        </Badge>
      )}
      {activeModelData?.status === 'disabled' && (
        <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-red-500/10 text-red-600 dark:text-red-400 font-bold shrink-0">
          Disabled
        </Badge>
      )}
      {activeModelData && activeModelData.discountPercent > 0 && activeModelData.discountType !== 'none' && activeModelData.status === 'active' && (
        <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
          {activeModelData.discountPercent}% OFF
        </Badge>
      )}
      {activeModelData?.free && (
        <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-primary/8 text-primary/80 dark:text-primary/70 font-bold shrink-0">
          Free
        </Badge>
      )}
    </Button>
  );
}
