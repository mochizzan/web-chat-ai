import { PlusCircle, Gift, Clock } from 'lucide-react';
import type { CreditLogEntry } from '@/lib/store';
import { formatFullTime, formatCurrencyShort } from '../utils';

interface CreditLogItemProps {
  log: CreditLogEntry;
}

export function CreditLogItem({ log }: CreditLogItemProps) {
  const isBonus = log.type === 'bonus';

  return (
    <div className="group rounded-xl border border-border/20 bg-card/40 hover:border-primary/10 transition-all">
      <div className="w-full flex items-center gap-3 p-3.5">
        {/* Icon */}
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
            isBonus ? 'bg-amber-500/10' : 'bg-emerald-500/10'
          }`}
        >
          {isBonus ? (
            <Gift className="h-4 w-4 text-amber-500/80" />
          ) : (
            <PlusCircle className="h-4 w-4 text-emerald-500/80" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-xs font-bold ${
                isBonus
                  ? 'text-amber-600 dark:text-amber-400/80'
                  : 'text-emerald-600 dark:text-emerald-400/80'
              }`}
            >
              {isBonus ? 'Bonus Selamat Datang' : 'Top Up Kredit'}
            </span>
            <span
              className={`inline-flex items-center rounded px-1.5 py-0 text-[9px] font-bold ${
                isBonus
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400/70'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400/70'
              }`}
            >
              +{log.amount}
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
