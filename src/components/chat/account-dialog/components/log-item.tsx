import { ChevronDown, ChevronUp, Cpu, Globe, Clock, ArrowDown, ArrowUp, DollarSign, Hash, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { UsageLogEntry } from '@/lib/store';
import { formatFullTime, formatCompact, formatCurrencyShort, formatNumber } from '../utils';
import { PROVIDER_COLORS } from '../constants';

interface LogItemProps {
  log: UsageLogEntry;
  isExpanded: boolean;
  onToggle: () => void;
}

export function LogItem({ log, isExpanded, onToggle }: LogItemProps) {
  const logTotalCost = log.totalCost ?? 0;
  const isApi = log.source === 'api';

  return (
    <div className={`group rounded-xl border transition-all ${
      isApi
        ? 'border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/30'
        : 'border-border/20 bg-card/40 hover:border-primary/10'
    }`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3.5 text-left"
      >
        {/* Model icon */}
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
          isApi ? 'bg-amber-500/10' : 'bg-muted/30'
        }`}>
          {isApi ? (
            <Globe className="h-4 w-4 text-amber-500/70" />
          ) : (
            <Cpu className="h-4 w-4 text-primary/60" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-foreground truncate">
              {log.modelName || 'Unknown'}
            </span>
            {isApi ? (
              <Badge
                variant="outline"
                className="text-[9px] px-1 py-0 shrink-0 border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10"
              >
                🔑 API
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className={`text-[9px] px-1 py-0 shrink-0 ${PROVIDER_COLORS[log.provider] || ''}`}
              >
                {log.provider || '?'}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[11px] text-muted-foreground/60">
                {formatFullTime(log.createdAt)}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/30">·</span>
            <span className="text-[11px] text-muted-foreground/60">
              {formatCompact((log.inputTokens ?? 0) + (log.outputTokens ?? 0))} tok
            </span>
          </div>
        </div>

        {/* Cost */}
        <div className="text-right shrink-0">
          <p className={`text-xs font-bold font-mono ${logTotalCost > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
            -{formatCurrencyShort(logTotalCost)}
          </p>
        </div>

        {/* Expand chevron */}
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-0">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/15 p-3 border border-border/10">
            <div className="flex items-center gap-2">
              <ArrowDown className="h-3.5 w-3.5 text-primary/50 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground/50">Input</p>
                <p className="text-xs font-semibold text-foreground">{formatNumber(log.inputTokens)} <span className="text-muted-foreground/40 font-normal">tok</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUp className="h-3.5 w-3.5 text-amber-500/50 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground/50">Output</p>
                <p className="text-xs font-semibold text-foreground">{formatNumber(log.outputTokens)} <span className="text-muted-foreground/40 font-normal">tok</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground/50">Input Cost</p>
                <p className="text-xs font-semibold text-foreground font-mono">{formatCurrencyShort(log.inputCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground/50">Output Cost</p>
                <p className="text-xs font-semibold text-foreground font-mono">{formatCurrencyShort(log.outputCost)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground/50">Kategori</p>
                <p className="text-xs font-semibold text-foreground capitalize">{log.category || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground/50">Waktu</p>
                <p className="text-xs font-semibold text-foreground">{formatFullTime(log.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}