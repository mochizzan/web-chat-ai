import { PlusCircle, Gift, MinusCircle, Settings, Clock, Printer } from 'lucide-react';
import type { CreditLogEntry } from '@/lib/store';
import type { ReactNode } from 'react';
import { formatFullTime, formatCurrencyShort } from '../utils';

const LOG_ITEM_CFG: Record<string, { label: string; icon: ReactNode; bgClass: string; textClass: string; badgeClass: string }> = {
  topup: {
    label: 'Top Up Kredit',
    icon: <PlusCircle className="h-4 w-4 text-emerald-500/80" />,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400/80',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400/70',
  },
  bonus: {
    label: 'Bonus Selamat Datang',
    icon: <Gift className="h-4 w-4 text-amber-500/80" />,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400/80',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400/70',
  },
  deduct: {
    label: 'Pengurangan Kredit',
    icon: <MinusCircle className="h-4 w-4 text-red-500/80" />,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-600 dark:text-red-400/80',
    badgeClass: 'bg-red-500/10 text-red-600 dark:text-red-400/70',
  },
  admin_set: {
    label: 'Penyesuaian Admin (Set)',
    icon: <Settings className="h-4 w-4 text-purple-500/80" />,
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-600 dark:text-purple-400/80',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400/70',
  },
  admin_adjust: {
    label: 'Penyesuaian Admin',
    icon: <Settings className="h-4 w-4 text-indigo-500/80" />,
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-600 dark:text-indigo-400/80',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400/70',
  },
};

interface CreditLogItemProps {
  log: CreditLogEntry;
  onPrint?: (log: CreditLogEntry) => void;
}

export function CreditLogItem({ log, onPrint }: CreditLogItemProps) {
  const cfg = LOG_ITEM_CFG[log.type] || LOG_ITEM_CFG.topup;
  const amountPrefix = log.amount >= 0 ? '+' : '';

  return (
    <div className="group rounded-xl border border-border/20 bg-card/40 hover:border-primary/10 transition-all">
      <div className="w-full flex items-center gap-3 p-3.5">
        {/* Print button */}
        {onPrint && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrint(log);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity bg-muted/30 hover:bg-muted/60 text-muted-foreground/50 hover:text-foreground/80 shrink-0"
            title="Cetak Invoice"
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
        )}
        {/* Icon */}
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${cfg.bgClass}`}>
          {cfg.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold ${cfg.textClass}`}>
              {cfg.label}
            </span>
            <span className={`inline-flex items-center rounded px-1.5 py-0 text-[9px] font-bold ${cfg.badgeClass}`}>
              {amountPrefix}{log.amount}
            </span>
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
              Sisa saldo:{' '}
              <span className="font-mono text-foreground/70">{formatCurrencyShort(log.balance)}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
