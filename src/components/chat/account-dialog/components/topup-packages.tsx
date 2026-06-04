import { Sparkles } from 'lucide-react';
import { TOPUP_PACKAGES, PROVIDER_COLORS } from '../constants';
import { formatRupiah } from '../utils';

interface TopupPackagesProps {
  selected: number | null;
  onSelect: (kredit: number | null) => void;
}

export function TopupPackages({ selected, onSelect }: TopupPackagesProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
      {TOPUP_PACKAGES.map((pkg) => {
        const isSelected = selected === pkg.kredit;
        return (
          <button
            key={pkg.kredit}
            onClick={() => {
              onSelect(isSelected ? null : pkg.kredit);
            }}
            className={`rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
              isSelected
                ? 'border-primary bg-primary/8 shadow-sm ring-1 ring-primary/20'
                : 'border-border/25 bg-card/40 hover:border-primary/30 hover:bg-primary/3'
            }`}
          >
            <div className="flex items-center justify-center mb-2">
              <Sparkles className={`h-5 w-5 ${isSelected ? 'text-primary/70' : 'text-muted-foreground/30'}`} />
            </div>
            <p className={`text-lg font-bold ${isSelected ? 'text-primary/80' : 'text-foreground'}`}>
              {pkg.kredit}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mb-1">Kredit</p>
            <p className="text-[11px] font-semibold text-muted-foreground/80">
              {formatRupiah(pkg.price)}
            </p>
          </button>
        );
      })}
    </div>
  );
}