'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Search,
  X,
  ArrowUpDown,
  Check,
  Copy,
  Ban,
  AlertTriangle,
  Percent,
  Gift,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Brain,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChatStore, type Model } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import {
  getProviderIcon,
  formatPrice,
  getEffectivePrice,
  formatContext,
  SPEED_CONFIG,
  getProviderColor,
  normalizeProviderName,
  SORT_OPTIONS,
  type SortOption,
  type FilterTab,
} from '@/lib/model-utils';

const pageSize = 50;

export default function ModelsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { activeModel, setActiveModel, models, reasoningLevel, setReasoningLevel } = useChatStore();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('online');
  const [sort, setSort] = useState<SortOption>('default');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeModelData = models.find((m) => m.id === activeModel);

  // Visible models: only active + maintenance
  const visibleModels = useMemo(
    () => models.filter((m) => m.status === 'active' || m.status === 'maintenance'),
    [models]
  );

  const allProviders = useMemo(() => {
    const providers = new Set(visibleModels.map((m) => m.provider));
    return Array.from(providers).sort();
  }, [visibleModels]);

  // Filter logic
  const filteredModels = useMemo(() => {
    let result = visibleModels;

    if (filter === 'online') result = result.filter((m) => m.status === 'active');
    if (filter === 'free') result = result.filter((m) => m.free);
    if (filter === 'discount')
      result = result.filter((m) => m.discountPercent > 0 && m.discountType !== 'none');

    if (selectedProviders.length > 0) {
      result = result.filter((m) => selectedProviders.includes(m.provider));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [visibleModels, filter, search, selectedProviders]);

  // Sort logic
  const sortedModels = useMemo(() => {
    const result = [...filteredModels];

    switch (sort) {
      case 'default':
        result.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return a.name.localeCompare(b.name);
        });
        break;
      case 'expensive':
        result.sort((a, b) => b.outputPrice - a.outputPrice);
        break;
      case 'cheap':
        result.sort((a, b) => a.outputPrice - b.outputPrice);
        break;
      case 'fastest': {
        result.sort((a, b) => {
          const orderA = SPEED_CONFIG[a.speed]?.order || 99;
          const orderB = SPEED_CONFIG[b.speed]?.order || 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
        break;
      }
      case 'slowest': {
        result.sort((a, b) => {
          const orderA = SPEED_CONFIG[a.speed]?.order || 0;
          const orderB = SPEED_CONFIG[b.speed]?.order || 0;
          if (orderA !== orderB) return orderB - orderA;
          return a.name.localeCompare(b.name);
        });
        break;
      }
    }

    return result;
  }, [filteredModels, sort]);

  const totalPages = Math.ceil(sortedModels.length / pageSize);
  const paginatedModels = useMemo(
    () => sortedModels.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sortedModels, currentPage]
  );

  // Group by provider for separator rows
  const groupedModels = useMemo(() => {
    const groups: Record<string, Model[]> = {};
    paginatedModels.forEach((m) => {
      if (!groups[m.provider]) groups[m.provider] = [];
      groups[m.provider].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [paginatedModels]);

  // Derived counts for filter tabs
  const onlineCount = models.filter((m) => m.status === 'active').length;
  const freeCount = visibleModels.filter((m) => m.free).length;
  const discountCount = visibleModels.filter((m) => m.discountPercent > 0 && m.discountType !== 'none').length;

  // Toggle provider filter
  const toggleProvider = useCallback((provider: string) => {
    setSelectedProviders((prev) =>
      prev.includes(provider) ? prev.filter((p) => p !== provider) : [...prev, provider]
    );
  }, []);

  // Select model and navigate back
  const handleSelect = useCallback(
    (modelId: string) => {
      const model = models.find((m) => m.id === modelId);
      if (model?.status === 'active') {
        setActiveModel(modelId);
        if (!model.thinking) {
          setReasoningLevel('off');
        } else if (reasoningLevel === 'off') {
          setReasoningLevel('medium');
        }
        router.push('/');
      }
    },
    [models, setActiveModel, setReasoningLevel, reasoningLevel, router]
  );

  // Copy public ID
  const handleCopyPublicId = useCallback(
    (publicId: string, modelId: string) => {
      navigator.clipboard.writeText(publicId).catch(() => {});
      setCopiedId(modelId);
      toast({ title: 'Tersalin!', description: `Public ID "${publicId}" telah disalin` });
      setTimeout(() => setCopiedId(null), 2000);
    },
    [toast]
  );

  // Clear search
  const clearSearch = useCallback(() => {
    setSearch('');
    setCurrentPage(1);
  }, []);

  // Navigate back
  const goBack = useCallback(() => {
    router.push('/');
  }, [router]);

  // ── Render Helper: Model Card as Table Row ──
  const renderModelRow = (model: Model, idx: number, globalOffset: number) => {
    const isSelected = activeModel === model.id;
    const isOnline = model.status === 'active';
    const isMaintenance = model.status === 'maintenance';
    const speedCfg = SPEED_CONFIG[model.speed];
    const SpeedIcon = speedCfg?.icon || Cpu;
    const hasDiscount = model.discountPercent > 0 && model.discountType !== 'none';
    const effInput = getEffectivePrice(model.inputPrice, model.discountPercent, model.discountType, false);
    const effOutput = getEffectivePrice(model.outputPrice, model.discountPercent, model.discountType, true);
    const ProviderIcon = getProviderIcon(model.provider);

    return (
      <TableRow
        key={model.id}
        className={`transition-colors ${
          isSelected ? 'bg-primary/5 border-primary/10' : ''
        } ${!isOnline ? 'opacity-60' : ''}`}
      >
        {/* No */}
        <TableCell className="text-center text-xs text-muted-foreground tabular-nums w-12">
          {globalOffset + idx + 1}
        </TableCell>

        {/* Model name + Icon + publicId + Copy */}
        <TableCell className="min-w-[200px]">
          <div className="flex items-start gap-2.5">
            <ProviderIcon size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              {/* Baris 1: nama + badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-bold truncate">{model.name}</span>
                {model.free && (
                  <Badge
                    variant="secondary"
                    className="text-[7px] px-1 py-0 leading-tight bg-primary/8 text-primary/80 dark:text-primary/70 font-bold shrink-0"
                  >
                    <Gift className="h-2 w-2 mr-0.5" />
                    FREE
                  </Badge>
                )}
              </div>
              {/* Baris 2: publicId + copy */}
              <div className="flex items-center gap-1 mt-0.5">
                <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px]">
                  {model.publicId || model.id}
                </code>
                <button
                  onClick={() => handleCopyPublicId(model.publicId || model.id, model.id)}
                  className="shrink-0 hover:bg-accent rounded p-0.5 transition-colors"
                  title="Salin Public ID"
                >
                  {copiedId === model.id ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3 text-muted-foreground/40 hover:text-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </TableCell>

        {/* Speed */}
        <TableCell className="text-center w-24">
          {speedCfg ? (
            <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${speedCfg.color}`}>
              <SpeedIcon className="h-3 w-3" />
              {speedCfg.label}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </TableCell>

        {/* Input Price */}
        <TableCell className="text-right w-28">
          {model.free ? (
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
            >
              Free
            </Badge>
          ) : hasDiscount && (model.discountType === 'input' || model.discountType === 'both') ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="line-through text-muted-foreground/35 text-[10px] font-mono">
                {formatPrice(model.inputPrice)}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs font-mono tabular-nums">
                  {formatPrice(effInput)}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[7px] px-1 py-0 leading-tight bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 font-extrabold shrink-0"
                >
                  -{model.discountPercent}%
                </Badge>
              </span>
            </div>
          ) : (
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {formatPrice(model.inputPrice)}
            </span>
          )}
        </TableCell>

        {/* Output Price */}
        <TableCell className="text-right w-28">
          {model.free ? (
            <Badge
              variant="secondary"
              className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
            >
              Free
            </Badge>
          ) : hasDiscount && (model.discountType === 'output' || model.discountType === 'both') ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="line-through text-muted-foreground/35 text-[10px] font-mono">
                {formatPrice(model.outputPrice)}
              </span>
              <span className="flex items-center gap-1">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-xs font-mono tabular-nums">
                  {formatPrice(effOutput)}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[7px] px-1 py-0 leading-tight bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 font-extrabold shrink-0"
                >
                  -{model.discountPercent}%
                </Badge>
              </span>
            </div>
          ) : (
            <span className="text-xs font-mono tabular-nums text-muted-foreground">
              {formatPrice(model.outputPrice)}
            </span>
          )}
        </TableCell>

        {/* Thinking */}
        <TableCell className="text-center w-20">
          {model.thinking ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Brain className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium">Ya</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/40">—</span>
          )}
        </TableCell>

        {/* Max Context */}
        <TableCell className="text-right w-20">
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatContext(model.maxContext)}
          </span>
        </TableCell>

        {/* Action */}
        <TableCell className="text-center w-28">
          {isMaintenance ? (
            <Badge
              variant="secondary"
              className="text-[9px] px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 gap-1"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              Maintenance
            </Badge>
          ) : model.status === 'disabled' ? (
            <Badge
              variant="secondary"
              className="text-[9px] px-2 py-0.5 bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 gap-1"
            >
              <Ban className="h-2.5 w-2.5" />
              Disabled
            </Badge>
          ) : (
            <Button
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              className="h-7 text-[10px] px-3 gap-1"
              onClick={() => handleSelect(model.id)}
            >
              {isSelected && <Check className="h-3 w-3" />}
              {isSelected ? 'Aktif' : 'Gunakan'}
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  // ── Empty State ──
  if (models.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">Memuat model...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/5">
        <div className="px-6 py-4 flex flex-col gap-3">
          {/* Top bar: back + title + model info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={goBack}
                className="h-8 w-8 p-0 rounded-full hover:bg-accent/60"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-base font-bold">Katalog Model</h1>
                <p className="text-[11px] text-muted-foreground/70">
                  {activeModelData
                    ? `Aktif: ${activeModelData.name} (${activeModelData.provider})`
                    : 'Pilih model untuk percakapan'}
                </p>
              </div>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari model, provider, atau fitur..."
                className="pl-9 h-9 text-sm rounded-lg bg-muted/20 border-border/30 focus:border-primary/30"
              />
              {search && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-full bg-muted/50 hover:bg-muted text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filter tabs + Sort + Provider filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filter tabs — Online, Free, Discount */}
              {([
                { id: 'online' as FilterTab, label: 'Online', count: onlineCount },
                { id: 'free' as FilterTab, label: 'Free', count: freeCount },
                { id: 'discount' as FilterTab, label: 'Diskon', count: discountCount },
              ]).map((tab) => {
                const isActive = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/25 text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground'
                    }`}
                  >
                    {tab.label}
                    <span className={`text-[10px] tabular-nums ${isActive ? 'text-primary-foreground/70' : 'text-muted-foreground/50'}`}>
                      {isActive ? `(${tab.count})` : `(${tab.count})`}
                    </span>
                  </button>
                );
              })}

              <div className="h-5 w-px bg-border/30" />

              {/* Sort options */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      sort !== 'default'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/25 text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    {SORT_OPTIONS.find((s) => s.id === sort)?.label || 'Urutkan'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  {SORT_OPTIONS.map((opt) => (
                    <DropdownMenuCheckboxItem
                      key={opt.id}
                      checked={sort === opt.id}
                      onCheckedChange={() => setSort(opt.id)}
                    >
                      {opt.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Provider filter dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedProviders.length > 0
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/25 text-muted-foreground hover:bg-accent/60'
                    }`}
                  >
                    <Cpu className="h-3.5 w-3.5" />
                    {selectedProviders.length > 0
                      ? `Provider (${selectedProviders.length})`
                      : 'Provider'}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[140px]">
                  {allProviders.map((provider) => (
                    <DropdownMenuCheckboxItem
                      key={provider}
                      checked={selectedProviders.includes(provider)}
                      onCheckedChange={() => toggleProvider(provider)}
                    >
                      {provider}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div className="flex-1 overflow-x-auto px-6 py-4">
        {sortedModels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Cpu className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Tidak ada model ditemukan</p>
            {search && (
              <Button variant="outline" size="sm" onClick={clearSearch}>
                Hapus pencarian
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center w-12">No</TableHead>
                <TableHead className="min-w-[200px]">Model</TableHead>
                <TableHead className="text-center w-24">Speed</TableHead>
                <TableHead className="text-right w-28">Input /mTok</TableHead>
                <TableHead className="text-right w-28">Output /mTok</TableHead>
                <TableHead className="text-center w-20">Thinking</TableHead>
                <TableHead className="text-right w-20">Context</TableHead>
                <TableHead className="text-center w-28">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedModels.reduce<React.ReactNode[]>((acc, [provider, providerModels]) => {
                const globalOffset = sortedModels.indexOf(providerModels[0]);
                // Separator
                const ProviderIcon = getProviderIcon(provider);
                acc.push(
                  <TableRow key={`sep-${provider}`} className="border-0 hover:bg-transparent">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ProviderIcon size={24} className="shrink-0 text-muted-foreground/70" />
                        <Badge
                          variant="secondary"
                          className={`text-xs px-2 py-0.5 ${
                            getProviderColor(provider) || 'bg-muted/40 text-muted-foreground'
                          }`}
                        >
                          {normalizeProviderName(provider)}
                        </Badge>
                        <span className="text-xs text-muted-foreground/50 tabular-nums">
                          {providerModels.length} model{providerModels.length !== 1 ? 's' : ''}
                        </span>
                        <div className="flex-1 h-px bg-border/30" />
                      </div>
                    </td>
                  </TableRow>
                );
                // Its model rows
                providerModels.forEach((model, idx) => {
                  acc.push(renderModelRow(model, idx, globalOffset));
                });
                return acc;
              }, [])}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── PAGINATION ── */}
      {totalPages > 1 && (
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/5 px-6 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              Halaman {currentPage} dari {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-8 text-xs gap-1"
              >
                <ChevronLeft className="h-3 w-3" />
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 text-xs gap-1"
              >
                Selanjutnya
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEGEND ── */}
      <div className="px-6 py-3 border-t border-border/5">
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground/60 flex-wrap">
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3 text-green-500" /> Model aktif
          </span>
          <span className="flex items-center gap-1">
            <Percent className="h-3 w-3 text-emerald-500" /> Diskon
          </span>
          <span className="flex items-center gap-1">
            <Gift className="h-3 w-3 text-primary/60" /> Model gratis
          </span>
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Maintenance
          </span>
          <span className="flex items-center gap-1">
            <Ban className="h-3 w-3 text-red-500" /> Disabled
          </span>
          <span className="flex items-center gap-1">
            <Brain className="h-3 w-3 text-amber-500" /> Mendukung thinking
          </span>
        </div>
      </div>
    </div>
  );
}
