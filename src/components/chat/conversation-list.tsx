'use client';

import { useCallback } from 'react';
import {
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useChatStore } from '@/lib/store';
import { MarqueeText } from '@/components/ui/marquee-text';

interface ConversationListProps {
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose?: () => void;
  onToggleSidebar?: () => void;
  isMobile?: boolean;
}

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

function getCategoryColor(category: string): string {
  switch (category) {
    case 'coding': return 'bg-sky-500';
    case 'research': return 'bg-violet-500';
    case 'assistant': return 'bg-emerald-500';
    case 'natural': return 'bg-orange-500';
    default: return 'bg-muted-foreground';
  }
}

export function ConversationList({
  onSelectConversation,
  onDeleteConversation,
  onClose,
}: ConversationListProps) {
  const {
    activeCategory,
    activeConversationId,
    conversations,
  } = useChatStore();

  const SIDEBAR_MODES = ['chat', 'agent', 'imagen'];
  const sidebarCategory = SIDEBAR_MODES.includes(activeCategory) ? activeCategory : 'chat';
  const filteredConversations = sidebarCategory === 'chat'
    ? conversations
    : conversations.filter((c) => c.category === sidebarCategory);

  const pinnedConversations = filteredConversations.filter((c) => c.pinned);
  const sidebarRegularConvos = filteredConversations.filter((c) => !c.pinned);

  const handleConversationClick = useCallback((id: string) => {
    onSelectConversation(id);
    if (onClose) onClose();
  }, [onSelectConversation, onClose]);

  const handleDeleteClick = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteConversation(id);
  }, [onDeleteConversation]);

  return (
    <div className="flex h-full flex-col">
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
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                    Pinned
                  </span>
                </div>
                {pinnedConversations.map((conv) => {
                  const isActive = activeConversationId === conv.id;
                  return (
                    <div
                      key={conv.id}
                      className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 ${isActive ? 'bg-primary/8 text-foreground' : 'text-foreground hover:bg-accent/50'}`}
                      onClick={() => handleConversationClick(conv.id)}
                    >
                      <div className="shrink-0 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground block" />
                        </div>
                        <MessageSquare className={`h-3 w-3 shrink-0 ${isActive ? 'text-primary/70' : 'text-muted-foreground/50'}`} />
                      </div>
                      <div className="min-w-0 flex-1 w-0">
                        <MarqueeText
                          text={conv.title}
                          className={`w-full text-[12px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}
                          speed={25}
                        />
                        {conv.lastMessage && (
                          <MarqueeText
                            text={conv.lastMessage?.content ?? ''}
                            className="w-full text-[10px] text-muted-foreground/50 mt-0.5"
                            speed={20}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[9px] text-muted-foreground/30 group-hover:hidden">
                          {formatRelativeTime(conv.updatedAt)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => handleDeleteClick(conv.id, e)}
                        >
                          <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="my-0.5 mx-2">
                  <Separator />
                </div>
              </>
            )}

            {/* Recent Conversations */}
            {sidebarRegularConvos.map((conv) => {
              const isActive = activeConversationId === conv.id;
              return (
                <div
                  key={conv.id}
                  className={`group flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 ${isActive ? 'bg-primary/8 text-foreground' : 'text-foreground hover:bg-accent/50'}`}
                  onClick={() => handleConversationClick(conv.id)}
                >
                  <div className="shrink-0 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full">
                      <span className={`h-1.5 w-1.5 rounded-full block ${getCategoryColor(conv.category)}`} />
                    </div>
                    <MessageSquare className={`h-3 w-3 shrink-0 ${isActive ? 'text-primary/70' : 'text-muted-foreground/50'}`} />
                  </div>
                  <div className="min-w-0 flex-1 w-0">
                    <MarqueeText
                      text={conv.title}
                      className={`w-full text-[12px] leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}
                      speed={25}
                    />
                    {conv.lastMessage && (
                      <MarqueeText
                        text={conv.lastMessage?.content ?? ''}
                        className="w-full text-[10px] text-muted-foreground/50 mt-0.5"
                        speed={20}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-muted-foreground/30 group-hover:hidden">
                      {formatRelativeTime(conv.updatedAt)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => handleDeleteClick(conv.id, e)}
                    >
                      <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
