import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CreditCard, Package } from 'lucide-react';
import { TopupPackages } from './topup-packages';
import { formatRupiah } from '../utils';

interface TopupTabProps {
  credit: number | null;
  selectedPackage: number | null;
  customAmount: string;
  topupLoading: boolean;
  effectiveTopupAmount: number;
  onPackageSelect: (kredit: number | null) => void;
  onCustomAmountChange: (value: string) => void;
  onTopup: (amount: number) => void;
}

export function TopupTab({
  credit,
  selectedPackage,
  customAmount,
  topupLoading,
  effectiveTopupAmount,
  onPackageSelect,
  onCustomAmountChange,
  onTopup,
}: TopupTabProps) {
  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 min-h-0">
      {/* Current balance */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">
            Saldo Saat Ini
          </p>
          <p className="text-2xl font-bold text-foreground font-mono" suppressHydrationWarning>
            ${credit !== null ? Number(credit).toFixed(8) : '0.00000000'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground/50">Harga per kredit</p>
          <p className="text-sm font-bold text-foreground">1 Kredit = Rp 15.000</p>
        </div>
      </div>

      <Separator className="mb-5" />

      {/* Package grid */}
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-3">
        <Package className="h-3.5 w-3.5 inline mr-1.5" />
        Pilih Paket
      </p>
      <TopupPackages 
        selected={selectedPackage} 
        onSelect={onPackageSelect} 
      />

      {/* Custom amount */}
      <div className="rounded-xl border border-border/25 bg-muted/5 p-4 mb-5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/50 mb-2.5">
          Jumlah Custom
        </p>
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1">
            <Input
              type="number"
              min="1"
              placeholder="Masukkan jumlah kredit"
              value={customAmount}
              onChange={(e) => {
                onCustomAmountChange(e.target.value);
                onPackageSelect(null);
              }}
              className="h-9 text-sm pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground/50 font-medium">
              kredit
            </span>
          </div>
          {customAmount && parseInt(customAmount, 10) > 0 && (
            <span className="text-xs text-muted-foreground/60 shrink-0">
              = {formatRupiah(parseInt(customAmount, 10) * 12000)}
            </span>
          )}
        </div>
      </div>

      {/* Purchase summary */}
      {effectiveTopupAmount > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Pembelian</span>
            <span className="text-sm font-bold text-foreground">{effectiveTopupAmount} Kredit</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">Total Harga</span>
            <span className="text-sm font-bold text-foreground">{formatRupiah(effectiveTopupAmount * 12000)}</span>
          </div>
          <Button
            className="w-full h-10 gap-2 text-sm font-bold"
            onClick={() => onTopup(effectiveTopupAmount)}
            disabled={topupLoading}
          >
            <CreditCard className="h-4 w-4" />
            {topupLoading ? 'Memproses...' : 'Beli Sekarang'}
          </Button>
        </div>
      )}
    </div>
  );
}