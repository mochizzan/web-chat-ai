'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet } from 'lucide-react';

interface User {
  id: string;
  name: string;
  credit: number;
}

interface AdminCreditModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSetCredit: (userId: string, amount: number) => Promise<{ success: boolean }>;
  onAddCredit: (userId: string, amount: number) => Promise<{ success: boolean }>;
}

export function AdminCreditModal({
  user,
  isOpen,
  onClose,
  onSetCredit,
  onAddCredit,
}: AdminCreditModalProps) {
  const [amount, setAmount] = useState('');
  const [activeTab, setActiveTab] = useState('topup');
  const [isLoading, setIsLoading] = useState(false);

  if (!user) return null;

  const handleConfirm = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsLoading(true);
    try {
      let result;
      if (activeTab === 'set') {
        result = await onSetCredit(user.id, numAmount);
      } else if (activeTab === 'topup') {
        result = await onAddCredit(user.id, numAmount);
      } else if (activeTab === 'reduce') {
        result = await onAddCredit(user.id, -numAmount);
      }

      if (result?.success) {
        onClose();
        setAmount('');
      }
    } catch (error) {
      console.error('Error updating credit:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Atur Kredit Pengguna
          </DialogTitle>
          <DialogDescription>
            Kelola saldo kredit untuk <span className="font-semibold text-foreground">{user.name}</span>.
            Saldo saat ini: <span className="font-mono font-bold text-foreground">${user.credit.toFixed(8)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="topup">Top Up</TabsTrigger>
              <TabsTrigger value="reduce">Kurangi</TabsTrigger>
              <TabsTrigger value="set">Set</TabsTrigger>
            </TabsList>
            
            <TabsContent value="topup" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Jumlah Kredit yang Ditambahkan</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.00000001"
                  placeholder="0.00000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Menambahkan jumlah ini ke saldo yang sudah ada.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="reduce" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="amount-reduce">Jumlah Kredit yang Dikurangi</Label>
                <Input
                  id="amount-reduce"
                  type="number"
                  step="0.00000001"
                  placeholder="0.00000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Mengurangi saldo pengguna berdasarkan jumlah ini.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="set" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="amount-set">Tentukan Saldo Akhir</Label>
                <Input
                  id="amount-set"
                  type="number"
                  step="0.00000001"
                  placeholder="0.00000000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Mengubah saldo pengguna menjadi jumlah tepat ini.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !amount}>
            {isLoading ? 'Memproses...' : 'Simpan Perubahan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}