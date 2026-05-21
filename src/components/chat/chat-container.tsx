'use client';

import { useMemo } from 'react';
import { useChatStore, type Message } from '@/lib/store';

interface ChatContainerProps {
  children: React.ReactNode | ((state: {
    activeConversationId: string | null;
    activeCategory: string;
    messages: Message[];
    isGenerating: boolean;
    sidebarOpen: boolean;
    setActiveConversationId: (id: string | null) => void;
    setActiveCategory: (category: string) => void;
    toggleSidebar: () => void;
    resetChat: () => void;
    setMessages: (messages: Message[]) => void;
    editingMessageId: string | null;
    setEditingMessageId: (id: string | null) => void;
  }) => React.ReactNode);
}

export function ChatContainer({ children }: ChatContainerProps) {
  const {
    activeConversationId,
    activeCategory,
    messages,
    isGenerating,
    sidebarOpen,
    setActiveConversationId,
    setActiveCategory,
    toggleSidebar,
    resetChat,
    setMessages,
    editingMessageId,
    setEditingMessageId,
  } = useChatStore();

  // Derive any needed state for the container
  const containerState = useMemo(() => ({
    activeConversationId,
    activeCategory,
    messages,
    isGenerating,
    sidebarOpen,
    setActiveConversationId,
    setActiveCategory,
    toggleSidebar,
    resetChat,
    setMessages,
    editingMessageId,
    setEditingMessageId,
  }), [
    activeConversationId,
    activeCategory,
    messages,
    isGenerating,
    sidebarOpen,
    setActiveConversationId,
    setActiveCategory,
    toggleSidebar,
    resetChat,
    setMessages,
    editingMessageId,
    setEditingMessageId,
  ]);

  // If children is a function, call it with the state; otherwise, render it directly
  if (typeof children === 'function') {
    return children(containerState);
  }

  return (
    <div className="flex h-full w-full">
      {children}
    </div>
  );
}