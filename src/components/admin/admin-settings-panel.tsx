'use client';
import { Bot } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function AdminSettingsPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Pengaturan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Informasi aplikasi dan konfigurasi
        </p>
      </div>
      <Card className="border-border/40 max-w-lg">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/40">
              <Bot className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">MI-Labs Chat</p>
              <p className="text-xs text-muted-foreground">AI-Powered Chat Dashboard</p>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Versi</span>
              <span className="text-xs font-semibold text-foreground">0.2.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Framework</span>
              <span className="text-xs font-semibold text-foreground">Next.js 16</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Mode</span>
              <span className="text-xs font-semibold text-primary">Produksi</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Auth System</span>
              <span className="text-xs font-semibold text-foreground">JWT / Session</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Database</span>
              <span className="text-xs font-semibold text-foreground">Prisma (SQLite)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
