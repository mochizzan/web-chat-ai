'use client';

import { useMemo } from 'react';
import { useUIStore, useChatDataStore, useShallow, type Message } from '@/lib/store';

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
  // UI selectors
  const { isGenerating, sidebarOpen, editingMessageId, setEditingMessageId, toggleSidebar, setIsGenerating, clearStreaming } =
    useUIStore(useShallow(s => ({
      isGenerating: s.isGenerating,
      sidebarOpen: s.sidebarOpen,
      editingMessageId: s.editingMessageId,
      setEditingMessageId: s.setEditingMessageId,
      toggleSidebar: s.toggleSidebar,
      setIsGenerating: s.setIsGenerating,
      clearStreaming: s.clearStreaming,
    })));

  // Data selectors
  const { activeConversationId, activeCategory, messages, setActiveConversationId, setActiveCategory, resetChat, setMessages } =
    useChatDataStore(useShallow(s => ({
      activeConversationId: s.activeConversationId,
      activeCategory: s.activeCategory,
      messages: s.messages,
      setActiveConversationId: s.setActiveConversationId,
      setActiveCategory: s.setActiveCategory,
      resetChat: s.resetChat,
      setMessages: s.setMessages,
    })));

  const containerState = {
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
  };

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