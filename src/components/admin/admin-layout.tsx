'use client';
import { Sidebar } from '@/components/ui/sidebar';

export function AdminLayout({
  children,
  sidebar,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-4.5rem)]">
      {sidebar}
      <div className="flex-1 p-6 animate-in fade-in slide-in-from-bottom-1 duration-400">
        {children}
      </div>
    </div>
  );
}