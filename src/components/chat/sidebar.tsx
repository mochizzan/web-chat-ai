'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import gsap from 'gsap';
import { useTheme } from 'next-themes';
import { useMounted } from '@/hooks/use-mounted';
import {
  Plus,
  MessageSquare,
  Bot,
  Trash2,
  Shield,
  Sun,
  Moon,
  Pin,
  X,
  Wallet,
  ChevronRight,
  LogOut,
  User,
  ImageIcon,
  Lock,
  Settings,
  List,
  Clock,
  PanelLeftClose,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useChatStore, useChatDataStore, type ConversationPreview } from '@/lib/store';
import { MarqueeText } from '@/components/ui/marquee-text';

// Mode definitions: Chat is active, Agent & Imagen are coming soon
const MODES = [
  { id: 'chat', label: 'Chat', icon: MessageSquare, comingSoon: false, description: 'AI Chat assistant' },
  { id: 'agent', label: 'Agent', icon: Bot, comingSoon: true, description: 'Autonomous agent' },
  { id: 'imagen', label: 'Imagen', icon: ImageIcon, comingSoon: true, description: 'AI Image generation' },
] as const;

// Max conversations shown in sidebar before "View All" button
const MAX_SIDEBAR_CONVERSATIONS = 8;
const VIEW_ALL_BATCH = 20;

