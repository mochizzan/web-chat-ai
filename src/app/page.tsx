'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { Sidebar } from '@/components/chat/sidebar';
import { TopBar } from '@/components/chat/top-bar';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { EmptyState } from '@/components/chat/empty-state';
import { CodeSidebar } from '@/components/chat/code-sidebar';
import { AccountDialog } from '@/components/chat/account-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// Custom Hooks for extracted logic
import { useChatStream } from '@/hooks/useChatStream';
import { useChatActions } from '@/hooks/useChatActions';
import { ChatContainer } from '@/components/chat/chat-container';
import { StreamingIndicator } from '@/components/chat/streaming-indicator';

export default function Home() {
  // 1. AuthSession
  // const { isLoadingConversations } = useAuthSession(); // Removed unused variable

  // 2. ChatStream and chat operations from hook
  const { handleSend, handleStop } = useChatStream();

  // 3. Chat actions from hook
  const { handleLoadConversation, handleDeleteConversation, handleEditConfirm, handleRegenerate } =
    useChatActions(handleSend);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [inputKey, setInputKey] = useState(0);

  const pageRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  // GSAP page entrance
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (mainRef.current) {
        gsap.fromTo(
          mainRef.current,
          { y: 10 },
          { y: 0, duration: 0.4, ease: 'power2.out' }
        );
      }
    }, pageRef);
    return () => ctx.revert();
  }, []);

  // Toggle sidebar (mobile)
  const handleToggleMobileSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  return (
    <div ref={pageRef} className="flex h-dvh w-full overflow-hidden bg-background">
      <ChatContainer>
        {state => {
          const {
            messages,
            isGenerating,
            sidebarOpen,
            toggleSidebar,
            resetChat,
            setActiveCategory,
          } = state;

          // editingMessage is derived but not used directly in render, kept for potential future use
          // const _editingMessage = editingMessageId ? messages.find((m) => m.id === editingMessageId) : null; // Removed unused variable

          // Update handleNewChat to use resetChat from state
          const updatedHandleNewChat = () => {
            resetChat();
            setMobileSidebarOpen(false);
          };

          // Update handleSelectConversation to use state setters
          const updatedHandleSelectConversation = async (id: string) => {
            setMobileSidebarOpen(false);
            if (isLoadingMessages) return;
            setIsLoadingMessages(true);
            try {
              await handleLoadConversation(id);
            } finally {
              setIsLoadingMessages(false);
            }
          };

          // Update handleQuickAction to use state setter
          const updatedHandleQuickAction = (prompt: string, category: string) => {
            setActiveCategory(category);
            setInputPrompt(prompt);
            setInputKey((prev) => prev + 1);
          };

          return (
            <>
              {/* Desktop Sidebar */}
              <div
                className={`hidden lg:flex shrink-0 flex-col border-r transition-all duration-300 ease-in-out ${
                  sidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
                }`}
              >
                <Sidebar
                  onNewChat={updatedHandleNewChat}
                  onSelectConversation={updatedHandleSelectConversation}
                  onDeleteConversation={handleDeleteConversation}
                  onToggleSidebar={toggleSidebar}
                  isMobile={false}
                />
              </div>

              {/* Mobile Sidebar (Sheet) */}
              <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
                <SheetContent side="left" className="w-[280px] p-0 [&>button]:hidden">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Sidebar</SheetTitle>
                  </SheetHeader>
                  <Sidebar
                    onNewChat={updatedHandleNewChat}
                    onSelectConversation={updatedHandleSelectConversation}
                    onDeleteConversation={handleDeleteConversation}
                    onClose={() => setMobileSidebarOpen(false)}
                    onToggleSidebar={toggleSidebar}
                    isMobile
                  />
                </SheetContent>
              </Sheet>

              {/* Main Content */}
              <div ref={mainRef} className="flex flex-1 flex-col min-w-0 overflow-hidden">
                <TopBar onToggleSidebar={toggleSidebar} onToggleMobileSidebar={handleToggleMobileSidebar} />

                <div className="flex-1 overflow-hidden flex flex-col">
                  {messages.length === 0 && !isGenerating ? (
                    <EmptyState onQuickAction={updatedHandleQuickAction} />
                  ) : (
                    <MessageList onEditConfirm={handleEditConfirm} onRegenerate={handleRegenerate} />
                  )}
                  {isGenerating && <StreamingIndicator />}
                </div>

                <ChatInput onSend={handleSend} onStop={handleStop} initialMessage={inputPrompt} key={inputKey} />
              </div>

              <CodeSidebar />
              <AccountDialog />
            </>
          );
        }}
      </ChatContainer>
    </div>
  );
}
