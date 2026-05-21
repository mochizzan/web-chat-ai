'use client';
import { FileText } from 'lucide-react';

export function AdminLogsView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Logs</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Log aktivitas sistem</p>
      </div>
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <div className="text-center">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Log belum tersedia</p>
          <p className="text-xs mt-1 opacity-60">Fitur ini sedang dalam pengembangan</p>
        </div>
      </div>
    </div>
  );
}
