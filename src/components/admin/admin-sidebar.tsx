'use client';
import { useState } from 'react';
import type { AdminSection, SidebarItem } from '@/lib/admin-types';
import {
  LayoutDashboard,
  Cpu,
  Users,
  FileText,
  Settings,
} from 'lucide-react';

const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'models', label: 'Models', icon: Cpu },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AdminSidebar({
  activeSection,
  onSectionChange,
}: {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside className="w-64 border-r h-[calc(100vh-4.5rem)] flex-shrink-0">
      <div className="flex h-full flex-col">
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b">
          <div className="text-xl font-bold">Admin Panel</div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded hover:bg-muted"
            aria-label="Toggle sidebar"
          >
            {isCollapsed ? (
              <span className="material-symbols-rounded">menu_open</span>
            ) : (
              <span className="material-symbols-rounded">menu</span>
            )}
          </button>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 overflow-y-auto">
          <ul className="space-y-1 px-2 pt-4">
            {SIDEBAR_ITEMS.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`
                    flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium
                    ${activeSection === item.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50'}
                  `}
                >
                  {isCollapsed ? (
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <>
                      <item.icon className="h-5 w-5" aria-hidden="true" />
                      <span className="hidden md:block">{item.label}</span>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}