'use client';

import { useCallback, useState, useMemo } from 'react';
import {
  Check,
  Cpu,
  Brain,
  Lock,
  Lightbulb,
  Search,
  X,
  Gift,
  ArrowLeft,
  Filter,
  ArrowUpDown,
  Info,
  Ban,
  Zap,
  Clock,
  AlertTriangle,
  Gauge,
  Percent,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChatStore, type Model } from '@/lib/store';

// Provider badge colors - soft, MD3 muted
const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-primary/8 text-primary/80 dark:text-primary/70',
  Anthropic: 'bg-stone-500/8 text-stone-600/80 dark:text-stone-400/60',
  Google: 'bg-sky-600/8 text-sky-700/80 dark:text-sky-400/60',
  DeepSeek: 'bg-violet-600/8 text-violet-700/80 dark:text-violet-400/60',
  Meta: 'bg-orange-600/8 text-orange-700/80 dark:text-orange-400/60',
  xAI: 'bg-rose-600/8 text-rose-700/80 dark:text-rose-400/60',
  Mistral: 'bg-cyan-600/8 text-cyan-700/80 dark:text-cyan-400/60',
};

// Speed tier configuration with icons and colors
const SPEED_CONFIG: Record<string, { label: string; icon: typeof Zap; color: string; bgColor: string; order: number }> = {
  fast: { label: 'Cepat', icon: Zap, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', order: 1 },
  normal: { label: 'Normal', icon: Gauge, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-500/8', order: 2 },
  slow: { label: 'Lambat', icon: Clock, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10', order: 3 },
  overloaded: { label: 'Overload', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/12', order: 4 },
};

// Format context size
function formatContext(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return `${tokens}`;
}

// Format price for display (short form)
function formatPrice(price: number): string {
  if (price >= 100) return `$${price.toFixed(0)}`;
  if (price >= 10) return `$${price.toFixed(1)}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.001) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

// Calculate effective price after discount
function getEffectivePrice(originalPrice: number, discountPercent: number, discountType: string, isOutput: boolean): number {
  if (discountPercent <= 0) return originalPrice;
  if (discountType === 'both') return originalPrice * (1 - discountPercent / 100);
  if (isOutput && discountType === 'output') return originalPrice * (1 - discountPercent / 100);
  if (!isOutput && discountType === 'input') return originalPrice * (1 - discountPercent / 100);
  return originalPrice;
}

// Price hint component with tooltip - enhanced with discount info
function PriceHint({ inputPrice, outputPrice, free, discountPercent, discountType }: {
  inputPrice: number;
  outputPrice: number;
  free: boolean;
  discountPercent: number;
  discountType: string;
}) {
  const hasDiscount = discountPercent > 0 && discountType !== 'none';
  const effInput = getEffectivePrice(inputPrice, discountPercent, discountType, false);
  const effOutput = getEffectivePrice(outputPrice, discountPercent, discountType, true);

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-[10px] inline-flex items-center gap-1 cursor-help">
            {free ? (
              <>
                <span className="line-through text-muted-foreground/40">
                  IN {formatPrice(inputPrice)} - OUT {formatPrice(outputPrice)}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 ml-1">Free</span>
              </>
            ) : hasDiscount ? (
              <>
                <span className="line-through text-muted-foreground/40">
                  IN {formatPrice(inputPrice)} - OUT {formatPrice(outputPrice)}
                </span>
                <span className="font-semibold text-primary/80 dark:text-primary/70 ml-1">
                  IN {formatPrice(effInput)} - OUT {formatPrice(effOutput)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground/60">
                IN {formatPrice(inputPrice)} - OUT {formatPrice(outputPrice)}
              </span>
            )}
            <Info className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="center" sideOffset={4} className="max-w-[240px] text-xs leading-relaxed p-3 bg-popover border border-border/50 shadow-lg">
          {free ? (
            <p>Model ini <strong className="text-emerald-500">gratis</strong> — tidak ada biaya untuk setiap pesan yang dikirim.</p>
          ) : (
            <>
              <p className="font-semibold mb-1.5 text-foreground">Biaya per 1 Juta Token</p>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><strong className="text-foreground">IN</strong> (Input):</span>
                  <span className={`font-mono font-medium text-foreground ${hasDiscount && (discountType === 'input' || discountType === 'both') ? 'line-through text-muted-foreground/50' : ''}`}>
                    {formatPrice(inputPrice)}
                  </span>
                </div>
                {hasDiscount && (discountType === 'input' || discountType === 'both') && (
                  <div className="flex items-center justify-between bg-emerald-500/10 rounded px-1.5 py-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">Setelah diskon {discountPercent}%:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatPrice(effInput)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground"><strong className="text-foreground">OUT</strong> (Output):</span>
                  <span className={`font-mono font-medium text-foreground ${hasDiscount && (discountType === 'output' || discountType === 'both') ? 'line-through text-muted-foreground/50' : ''}`}>
                    {formatPrice(outputPrice)}
                  </span>
                </div>
                {hasDiscount && (discountType === 'output' || discountType === 'both') && (
                  <div className="flex items-center justify-between bg-emerald-500/10 rounded px-1.5 py-0.5">
                    <span className="text-emerald-600 dark:text-emerald-400 text-[10px]">Setelah diskon {discountPercent}%:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatPrice(effOutput)}</span>
                  </div>
                )}
              </div>
              {hasDiscount && (
                <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 -mx-3 -mb-3 px-3 py-2 rounded-b-lg">
                  <Percent className="h-3 w-3" />
                  <span className="font-bold text-[11px]">Diskon {discountPercent}% ({discountType === 'both' ? 'Input & Output' : discountType === 'input' ? 'Input saja' : 'Output saja'})</span>
                </div>
              )}
              <p className="mt-1.5 text-muted-foreground/60 text-[10px]">1M token ≈ 750.000 kata.</p>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Filter tabs
type FilterTab = 'online' | 'free' | 'discount';

// Sort options
type SortOption = 'default' | 'expensive' | 'cheap' | 'fastest' | 'slowest';

const SORT_OPTIONS: { id: SortOption; label: string }[] = [
  { id: 'default', label: 'Default (A-Z)' },
  { id: 'expensive', label: 'Termahal' },
  { id: 'cheap', label: 'Termurah' },
  { id: 'fastest', label: 'Tercepat' },
  { id: 'slowest', label: 'Terlambat' },
];

export function ModelSelector() {
  const { activeModel, setActiveModel, models } = useChatStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterTab>('online');
  const [sort, setSort] = useState<SortOption>('default');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const activeModelData = models.find((m) => m.id === activeModel);

  // All available providers (dari model yang visible — active/maintenance only)
  const visibleModels = useMemo(() => {
    return models.filter((m) => m.status === 'active' || m.status === 'maintenance');
  }, [models]);

  const allProviders = useMemo(() => {
    const providers = new Set(visibleModels.map((m) => m.provider));
    return Array.from(providers).sort();
  }, [visibleModels]);

  // Filter and search — base: hanya active + maintenance, disabled di-exclude
  const filteredModels = useMemo(() => {
    // BASE: hanya model active + maintenance
    let result = visibleModels;

    // Filter tab
    if (filter === 'online') result = result.filter((m) => m.status === 'active');
    if (filter === 'free') result = result.filter((m) => m.free);
    if (filter === 'discount') result = result.filter((m) => m.discountPercent > 0 && m.discountType !== 'none');

    // Provider filter
    if (selectedProviders.length > 0) {
      result = result.filter((m) => selectedProviders.includes(m.provider));
    }

    // Search
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

  // Sort models
  const sortedModels = useMemo(() => {
    const result = [...filteredModels];

    switch (sort) {
      case 'default': {
        // DEFAULT: active A-Z dulu, lalu maintenance A-Z
        result.sort((a, b) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return a.name.localeCompare(b.name);
        });
        break;
      }
      case 'expensive':
        result.sort((a, b) => b.outputPrice - a.outputPrice);
        break;
      case 'cheap':
        result.sort((a, b) => a.outputPrice - b.outputPrice);
        break;
      case 'fastest':
        result.sort((a, b) => {
          const orderA = SPEED_CONFIG[a.speed]?.order || 99;
          const orderB = SPEED_CONFIG[b.speed]?.order || 99;
          if (orderA !== orderB) return orderA - orderB;
          return a.name.localeCompare(b.name);
        });
        break;
      case 'slowest':
        result.sort((a, b) => {
          const orderA = SPEED_CONFIG[a.speed]?.order || 0;
          const orderB = SPEED_CONFIG[b.speed]?.order || 0;
          if (orderA !== orderB) return orderB - orderA;
          return a.name.localeCompare(b.name);
        });
        break;
      default:
        break;
    }
    return result;
  }, [filteredModels, sort]);

  // Pagination
  const totalPages = Math.ceil(sortedModels.length / pageSize);
  const paginatedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedModels.slice(start, start + pageSize);
  }, [sortedModels, currentPage]);

  // Group by provider (only when sort is default)
  const groupedModels = useMemo(() => {
    if (sort !== 'default') return [];
    const groups: Record<string, Model[]> = {};
    paginatedModels.forEach((m) => {
      const key = m.provider;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [paginatedModels, sort]);

  const onlineCount = models.filter((m) => m.status === 'active').length;
  const freeCount = visibleModels.filter((m) => m.free).length;
  const discountCount = visibleModels.filter((m) => m.discountPercent > 0 && m.discountType !== 'none').length;

  // Reset on close
  const handleOpenChange = useCallback((isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSearch('');
      setFilter('online');
      setSort('default');
      setSelectedProviders([]);
      setCurrentPage(1);
    }
  }, []);

  // Select model and close — hanya active yang bisa dipilih
  const handleSelect = useCallback(
    (modelId: string) => {
      const model = models.find((m) => m.id === modelId);
      if (model?.status === 'active') {
        setActiveModel(modelId);
        setOpen(false);
      }
    },
    [models, setActiveModel]
  );

  // Toggle provider filter
  const toggleProvider = useCallback((provider: string) => {
    setSelectedProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  }, []);

  // ===== MODERN CARD RENDERER =====
  const renderModelCard = (model: Model) => {
    const isSelected = activeModel === model.id;
    const isOnline = model.status === 'active';
    const isMaintenance = model.status === 'maintenance';
    const speedCfg = SPEED_CONFIG[model.speed];
    const SpeedIcon = speedCfg?.icon || Gauge;
    const hasDiscount = model.discountPercent > 0 && model.discountType !== 'none';

    return (
      <button
        key={model.id}
        onClick={() => handleSelect(model.id)}
        className={`
          group relative w-full text-left rounded-xl border transition-all duration-200 overflow-hidden
          ${isMaintenance
            ? 'opacity-55 cursor-not-allowed border-red-500/20 bg-red-500/[0.02]'
            : isSelected
            ? 'border-primary/30 bg-primary/[0.04] ring-1 ring-primary/15 cursor-pointer shadow-sm'
            : 'border-border/20 bg-card hover:border-border/40 hover:shadow-sm hover:bg-accent/10 cursor-pointer'
          }
        `}
      >
        {/* Speed indicator bar on top */}
        {isOnline && speedCfg && (
          <div className={`h-0.5 w-full ${speedCfg.bgColor.replace('/10', '/30').replace('/8', '/20').replace('/12', '/35')}`} />
        )}

        <div className="p-2.5">
          {/* Row 1: Name + Provider badge + Selected check */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`text-xs font-bold leading-tight ${!isOnline ? 'text-muted-foreground' : 'text-foreground'} truncate`}>
              {model.name}
            </span>
            <Badge
              variant="secondary"
              className={`text-[8px] px-1 py-0 leading-tight font-medium shrink-0 ${PROVIDER_COLORS[model.provider] || 'bg-muted/40 text-muted-foreground'}`}
            >
              {model.provider}
            </Badge>
            {isSelected && (
              <Check className="h-3 w-3 text-primary/70 shrink-0" strokeWidth={3} />
            )}
          </div>

          {/* Row 2: Description + inline badges — single line */}
          <div className="mt-0.5 flex items-center gap-1.5 min-w-0">
            <p className={`text-[10px] leading-relaxed truncate flex-1 ${!isOnline ? 'text-muted-foreground/35' : 'text-muted-foreground/60'}`}>
              {model.description}
            </p>
            {/* Discount badge inline — mencolok */}
            {hasDiscount && isOnline && (
              <Badge
                variant="secondary"
                className="text-[8px] px-1 py-0 leading-tight bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 font-extrabold shrink-0 border border-emerald-500/15"
              >
                <Percent className="h-2 w-2 mr-0.5" />
                -{model.discountPercent}%
              </Badge>
            )}
            {/* FREE badge inline */}
            {model.free && isOnline && (
              <Badge
                variant="secondary"
                className="text-[8px] px-1 py-0 leading-tight bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0"
              >
                <Gift className="h-2 w-2 mr-0.5" />
                FREE
              </Badge>
            )}
            {/* Thinking badge inline */}
            {model.thinking && isOnline && (
              <Badge
                variant="secondary"
                className="text-[8px] px-1 py-0 leading-tight bg-amber-500/8 text-amber-600/80 dark:text-amber-400/70 shrink-0"
              >
                <Lightbulb className="h-2 w-2 mr-0.5" />
                Think
              </Badge>
            )}
            {/* Maintenance badge inline */}
            {isMaintenance && (
              <Badge
                variant="secondary"
                className="text-[8px] px-1 py-0 leading-tight bg-red-500/15 text-red-600/90 dark:text-red-400/80 font-semibold border border-red-500/20 shrink-0"
              >
                <Lock className="h-2 w-2 mr-0.5" />
                Maintenance
              </Badge>
            )}
          </div>

          {/* Separator */}
          <div className="my-1.5 border-t border-border/10" />

          {/* Row 4: Specs grid — 2-column compact */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
            {/* Speed — compact inline */}
            {isOnline && speedCfg && (
              <div className="flex items-center gap-1">
                <SpeedIcon className={`h-2.5 w-2.5 ${speedCfg.color}`} />
                <span className={`text-[9px] font-medium ${speedCfg.color}`}>
                  {speedCfg.label}
                </span>
              </div>
            )}

            {/* Context size — compact inline */}
            <div className="flex items-center gap-1">
              <Brain className="h-2.5 w-2.5 text-muted-foreground/50" />
              <span className="text-[9px] font-medium text-muted-foreground/60">
                {formatContext(model.maxContext)}
              </span>
            </div>

            {/* Pricing row (spans 2 cols) */}
            <div className="col-span-2 flex items-center justify-between gap-1">
              <PriceHint
                inputPrice={model.inputPrice}
                outputPrice={model.outputPrice}
                free={model.free}
                discountPercent={model.discountPercent}
                discountType={model.discountType}
              />
            </div>
          </div>

          {/* Overloaded indicator — compact inline */}
          {model.speed === 'overloaded' && isOnline && (
            <div className="flex items-center gap-1 rounded-md bg-red-500/8 px-1.5 py-0.5">
              <AlertTriangle className="h-2.5 w-2.5 text-red-500/60 shrink-0" />
              <span className="text-[8px] font-medium text-red-600/70 dark:text-red-400/70">
                Overloaded
              </span>
            </div>
          )}
        </div>
      </button>
    );
  };

  // Render flat list (when sorted)
  const renderFlatList = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
      {paginatedModels.map((model) => renderModelCard(model))}
    </div>
  );

  // Render grouped list (default sort)
  const renderGroupedList = () => (
    <div className="space-y-4">
      {groupedModels.map(([provider, providerModels]) => (
        <div key={provider}>
          {/* Provider group header */}
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant="secondary"
              className={`text-[9px] px-1.5 py-0.5 ${PROVIDER_COLORS[provider] || 'bg-muted/40 text-muted-foreground'}`}
            >
              {provider}
            </Badge>
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">
              {providerModels.length} model{providerModels.length !== 1 ? 's' : ''}
            </span>
            <div className="flex-1 h-px bg-border/20" />
          </div>

          {/* Model cards — up to 4 per row on wide screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {providerModels.map((model) => renderModelCard(model))}
          </div>
        </div>
      ))}
    </div>
  );

  // Determine trigger button styling based on model status
  const triggerButtonClass = (() => {
    if (!activeModelData || activeModelData.status === 'active') {
      return 'gap-1.5 rounded-lg border-border/50 bg-card px-2 py-1 hover:bg-accent h-8 text-xs';
    }
    if (activeModelData.status === 'maintenance') {
      return 'gap-1.5 rounded-lg border-amber-500/40 bg-amber-500/[0.06] px-2 py-1 hover:bg-amber-500/[0.1] h-8 text-xs';
    }
    if (activeModelData.status === 'disabled') {
      return 'gap-1.5 rounded-lg border-red-500/40 bg-red-500/[0.06] px-2 py-1 hover:bg-red-500/[0.1] h-8 text-xs';
    }
    return 'gap-1.5 rounded-lg border-border/50 bg-card px-2 py-1 hover:bg-accent h-8 text-xs';
  })();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Trigger button */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className={triggerButtonClass}
      >
        <Cpu className={`h-3.5 w-3.5 shrink-0 ${
          activeModelData && activeModelData.status !== 'active'
            ? activeModelData.status === 'maintenance'
              ? 'text-amber-500'
              : 'text-red-500'
            : 'text-primary/70'
        }`} />
        <span className={`font-medium truncate max-w-[100px] sm:max-w-[160px] ${
          activeModelData && activeModelData.status !== 'active'
            ? activeModelData.status === 'maintenance'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
            : ''
        }`}>
          {activeModelData?.name || 'Pilih Model'}
        </span>
        {activeModelData?.status === 'maintenance' && (
          <Badge
            variant="secondary"
            className="text-[8px] px-1 py-0 leading-tight bg-amber-500/15 text-amber-600/90 dark:text-amber-400/80 font-semibold shrink-0 border border-amber-500/20"
          >
            <Lock className="h-2.5 w-2.5 mr-0.5" />
            Maintenance
          </Badge>
        )}
        {activeModelData?.status === 'disabled' && (
          <Badge
            variant="secondary"
            className="text-[8px] px-1 py-0 leading-tight bg-red-500/15 text-red-600/90 dark:text-red-400/80 font-semibold shrink-0 border border-red-500/20"
          >
            <Ban className="h-2.5 w-2.5 mr-0.5" />
            Disabled
          </Badge>
        )}
        {activeModelData?.free && activeModelData.status === 'active' && (
          <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-primary/8 text-primary/80 dark:text-primary/70 font-bold shrink-0">
            FREE
          </Badge>
        )}
        {activeModelData?.thinking && activeModelData.status === 'active' && (
          <Lightbulb className="h-3 w-3 text-amber-500 shrink-0 hidden sm:block" />
        )}
        {activeModelData && activeModelData.discountPercent > 0 && activeModelData.discountType !== 'none' && activeModelData.status === 'active' && (
          <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
            <Percent className="h-2 w-2 mr-0.5" />
            {activeModelData.discountPercent}%
          </Badge>
        )}
      </Button>

      {/* Modal */}
      <DialogContent className="sm:max-w-[860px] lg:max-w-[1000px] xl:max-w-[1120px] p-0 gap-0 max-h-[88vh] flex flex-col rounded-xl border border-border/40">
      <DialogTitle className="sr-only">Model Selection</DialogTitle>
      <DialogDescription className="sr-only">
        This dialog allows you to select a model for your chat.
      </DialogDescription>
        {/* Header row: title left, active model right — sticky top */}
        <div className="px-5 pr-10 pt-5 pb-3 flex items-start justify-between gap-4 bg-background/95 backdrop-blur-sm border-b border-border/5 rounded-t-xl">
          <DialogHeader className="space-y-1 p-0">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary/70" />
              Pilih Model AI
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Pilih model yang tersedia untuk percakapan Anda
            </DialogDescription>
          </DialogHeader>

          {/* Currently selected model — inline with header */}
          {activeModelData && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted/30 border border-border/20 shrink-0 max-w-[240px]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 shrink-0">
                <Cpu className="h-3.5 w-3.5 text-primary/70" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs font-bold text-foreground truncate">{activeModelData.name}</span>
                  <Badge
                    variant="secondary"
                    className={`text-[8px] px-1 py-0 leading-tight shrink-0 ${PROVIDER_COLORS[activeModelData.provider] || ''}`}
                  >
                    {activeModelData.provider}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {activeModelData.free && (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-primary/8 text-primary/80 dark:text-primary/70 font-bold shrink-0">
                      <Gift className="h-2 w-2 mr-0.5" />
                      FREE
                    </Badge>
                  )}
                  {activeModelData.thinking && (
                    <Badge variant="secondary" className="text-[8px] px-1 py-0 leading-tight bg-amber-500/8 text-amber-600/80 dark:text-amber-400/70 shrink-0">
                      <Lightbulb className="h-2 w-2 mr-0.5" />
                      Think
                    </Badge>
                  )}
                  <span className="text-[9px] text-muted-foreground/50">{formatContext(activeModelData.maxContext)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Search + Filters — sticky below header */}
        <div className="px-5 pb-3 pt-3 space-y-3 bg-background/95 backdrop-blur-sm">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari model, provider, atau fitur..."
              className="pl-9 h-9 text-sm rounded-lg bg-muted/20 border-border/30 focus:border-primary/30"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
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
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {/* Separator */}
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
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedProviders.length > 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/25 text-muted-foreground hover:bg-accent/60'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Provider
                  {selectedProviders.length > 0 && (
                    <span className="text-[10px] tabular-nums text-primary-foreground/70">
                      {selectedProviders.length}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[160px]">
                {allProviders.map((provider) => (
                  <DropdownMenuCheckboxItem
                    key={provider}
                    checked={selectedProviders.includes(provider)}
                    onCheckedChange={() => toggleProvider(provider)}
                  >
                    <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${PROVIDER_COLORS[provider]?.split(' ')[0] || 'bg-muted'}`} />
                    {provider}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Separator />

        {/* Scrollable: Model list + Pagination */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="px-5 py-4">
            {filteredModels.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Cpu className="h-12 w-12 text-muted-foreground/15 mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  Belum Ada Model AI Tersedia
                </p>
                <p className="text-xs text-muted-foreground/50 mt-1 max-w-[260px]">
                  Saat ini belum ada model AI yang aktif. Silakan hubungi admin untuk mengaktifkan model.
                </p>
              </div>
            ) : sort === 'default' ? (
              renderGroupedList()
            ) : (
              renderFlatList()
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground">
                  Halaman {currentPage} dari {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px] gap-1"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[10px] gap-1"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ArrowLeft className="h-3 w-3 rotate-180" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Separator + Compact Footer — fixed di luar scroll */}
        <Separator />
        <div className="px-5 py-2 bg-muted/[0.02]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-muted-foreground/35">
            <span>Free = tanpa biaya</span>
            <span className="w-px h-2.5 bg-border/20" />
            <span>Thinking = berpikir mendalam</span>
            <span className="w-px h-2.5 bg-border/20" />
            <span>Konteks = kapasitas ingatan</span>
            <span className="w-px h-2.5 bg-border/20" />
            <span>Kecepatan = cepat/normal/lambat</span>
            <span className="w-px h-2.5 bg-border/20" />
            <span>Diskon = harga setelah diskon</span>
            <span className="w-px h-2.5 bg-border/20" />
            <span>Harga = arahkan kursor</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
