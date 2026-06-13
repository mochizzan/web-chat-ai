'use client';

import { useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, FileText, Loader2 } from 'lucide-react';
import type { CreditLogEntry } from '@/lib/store';
import { formatFullTime, formatCurrencyShort } from '../utils';

interface InvoiceModalProps {
  log: CreditLogEntry | null;
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

const LOG_LABELS: Record<string, { label: string; color: string }> = {
  topup: { label: 'Top Up Kredit', color: '#10b981' },
  bonus: { label: 'Bonus Selamat Datang', color: '#f59e0b' },
  deduct: { label: 'Pengurangan Kredit', color: '#ef4444' },
  admin_set: { label: 'Penyesuaian Admin (Set)', color: '#8b5cf6' },
  admin_adjust: { label: 'Penyesuaian Admin', color: '#6366f1' },
};

export function InvoiceModal({ log, isOpen, onClose, userName, userEmail }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);

  const handleDownloadPNG = useCallback(async () => {
    if (!invoiceRef.current) return;
    setExporting('png');
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(invoiceRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `invoice-${log?.id || 'unknown'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setExporting(null);
    }
  }, [log]);

  const handleDownloadPDF = useCallback(async () => {
    if (!invoiceRef.current) return;
    setExporting('pdf');
    try {
      const { toPng } = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');
      const dataUrl = await toPng(invoiceRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (invoiceRef.current.offsetHeight / invoiceRef.current.offsetWidth) * imgWidth;
      pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`invoice-${log?.id || 'unknown'}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setExporting(null);
    }
  }, [log]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!log) return null;

  const typeInfo = LOG_LABELS[log.type] || { label: 'Transaksi Kredit', color: '#6b7280' };
  const invoiceNumber = `INV-${log.id.slice(0, 8).toUpperCase()}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] print:shadow-none print:border-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>Invoice Transaksi</DialogTitle>
          <DialogDescription>
            Preview invoice untuk transaksi kredit Anda.
          </DialogDescription>
        </DialogHeader>

        {/* Invoice Preview */}
        <div
          ref={invoiceRef}
          className="bg-white text-black rounded-xl border border-gray-200 p-6 space-y-5 invoice-preview"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">MI-Labs AI</h2>
              <p className="text-xs text-gray-500 mt-0.5">Invoice Transaksi Kredit</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono font-bold text-gray-800">{invoiceNumber}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {formatFullTime(log.createdAt)}
              </p>
            </div>
          </div>

          {/* User Info */}
          <div className="text-xs text-gray-600 space-y-0.5">
            {userName && <p><span className="text-gray-400">Pengguna:</span> {userName}</p>}
            {userEmail && <p><span className="text-gray-400">Email:</span> {userEmail}</p>}
          </div>

          {/* Transaction Detail */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Jenis Transaksi
              </span>
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: `${typeInfo.color}15`,
                  color: typeInfo.color,
                }}
              >
                {typeInfo.label}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Jumlah</span>
              <span
                className="text-lg font-bold"
                style={{ color: log.amount >= 0 ? typeInfo.color : '#ef4444' }}
              >
                {log.amount >= 0 ? '+' : ''}
                {formatCurrencyShort(log.amount)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Sisa Saldo</span>
              <span className="text-sm font-mono font-semibold text-gray-800">
                {formatCurrencyShort(log.balance)}
              </span>
            </div>

            {log.description && (
              <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
                <span className="text-xs text-gray-400">Keterangan</span>
                <span className="text-sm text-gray-700">{log.description}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-center">
            <p className="text-[10px] text-gray-400">
              Terima kasih telah menggunakan MI-Labs AI
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="print:hidden flex-row items-center gap-2 sm:justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPNG}
            disabled={exporting !== null}
          >
            {exporting === 'png' ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Unduh PNG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={exporting !== null}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <FileText className="h-4 w-4 mr-1.5" />
            )}
            Unduh PDF
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handlePrint}
            disabled={exporting !== null}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Cetak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
