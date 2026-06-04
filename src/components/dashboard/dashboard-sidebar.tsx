'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  KeyRound,
  BookText,
  Plug,
  Activity,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

// ─── Navigation Items ───────────────────────────────────
const NAV_ITEMS = [
  { value: 'api-keys', label: 'API Keys', icon: KeyRound },
  { value: 'docs', label: 'Dokumentasi', icon: BookText },
  { value: 'endpoints', label: 'Endpoint', icon: Plug },
  { value: 'usage', label: 'Penggunaan', icon: Activity },
] as const;

export type DashboardSection = (typeof NAV_ITEMS)[number]['value'];

// ─── Props ───────────────────────────────────────────────
interface DashboardSidebarProps {
  activeSection: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
}

// ─── Component ───────────────────────────────────────────
export function DashboardSidebar({ activeSection, onSectionChange }: DashboardSidebarProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_sidebar_state');
    if (saved === 'collapsed') setCollapsed(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('dashboard_sidebar_state', next ? 'collapsed' : 'expanded');
      return next;
    });
  }, []);

  const handleNavClick = useCallback(
    (value: DashboardSection) => {
      onSectionChange(value);
      if (isMobile) setMobileOpen(false);
    },
    [onSectionChange, isMobile]
  );

  // ─── Sidebar Content ─────────────────────────────────
  const sidebarContent = (
    <div
      className={cn(
        'flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-[3.5rem]' : 'w-64'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center border-b border-sidebar-border px-3 h-14 shrink-0',
          collapsed ? 'justify-center' : 'justify-between'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <LayoutDashboard className="h-5 w-5 shrink-0 text-sidebar-primary" />
            <span className="text-sm font-semibold truncate">Dashboard</span>
          </div>
        )}
        {collapsed && (
          <LayoutDashboard className="h-5 w-5 shrink-0 text-sidebar-primary" />
        )}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className={cn(
              'h-8 w-8 shrink-0 text-sidebar-foreground/60 hover:text-sidebar-foreground',
              collapsed && 'ml-0'
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className={cn('flex flex-col gap-1 px-2', collapsed && 'items-center')}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.value;
            const Icon = item.icon;

            const navButton = (
              <button
                key={item.value}
                onClick={() => handleNavClick(item.value)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors w-full',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                  collapsed && 'justify-center px-0'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            );

            // Show tooltip when collapsed
            if (collapsed) {
              return (
                <Tooltip key={item.value} delayDuration={0}>
                  <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                  <TooltipContent side="right" className="text-xs font-medium">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navButton;
          })}
        </nav>
      </ScrollArea>

      {/* Back to Chat */}
      <div className={cn('border-t border-sidebar-border p-2', collapsed && 'flex justify-center')}>
        <Tooltip delayDuration={collapsed ? 0 : 1000}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={collapsed ? 'icon' : 'default'}
              onClick={() => router.push('/')}
              className={cn(
                'w-full gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground',
                collapsed && 'w-9 h-9'
              )}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">Kembali ke Chat</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right" className="text-xs font-medium">
              Kembali ke Chat
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );

  // ─── Mobile: Sheet trigger ──────────────────────────
  const mobileTrigger = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMobileOpen(true)}
      className="md:hidden h-9 w-9"
      aria-label="Open sidebar menu"
    >
      <PanelLeftOpen className="h-5 w-5" />
    </Button>
  );

  // ─── Render ─────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {mobileTrigger}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="p-0 w-72">
            <SheetHeader className="sr-only">
              <SheetTitle>Dashboard Navigation</SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Wrap with TooltipProvider for desktop tooltips
  return <TooltipProvider>{sidebarContent}</TooltipProvider>;
}
