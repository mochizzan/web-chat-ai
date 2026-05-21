'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Cpu, Search, Filter, RefreshCw, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Model } from '@/lib/store';
import type { ModelFilter } from '@/lib/admin-types';

interface AdminModelsTableProps {
  models: Model[];
  onToggleFree: (id: string) => void;
  onRemove: (id: string) => void;
  onPullModels: () => Promise<void>;
  isSyncing: boolean;
}

export function AdminModelsTable({
  models,
  onToggleFree,
  onRemove,
  onPullModels,
  isSyncing,
}: AdminModelsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ModelFilter>('all');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const activeCount = (models || []).filter((m) => m.status === 'active').length;
  const maintenanceCount = (models || []).filter((m) => m.status === 'maintenance').length;
  const disabledCount = (models || []).filter((m) => m.status === 'disabled').length;
  const freeCount = (models || []).filter((m) => m.free).length;

  const providers = useMemo(() => {
    const set = new Set((models || []).map((m) => m.provider));
    return Array.from(set).sort();
  }, [models]);

  const filteredModels = useMemo(() => {
    return (models || []).filter((model) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          model.name.toLowerCase().includes(q) ||
          model.provider.toLowerCase().includes(q) ||
          model.description.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      switch (activeFilter) {
        case 'active':
          if (model.status !== 'active') return false;
          break;
        case 'maintenance':
          if (model.status !== 'maintenance') return false;
          break;
        case 'disabled':
          if (model.status !== 'disabled') return false;
          break;
        case 'free':
          if (!model.free) return false;
          break;
        case 'paid':
          if (model.free) return false;
          break;
      }
      if (providerFilter !== 'all' && model.provider !== providerFilter) {
        return false;
      }
      return true;
    });
  }, [models, searchQuery, activeFilter, providerFilter]);

  const totalPages = Math.ceil(filteredModels.length / pageSize);
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredModels.slice(start, start + pageSize);
  }, [filteredModels, currentPage]);

  useEffect(() => {
    if (currentPage !== 1) {
      const timer = setTimeout(() => setCurrentPage(1), 0);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeFilter, providerFilter, currentPage]);

  const filterButtons: { id: ModelFilter; label: string }[] = [
    { id: 'all', label: 'Semua' },
    { id: 'active', label: 'Aktif' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'disabled', label: 'Disabled' },
    { id: 'free', label: 'Gratis' },
    { id: 'paid', label: 'Berbayar' },
  ];

  const speedLabel: Record<string, string> = { fast: 'Cepat', normal: 'Normal', slow: 'Lambat', overloaded: 'Overload' };
  const speedColor: Record<string, string> = {
    fast: 'text-emerald-600 dark:text-emerald-400',
    normal: 'text-sky-600 dark:text-sky-400',
    slow: 'text-amber-600 dark:text-amber-400',
    overloaded: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Manajemen Model</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(models || []).length} model · {activeCount} aktif · {maintenanceCount} maintenance · {disabledCount} disabled · {freeCount} gratis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={onPullModels} disabled={isSyncing}>
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Pull Models'}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Cari model, provider, atau deskripsi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-sm"
            />
          </div>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Provider</SelectItem>
              {providers.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground/50" />
          {filterButtons.map((btn) => (
            <Button
              key={btn.id}
              variant={activeFilter === btn.id ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setActiveFilter(btn.id)}
            >
              {btn.label}
            </Button>
          ))}
          {filteredModels.length !== (models || []).length && (
            <span className="text-xs text-muted-foreground ml-2">
              Menampilkan {filteredModels.length} dari {(models || []).length}
            </span>
          )}
        </div>
      </div>

      <Card className="border-border/40">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Model</TableHead>
                <TableHead className="text-xs font-semibold">Provider</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-center">Kecepatan</TableHead>
                <TableHead className="text-xs font-semibold text-center">Diskon</TableHead>
                <TableHead className="text-xs font-semibold text-right">Input Price</TableHead>
                <TableHead className="text-xs font-semibold text-right">Output Price</TableHead>
                <TableHead className="text-xs font-semibold text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Tidak ada model yang cocok dengan filter</p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedModels.map((model) => {
                  const hasDiscount = (model.discountPercent ?? 0) > 0 && model.discountType !== 'none';
                  return (
                    <TableRow key={model.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{model.name}</p>
                            <p className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">{model.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{model.provider}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {model.status === 'active' && (
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">Active</Badge>
                        )}
                        {model.status === 'maintenance' && (
                          <Badge className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-semibold">Maintenance</Badge>
                        )}
                        {model.status === 'disabled' && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-[11px] font-semibold ${speedColor[model.speed] || 'text-muted-foreground'}`}>
                          {speedLabel[model.speed] || model.speed}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {hasDiscount ? (
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold">
                            -{model.discountPercent}% ({model.discountType === 'both' ? 'IN/OUT' : model.discountType === 'input' ? 'IN' : 'OUT'})
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-mono text-foreground">${Number(model.inputPrice ?? 0).toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm font-mono text-foreground">${Number(model.outputPrice ?? 0).toFixed(2)}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemove(model.id)}
                            title="Hapus Model"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-muted-foreground">
            Halaman {currentPage} dari {totalPages} ({filteredModels.length} model)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ArrowLeft className="h-3 w-3" />
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Berikutnya
              <ArrowLeft className="h-3 w-3 rotate-180" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