const CATEGORY_DOT_COLORS: Record<string, string> = {
  chat: 'bg-muted-foreground',
  coding: 'bg-sky-500',
  research: 'bg-violet-500',
  assistant: 'bg-emerald-500',
  natural: 'bg-orange-500',
  agent: 'bg-muted-foreground',
  imagen: 'bg-muted-foreground',
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

interface SidebarProps {
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose?: () => void;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
}

// Format relative time for conversation
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Baru saja';
  if (diffMins < 60) return `${diffMins}m lalu`;
  if (diffHours < 24) return `${diffHours}j lalu`;
  if (diffDays < 7) return `${diffDays}h lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export function Sidebar({
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onClose,
  onToggleSidebar,
  isMobile = false,
}: SidebarProps) {
  const router = useRouter();
  const {
    activeCategory,
    activeConversationId,
    conversations,
    credit,
    setActiveCategory,
    user,
    isLoggedIn,
    logout,
  } = useChatDataStore();

  const { setAccountDialogOpen } = useChatStore();

  // handleLogout — replaces the removed logoutUser store async action
  const handleLogout = useCallback(async () => {
    // Clear local state immediately for responsive UX
    logout();
    // Then clear server-side session cookie (fire-and-forget)
    try {
      await fetch('/api/auth', { method: 'DELETE' });
    } catch (error) {
      console.error('Logout API error:', error);
    }
  }, [logout]);
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewAllSearchQuery, setViewAllSearchQuery] = useState('');
  const [viewAllCategoryFilter, setViewAllCategoryFilter] = useState<string>('all');
  const [viewAllDisplayCount, setViewAllDisplayCount] = useState(VIEW_ALL_BATCH);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const convRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const newChatBtnRef = useRef<HTMLButtonElement>(null);

  // GSAP mount animation
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (headerRef.current) {
        gsap.fromTo(
          headerRef.current,
          { opacity: 0, y: -6 },
          { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
        );
      }

      if (newChatBtnRef.current) {
        gsap.fromTo(
          newChatBtnRef.current,
          { opacity: 0, scale: 0.97 },
          { opacity: 1, scale: 1, duration: 0.25, ease: 'power2.out', delay: 0.06 }
        );
      }

      const modes = modeRefs.current.filter(Boolean);
      if (modes.length > 0) {
        gsap.fromTo(
          modes,
          { opacity: 0, x: -8 },
          {
            opacity: 1,
            x: 0,
            duration: 0.25,
            stagger: 0.06,
            ease: 'power2.out',
            delay: 0.1,
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Animate conversation items when list changes
  useEffect(() => {
    const convs = convRefs.current.filter(Boolean);
    if (convs.length > 0) {
      gsap.fromTo(
        convs,
        { opacity: 0, x: -4 },
        {
          opacity: 1,
          x: 0,
          duration: 0.15,
          stagger: 0.02,
          ease: 'power2.out',
        }
      );
    }
  }, [conversations.length, activeCategory]);

  // Reset display count when dialog opens or filters change
  useEffect(() => {
    if (viewAllDisplayCount !== VIEW_ALL_BATCH) {
      setTimeout(() => {
        setViewAllDisplayCount(VIEW_ALL_BATCH);
      }, 0);
    }
  }, [viewAllOpen, viewAllCategoryFilter, viewAllSearchQuery, viewAllDisplayCount]);

  // Infinite scroll: IntersectionObserver on sentinel
  useEffect(() => {
    if (!viewAllOpen) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setViewAllDisplayCount((prev) => prev + VIEW_ALL_BATCH);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewAllOpen]);

  // Mode click animation
  const handleModeClick = useCallback(
    (modeId: string, _idx: number, comingSoon: boolean) => {
      if (comingSoon) return;
      setActiveCategory(modeId);
    },
    [setActiveCategory]
  );

  // Theme toggle
  const handleThemeToggle = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  // Filter conversations only by sidebar modes (chat/agent/imagen),
  // NOT by toggle-only categories (coding/research/assistant/natural)
  const SIDEBAR_MODES = ['chat', 'agent', 'imagen'];
  const sidebarCategory = SIDEBAR_MODES.includes(activeCategory) ? activeCategory : 'chat';
  const filteredConversations = sidebarCategory === 'chat'
    ? conversations
    : conversations.filter((c) => c.category === sidebarCategory);

  const pinnedConversations = filteredConversations.filter((c) => c.pinned);
  const sidebarRegularConvosAll = filteredConversations.filter((c) => !c.pinned);

  // Limit sidebar display
  const sidebarRegularConvos = sidebarRegularConvosAll.slice(0, MAX_SIDEBAR_CONVERSATIONS);

  // Available categories for View All filter
  const availableCategories = ['all', ...new Set(sidebarRegularConvosAll.map((c) => c.category))];

  // View All dialog filter
  const viewAllFilteredAll = viewAllCategoryFilter === 'all'
    ? sidebarRegularConvosAll
    : sidebarRegularConvosAll.filter((c) => c.category === viewAllCategoryFilter);

  // View All search filter
  const viewAllFiltered = viewAllSearchQuery.trim()
    ? viewAllFilteredAll.filter((c) =>
        c.title.toLowerCase().includes(viewAllSearchQuery.toLowerCase()) ||
        (c.lastMessage?.content || '').toLowerCase().includes(viewAllSearchQuery.toLowerCase())
      )
    : viewAllFilteredAll;

  const viewAllDisplayed = viewAllFiltered.slice(0, viewAllDisplayCount);
  const hasMoreViewAll = viewAllDisplayed.length < viewAllFiltered.length;

  // Credit - compact: just show the total amount
  const isLowCredit = credit < 5;

  const isAdmin = isLoggedIn && user?.role === 'admin';

  const renderConversationItem = (
    conv: ConversationPreview,
    globalIdx: number,
    compact?: boolean
  ) => {
    const isActive = activeConversationId === conv.id;
    return (
      <div
        key={conv.id}
        ref={(el) => {
          convRefs.current[globalIdx] = el;
        }}
        className={`group relative flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors ${
          isActive
            ? 'bg-primary/5 text-foreground'
            : 'text-foreground hover:bg-accent/50'
        }`}
        onClick={() => {
          onSelectConversation(conv.id);
          setViewAllOpen(false);
        }}
      >
        <div className="shrink-0 flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT_COLORS[conv.category] || 'bg-muted-foreground'}`} />
          <div className="shrink-0">
            <MessageSquare className={`h-3 w-3 ${isActive ? 'text-primary/70' : 'text-muted-foreground/50'}`} />
          </div>
        </div>
        <div className="min-w-0 flex-1 w-0">
          <MarqueeText
            text={conv.title}
            className={`w-full text-[12px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}
            speed={25}
          />
          {!compact && conv.lastMessage && (
            <MarqueeText
              text={conv.lastMessage.content}
              className="w-full text-[10px] text-muted-foreground/50 mt-0.5"
              speed={20}
            />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!compact && (
            <span className="text-[9px] text-muted-foreground/30 hidden group-hover:hidden">
              {formatRelativeTime(conv.updatedAt)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteConversation(conv.id);
            }}
          >
            <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col bg-sidebar text-sidebar-foreground"
    >
      {/* Header: Brand + Toggle */}
      <div ref={headerRef} className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/6">
            <Bot className="h-4 w-4 text-primary/70" />
          </div>
          <span className="text-sm font-bold tracking-tight text-foreground">
            MI-Labs
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Desktop: collapse sidebar button */}
          {!isMobile && onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onToggleSidebar}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
          {/* Mobile: close button */}
          {isMobile && onClose && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Compact Credit Card - only show when logged in */}
      {isLoggedIn && (
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={() => setAccountDialogOpen(true)}
            className="w-full group"
          >
            <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card px-3 py-2 transition-all hover:border-primary/15">
              <div className="flex items-center gap-2">
                <Wallet className={`h-3.5 w-3.5 ${isLowCredit ? 'text-destructive' : 'text-primary/70'}`} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Total Kredit
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <p className={`text-sm font-bold font-mono ${isLowCredit ? 'text-destructive' : 'text-foreground'}`}>
                  <span suppressHydrationWarning>${mounted ? credit.toFixed(8) : '25.00000000'}</span>
                </p>
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/70 transition-colors" />
              </div>
            </div>
          </button>
        </div>
      )}

      {/* New Chat Button */}
      <div className="px-3 pb-2 shrink-0">
        <Button
          ref={newChatBtnRef}
          onClick={onNewChat}
          className="w-full gap-2 rounded-lg bg-primary text-primary-foreground py-2 hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-semibold">New Chat</span>
        </Button>
      </div>

      {/* Mode Selector - stacked vertically in one container */}
      <div className="px-3 pb-2 shrink-0">
        <div className="rounded-lg border border-border/40 bg-card p-1 space-y-0.5">
          {MODES.map((mode, idx) => {
            const Icon = mode.icon;
            const isActive = activeCategory === mode.id;
            return (
              <button
                key={mode.id}
                ref={(el) => {
                  modeRefs.current[idx] = el;
                }}
                onClick={() => handleModeClick(mode.id, idx, mode.comingSoon)}
                className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all ${
                  mode.comingSoon
                    ? 'opacity-50 cursor-not-allowed'
                    : isActive
                      ? 'bg-primary/6 text-foreground'
                      : 'hover:bg-accent/50 text-foreground'
                }`}
              >
                <div className={`flex h-7 w-7 items-center justify-center rounded-md shrink-0 transition-colors ${
                  mode.comingSoon
                    ? 'bg-muted/60'
                    : isActive
                      ? 'bg-primary/8'
                      : 'bg-muted/40'
                }`}>
                  <Icon className={`h-3.5 w-3.5 transition-colors ${
                    mode.comingSoon
                      ? 'text-muted-foreground'
                      : isActive
                        ? 'text-primary/70'
                        : 'text-muted-foreground'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13px] font-semibold transition-colors ${
                      mode.comingSoon
                        ? 'text-muted-foreground'
                        : isActive
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                    }`}>
                      {mode.label}
                    </span>
                    {mode.comingSoon && (
                      <span className="flex items-center gap-0.5 rounded bg-muted/80 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Lock className="h-2 w-2" />
                        Segera
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] leading-tight mt-0.5 transition-colors ${
                    mode.comingSoon
                      ? 'text-muted-foreground/50'
                      : isActive
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground/60'
                  }`}>
                    {mode.description}
                  </p>
                </div>
                {!mode.comingSoon && isActive && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                )}
              </button>
            );
          })}

          {/* Admin: Control Panel button */}
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-all hover:bg-accent/50 text-foreground"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md shrink-0 bg-muted/40">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-foreground">Control Panel</span>
                  <span className="inline-flex items-center gap-0.5 rounded bg-muted/60 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                    <Shield className="h-2 w-2" />
                    Admin
                  </span>
                </div>
                <p className="text-[10px] leading-tight mt-0.5 text-muted-foreground">
                  Kelola model & pengguna
                </p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Separator - contained within sidebar padding */}
      <div className="px-3 shrink-0">
        <Separator />
      </div>

      {/* Conversation List - scrollable */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full px-2 py-1.5">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/30">
                <MessageSquare className="h-5 w-5 text-muted-foreground/25" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Belum ada percakapan
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground/40">
                Mulai chat baru untuk memulai
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {/* Pinned Section */}
              {pinnedConversations.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-2.5 py-1">
                    <Pin className="h-2.5 w-2.5 text-muted-foreground/50" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                      Pinned
                    </span>
                  </div>
                  {pinnedConversations.map((conv, idx) =>
                    renderConversationItem(conv, idx)
                  )}
                  <div className="my-0.5 mx-2">
                    <Separator />
                  </div>
                </>
              )}

              {/* Recent Conversations with always-visible View All */}
              {sidebarRegularConvosAll.length > 0 && (
                <div className="flex items-center justify-between px-2.5 py-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Recent
                  </span>
                  <button
                    onClick={() => {
                      setViewAllSearchQuery('');
                      setViewAllCategoryFilter('all');
                      setViewAllOpen(true);
                    }}
                    className="flex items-center gap-1 text-[10px] font-medium text-primary/60 hover:text-primary/80 transition-colors"
                  >
                    <List className="h-2.5 w-2.5" />
                    Lihat Semua
                  </button>
                </div>
              )}
              {sidebarRegularConvos.map((conv, idx) =>
                renderConversationItem(conv, pinnedConversations.length + idx)
              )}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Bottom: User Profile + Theme - fixed at bottom */}
      <div className="shrink-0 border-t border-border/40">
        {/* User profile row or login prompt */}
        {isLoggedIn && user ? (
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/8 text-primary/70 text-xs font-bold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                {user.role === 'admin' && (
                  <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 text-primary/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0">
                    <Shield className="h-2.5 w-2.5" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 truncate">{user.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => router.push('/login')}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/30 shrink-0">
              <User className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <span className="text-xs font-medium">Masuk / Daftar</span>
          </button>
        )}

        {/* Theme toggle */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/30">
              {mounted && resolvedTheme === 'dark' ? (
                <Moon className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <span className="text-xs font-medium text-muted-foreground">Dark Mode</span>
          </div>
          <Switch
            checked={mounted ? resolvedTheme === 'dark' : false}
            onCheckedChange={handleThemeToggle}
          />
        </div>
      </div>

      {/* View All Recent Dialog */}
      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogTitle className="sr-only">Sidebar Options</DialogTitle>
        <DialogDescription className="sr-only">
          This dialog contains additional options for the sidebar.
        </DialogDescription>
          <DialogHeader className="px-4 pt-4 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary/70" />
              Semua Percakapan
            </DialogTitle>
            <DialogDescription>
              {viewAllFiltered.length} percakapan ditemukan
            </DialogDescription>

            {/* Search bar inside dialog */}
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
              <input
                type="text"
                value={viewAllSearchQuery}
                onChange={(e) => setViewAllSearchQuery(e.target.value)}
                placeholder="Cari percakapan..."
                className="w-full rounded-lg border border-border/20 bg-muted/20 py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              <button
                onClick={() => setViewAllCategoryFilter('all')}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  viewAllCategoryFilter === 'all'
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-muted/20 border-border/20 text-muted-foreground/60 hover:text-foreground'
                }`}
              >
                Semua
              </button>
              {availableCategories.filter((c) => c !== 'all').map((cat) => (
                <button
                  key={cat}
                  onClick={() => setViewAllCategoryFilter(cat)}
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                    viewAllCategoryFilter === cat
                      ? 'bg-primary/10 border-primary/30 text-primary'
                      : 'bg-muted/20 border-border/20 text-muted-foreground/60 hover:text-foreground'
                  }`}
                >
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${CATEGORY_DOT_COLORS[cat] || 'bg-muted-foreground'} mr-1`} />
                  {CATEGORY_LABELS[cat] || cat}
                </button>
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-3">
            <div className="space-y-0.5">
              {viewAllDisplayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    Tidak ada percakapan
                  </p>
                </div>
              ) : (
                <>
                  {viewAllDisplayed.map((conv) => (
                    <div
                      key={conv.id}
                      className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 transition-colors ${
                        activeConversationId === conv.id
                          ? 'bg-primary/8 text-foreground'
                          : 'text-foreground hover:bg-accent/50'
                      }`}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        setViewAllOpen(false);
                      }}
                    >
                      <div className="shrink-0 flex items-center gap-1.5">
                        {conv.category !== 'chat' && (
                          <div className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT_COLORS[conv.category] || 'bg-muted-foreground'}`} />
                        )}
                        <MessageSquare className={`h-3 w-3 shrink-0 ${activeConversationId === conv.id ? 'text-primary/70' : 'text-muted-foreground/50'}`} />
                      </div>
                      <div className="min-w-0 flex-1 w-0">
                        <MarqueeText
                          text={conv.title}
                          className={`w-full text-[12px] leading-tight ${activeConversationId === conv.id ? 'font-semibold' : 'font-medium'}`}
                          speed={25}
                        />
                        <div className="flex items-center gap-2 mt-0.5">
                          {conv.lastMessage && (
                            <MarqueeText
                              text={conv.lastMessage.content}
                              className="w-full text-[10px] text-muted-foreground/50"
                              speed={20}
                            />
                          )}
                          <span className="text-[9px] text-muted-foreground/30 shrink-0">
                            {formatRelativeTime(conv.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteConversation(conv.id);
                        }}
                      >
                        <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {/* Infinite scroll sentinel */}
                  {hasMoreViewAll && (
                    <div
                      ref={loadMoreRef}
                      className="flex items-center justify-center py-3"
                    >
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary/50" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
