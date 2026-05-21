'use client';

import { useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { Menu, PanelLeft, MessageSquare, Activity, Coins, Receipt, ArrowDownToLine, ArrowUpFromLine, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ModelSelector } from './model-selector';
import { MarqueeText } from '@/components/ui/marquee-text';
import { Switch } from '@/components/ui/switch';
import { useChatStore } from '@/lib/store';
import { useMounted } from '@/hooks/use-mounted';

const CATEGORY_COLORS: Record<string, { badge: string; dot: string }> = {
  chat:      { badge: 'bg-muted/30 text-muted-foreground border-border/20',           dot: 'bg-muted-foreground' },
  coding:    { badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/15', dot: 'bg-sky-500' },
  research:  { badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/15', dot: 'bg-violet-500' },
  assistant: { badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/15', dot: 'bg-emerald-500' },
  natural:   { badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/15', dot: 'bg-orange-500' },
  agent:     { badge: 'bg-muted/30 text-muted-foreground border-border/20',           dot: 'bg-muted-foreground' },
  imagen:    { badge: 'bg-muted/30 text-muted-foreground border-border/20',           dot: 'bg-muted-foreground' },
};

const CATEGORY_LABELS: Record<string, string> = {
  chat: 'Chat',
  coding: 'Coding',
  research: 'Research',
  assistant: 'Assistant',
  natural: 'Natural',
  agent: 'Agent',
  imagen: 'Imagen',
};

interface TopBarProps {
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
}

function formatTok(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M-Tok`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k-Tok`;
  return `${n}-Tok`;
}

function formatCost(n: number): string {
  if (isNaN(n) || n === 0) return '$0.00';
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(6)}`;
}

function safeNum(n: number): number {
  return isNaN(n) ? 0 : n;
}

export function TopBar({ onToggleSidebar, onToggleMobileSidebar }: TopBarProps) {
  const { activeCategory, activeConversationId, conversations, sidebarOpen, usageLogs, messages, webSearchEnabled, setWebSearchEnabled } =
    useChatStore();
  const mounted = useMounted();
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(
        barRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: 'power2.out' }
      );
    }
  }, []);

  const activeConv = conversations.find(
    (c) => c.id === activeConversationId
  );

  // Compute SESSION stats — only from current conversation's usage logs
  // Uses deduplication by log ID to prevent inflated counts
  const sessionStats = useMemo(() => {
    // New chat (no active conversation) → always show 0
    if (!activeConversationId) {
      return { totalRequests: 0, totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalSpent: 0 };
    }
    // Filter by conversation and deduplicate by ID (safety against duplicate log entries)
    const seenIds = new Set<string>();
    const sessionLogs = usageLogs.filter((l) => {
      if (l.conversationId !== activeConversationId) return false;
      if (seenIds.has(l.id)) return false;
      seenIds.add(l.id);
      return true;
    });
    const totalRequests = sessionLogs.length;
    const totalInputTokens = safeNum(sessionLogs.reduce((sum, l) => sum + safeNum(l.inputTokens), 0));
    const totalOutputTokens = safeNum(sessionLogs.reduce((sum, l) => sum + safeNum(l.outputTokens), 0));
    const totalTokens = totalInputTokens + totalOutputTokens;
    const totalSpent = safeNum(sessionLogs.reduce((sum, l) => sum + safeNum(l.totalCost), 0));
    return { totalRequests, totalInputTokens, totalOutputTokens, totalTokens, totalSpent };
  }, [usageLogs, activeConversationId]);

  const hasChatStarted = messages.length > 0;

  return (
    <div
      ref={barRef}
      className="flex items-center gap-2 border-b bg-background px-3 py-2 shrink-0"
    >
      {/* Left: sidebar expand (only when collapsed) + conversation title (flexible, takes remaining space) */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 w-0 mr-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden shrink-0"
          onClick={onToggleMobileSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>
        {/* Desktop sidebar expand — only show when sidebar is collapsed */}
        {!sidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden lg:flex shrink-0"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
        {activeConv ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 w-0">
            <MessageSquare className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            <MarqueeText
              text={activeConv.title}
              className="w-full text-sm font-medium text-foreground"
              speed={40}
            />
          </div>
        ) : (
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
            New Chat
          </span>
        )}
      </div>

      {/* Center-right: model selector (shrink-0, never squeezed) */}
      <div className="shrink-0">
        <ModelSelector />
      </div>

      {/* Right: session stats + web search + badge (shrink-0) */}
      <div className="flex items-center gap-1.5 shrink-0 ml-2">
        {/* Web Search Toggle — always visible */}
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-card/60 px-2 py-1 cursor-default select-none">
                <Globe className={`h-3 w-3 ${webSearchEnabled ? 'text-sky-500' : 'text-muted-foreground/50'}`} />
                <span className={`text-[10px] font-medium leading-none ${webSearchEnabled ? 'text-sky-600 dark:text-sky-400' : 'text-muted-foreground'}`}>Web</span>
                <Switch
                  checked={webSearchEnabled}
                  onCheckedChange={setWebSearchEnabled}
                  className="h-3.5 w-6 [&>span]:h-[10px] [&>span]:w-[10px]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px] bg-popover text-popover-foreground border border-border/40 shadow-md p-2 max-w-[180px]">
              <p className="font-semibold">Web Search</p>
              <p className="text-muted-foreground">AI akan mencari informasi terbaru dari internet untuk respons yang lebih akurat</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Session stats — only when chat has started */}
        {hasChatStarted && mounted && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-border/30 bg-card/60 px-2 py-1 text-[10px] font-medium text-muted-foreground cursor-default">
                  <span className="flex items-center gap-0.5">
                    <Activity className="h-3 w-3 text-primary/60" />
                    <span className="tabular-nums">{sessionStats.totalRequests}-req</span>
                  </span>
                  <span className="h-3 w-px bg-border/30" />
                  <span className="flex items-center gap-0.5">
                    <ArrowDownToLine className="h-3 w-3 text-sky-500/70" />
                    <span className="tabular-nums">{formatTok(sessionStats.totalInputTokens)}</span>
                  </span>
                  <span className="h-3 w-px bg-border/30" />
                  <span className="flex items-center gap-0.5">
                    <ArrowUpFromLine className="h-3 w-3 text-violet-500/70" />
                    <span className="tabular-nums">{formatTok(sessionStats.totalOutputTokens)}</span>
                  </span>
                  <span className="h-3 w-px bg-border/30" />
                  <span className="flex items-center gap-0.5">
                    <Receipt className="h-3 w-3 text-primary/60" />
                    <span className="tabular-nums text-primary/80 dark:text-primary/70">{formatCost(sessionStats.totalSpent)}</span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[11px] bg-popover text-popover-foreground border border-border/40 shadow-md p-2.5 max-w-[220px]">
                <p className="font-semibold mb-1.5">Statistik Sesi Ini</p>
                <div className="space-y-1 text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3 text-primary/60" />
                    <span>Total permintaan</span>
                    <span className="ml-auto text-foreground font-medium">{sessionStats.totalRequests}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowDownToLine className="h-3 w-3 text-sky-500/70" />
                    <span>Token masuk (input)</span>
                    <span className="ml-auto text-foreground font-medium">{sessionStats.totalInputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ArrowUpFromLine className="h-3 w-3 text-violet-500/70" />
                    <span>Token keluar (output)</span>
                    <span className="ml-auto text-foreground font-medium">{sessionStats.totalOutputTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/20">
                    <Coins className="h-3 w-3 text-amber-500/70" />
                    <span>Total token</span>
                    <span className="ml-auto text-foreground font-medium">{sessionStats.totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/20">
                    <Receipt className="h-3 w-3 text-primary/60" />
                    <span>Total biaya sesi</span>
                    <span className="ml-auto text-primary/80 dark:text-primary/70 font-medium">{formatCost(sessionStats.totalSpent)}</span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Badge
          variant="outline"
          className={`text-xs font-medium capitalize hidden sm:flex gap-1 items-center border ${
            CATEGORY_COLORS[activeCategory]?.badge || 'bg-muted/30 text-muted-foreground border-border/20'
          }`}
        >
          {activeCategory === 'chat' ? (
            'Chat'
          ) : (
            <>
              Chat<span className="text-muted-foreground/40 mx-0.5">+</span>
              <span className="font-semibold">{CATEGORY_LABELS[activeCategory] || activeCategory}</span>
            </>
          )}
        </Badge>
      </div>
    </div>
  );
}
