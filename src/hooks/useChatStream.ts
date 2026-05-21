'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useChatStore } from '@/lib/store';
import { useChatActions } from './useChatActions';
import { useToast } from '@/hooks/use-toast';

// SSE event types from the backend
interface SSEInitEvent {
  type: 'init';
  conversationId: string;
  userMessage: { id: string; role: string; content: string; createdAt: string };
  assistantMessageId: string;
}

interface SSECreditWarningEvent {
  type: 'credit_warning';
  level: 'low' | 'critical';
  message: string;
}

interface SSECreditErrorEvent {
  type: 'credit_error';
  code: 'INSUFFICIENT_CREDITS';
  message: string;
}

interface SSEDeltaEvent {
  type: 'delta';
  content: string;
}

interface SSEThinkingEvent {
  type: 'thinking';
  content: string;
}

interface SSEWebSearchEvent {
  type: 'web_search';
  status: 'searching' | 'results_found' | 'no_results' | 'skipped' | 'error';
  message: string;
  query?: string;
  resultCount?: number;
}

interface SSEErrorEvent {
  type: 'error';
  message: string;
  partialContent: string;
  partialThinking: string;
}

interface SSEDoneEvent {
  type: 'done';
  usage: {
    modelId: string;
    modelName: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
    creditRemaining: number;
    logId: string;
    createdAt: string;
  };
}

type SSEEvent =
  | SSEInitEvent
  | SSEDeltaEvent
  | SSEThinkingEvent
  | SSEWebSearchEvent
  | SSEErrorEvent
  | SSEDoneEvent
  | SSECreditWarningEvent
  | SSECreditErrorEvent;

export function useChatStream() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastWarningTimestamp = useRef<number>(0);
  const { toast } = useToast();

  const {
    activeConversationId,
    activeModel,
    activeCategory,
    thinkingEnabled,
    webSearchEnabled,
    isGenerating,
    addMessage,
    setIsGenerating,
    clearStreaming,
    addConversation,
    setActiveConversationId,
    updateConversationLastMessage,
    setIsStreaming,
    setIsThinkingStreaming,
    appendStreamingThinkingContent,
    setIsWebSearching,
    appendStreamingContent,
    setRegeneratingMessageId,
  } = useChatStore();

  // Refs to avoid stale closures
  const activeConversationIdRef = useRef(activeConversationId);
  const activeModelRef = useRef(activeModel);
  const activeCategoryRef = useRef(activeCategory);
  const thinkingEnabledRef = useRef(thinkingEnabled);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  const chatActionsRef = useRef<ReturnType<typeof useChatActions> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    activeModelRef.current = activeModel;
    activeCategoryRef.current = activeCategory;
    thinkingEnabledRef.current = thinkingEnabled;
    webSearchEnabledRef.current = webSearchEnabled;
  }, [activeConversationId, activeModel, activeCategory, thinkingEnabled, webSearchEnabled]);

  // Ref to hold handleSend for useChatActions (to avoid circular dependency)
  const handleSendRef = useRef<((message: string) => void) | null>(null);

  // Helper: Parse code blocks from AI response and save to code sidebar
  const parseAndSaveCodeBlocks = useCallback((content: string, messageId: string) => {
    const codeBlockRegex = /```(\w+)(?::([^\n]+))?\n([\s\S]*?)```/g;
    let match;
    let hasNewCode = false;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1] || 'text';
      const fileNameHint = match[2]?.trim() || '';
      const code = match[3].trim();

      if (!code) continue;

      const extensions: Record<string, string> = {
        javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
        jsx: 'jsx', tsx: 'tsx', python: 'py', py: 'py',
        html: 'html', css: 'css', json: 'json', bash: 'sh', shell: 'sh',
        sql: 'sql', java: 'java', cpp: 'cpp', c: 'c', go: 'go',
        rust: 'rs', php: 'php', ruby: 'rb', swift: 'swift', kotlin: 'kt',
        dart: 'dart', yaml: 'yml', yml: 'yml', xml: 'xml', markdown: 'md', md: 'md',
      };

      let fileName: string;
      if (fileNameHint) {
        fileName = fileNameHint;
      } else {
        const ext = extensions[language.toLowerCase()] || language.toLowerCase();
        fileName = `file-${blockIndex + 1}.${ext}`;
      }

      const blockId = `${messageId}-code-${blockIndex}`;
      useChatStore.getState().addCodeBlock({
        id: blockId,
        messageId,
        language,
        fileName,
        code,
      });

      hasNewCode = true;
      blockIndex++;
    }

    if (hasNewCode) {
      useChatStore.getState().setCodeSidebarOpen(true);
    }
  }, []);

  // Helper: Add finalized assistant message
  const finalizeAssistantMessage = useCallback(
    (assistantMsgId: string, content: string, thinkingContent: string) => {
      let finalContent = '';
      if (thinkingContent) {
        finalContent += `<details>\n<summary>💭 Proses Berpikir</summary>\n\n${thinkingContent}\n\n</details>\n\n`;
      }
      finalContent += content;

      const currentMessages = useChatStore.getState().messages;
      const alreadyExists = currentMessages.find((m) => m.id === assistantMsgId);
      if (alreadyExists) return;

      const messagesWithResponse = [
        ...currentMessages,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: finalContent,
          createdAt: new Date().toISOString(),
        },
      ];
      useChatStore.getState().setMessages(messagesWithResponse);
      parseAndSaveCodeBlocks(content, assistantMsgId);
    },
    [parseAndSaveCodeBlocks]
  );

  // Create chatActions that will call handleSend via ref
  const chatActions = useChatActions((message: string) => {
    if (handleSendRef.current) {
      handleSendRef.current(message);
    }
  });

  // Process SSE stream from the backend with robust buffer management
  const processSSEStream = useCallback(
    async (res: Response, tempId: string, originalMessage: string) => {
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let sseBuffer = '';
      let initEvent: SSEInitEvent | null = null;
      let fullContent = '';
      let fullThinkingContent = '';
      let streamDone = false;

      console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Starting stream processing`);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });

          while (true) {
            const eventEndIdx = sseBuffer.indexOf('\n\n');
            if (eventEndIdx === -1) break;

            const eventText = sseBuffer.substring(0, eventEndIdx);
            sseBuffer = sseBuffer.substring(eventEndIdx + 2);

            const lines = eventText.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const event: SSEEvent = JSON.parse(dataStr);

                console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Event received`, { type: event.type });
                switch (event.type) {
                  case 'credit_warning': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Credit warning`, { level: event.level });
                    const WARNING_INTERVAL = 300000; // 5 minutes
                    if (Date.now() - lastWarningTimestamp.current > WARNING_INTERVAL) {
                      toast({
                        title: event.level === 'critical' ? 'Kredit Sangat Rendah' : 'Kredit Rendah',
                        description: event.message,
                        variant: event.level === 'critical' ? 'destructive' : 'default',
                      });
                      lastWarningTimestamp.current = Date.now();
                    }
                    break;
                  }
                  case 'credit_error': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Credit error`, { code: event.code });
                    toast({
                      title: 'Kredit Tidak Cukup',
                      description: event.message,
                      variant: 'destructive',
                    });
                    useChatStore.getState().setAccountDialogOpen(true);

                    const currentMessages = useChatStore.getState().messages;
                    useChatStore.getState().setMessages(currentMessages.filter((m) => m.id !== tempId));
                    break;
                  }
                  case 'init': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Init event`, { conversationId: event.conversationId });
                    initEvent = event;

                    const currentMessages = useChatStore.getState().messages;
                    const updatedMessages = currentMessages.map((m) =>
                      m.id === tempId
                        ? {
                            id: event.userMessage.id,
                            role: 'user' as const,
                            content: event.userMessage.content,
                            createdAt: event.userMessage.createdAt,
                          }
                        : m
                    );
                    useChatStore.getState().setMessages(updatedMessages);
                    setIsStreaming(true);

                    const convId = activeConversationIdRef.current || event.conversationId;
                    if (!activeConversationIdRef.current) {
                      const title =
                        originalMessage.trim().length > 50
                          ? originalMessage.trim().substring(0, 50) + '...'
                          : originalMessage.trim();
                      addConversation({
                        id: convId,
                        title,
                        model: activeModelRef.current,
                        category: activeCategoryRef.current,
                        pinned: false,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        lastMessage: null,
                      });
                      setActiveConversationId(convId);
                    }
                    break;
                  }

                  case 'thinking': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Thinking event`, { contentLength: event.content.length });
                    fullThinkingContent += event.content;
                    appendStreamingThinkingContent(event.content);
                    setIsThinkingStreaming(true);
                    break;
                  }

                  case 'web_search': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Web search event`, { status: event.status });
                    if (event.status === 'searching') {
                      setIsWebSearching(true);
                    } else {
                      setIsWebSearching(false);
                    }
                    break;
                  }

                  case 'delta': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Delta event`, { contentLength: event.content.length });
                    if (useChatStore.getState().isThinkingStreaming) {
                      setIsThinkingStreaming(false);
                    }
                    fullContent += event.content;
                    appendStreamingContent(event.content);
                    break;
                  }

                  case 'error': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Error event`, { message: event.message });
                    console.warn('SSE stream error from server:', event.message);
                    if (event.partialContent) {
                      fullContent = event.partialContent;
                    }
                    if (event.partialThinking) {
                      fullThinkingContent = event.partialThinking;
                    }
                    break;
                  }

                  case 'done': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Done event`, { usage: event.usage });
                    streamDone = true;
                    const assistantMsgId = initEvent?.assistantMessageId || `msg_a_${Date.now()}`;
                    const convId = activeConversationIdRef.current || initEvent?.conversationId || `conv_${Date.now()}`;

                    finalizeAssistantMessage(assistantMsgId, fullContent, fullThinkingContent);

                    let lastMsgContent = fullContent.substring(0, 100);
                    if (fullThinkingContent) {
                      lastMsgContent = `💭 ${fullThinkingContent.substring(0, 50)}...`;
                    }
                    updateConversationLastMessage(convId, {
                      id: assistantMsgId,
                      role: 'assistant',
                      content: lastMsgContent,
                      createdAt: new Date().toISOString(),
                    });

                    if (event.usage) {
                      const actions = chatActionsRef.current;
                      if (actions) {
                        actions.deductCredit(event.usage.totalCost);
                        actions.addUsageLog({
                          id: event.usage.logId,
                          conversationId: convId,
                          modelId: event.usage.modelId,
                          modelName: event.usage.modelName,
                          provider: event.usage.provider,
                          inputTokens: event.usage.inputTokens,
                          outputTokens: event.usage.outputTokens,
                          inputCost: event.usage.inputCost,
                          outputCost: event.usage.outputCost,
                          totalCost: event.usage.totalCost,
                          category: activeCategoryRef.current,
                          createdAt: event.usage.createdAt,
                        });
                      }
                    }

                    clearStreaming();
                    break;
                  }
                }
              } catch {
              }
            }
          }
        }

        if (!streamDone && fullContent.length > 0) {
          const assistantMsgId = initEvent?.assistantMessageId || `msg_a_partial_${Date.now()}`;
          finalizeAssistantMessage(assistantMsgId, fullContent, fullThinkingContent);
          clearStreaming();
        }
      } catch (readError) {

        if (fullContent.length > 0 || fullThinkingContent.length > 0) {
          const assistantMsgId = initEvent?.assistantMessageId || `msg_a_partial_${Date.now()}`;
          finalizeAssistantMessage(assistantMsgId, fullContent, fullThinkingContent);
          clearStreaming();
        }

        throw readError;
      } finally {
        reader.releaseLock();
      }
    },
    [
      setIsStreaming,
      setIsThinkingStreaming,
      appendStreamingContent,
      appendStreamingThinkingContent,
      addConversation,
      setActiveConversationId,
      updateConversationLastMessage,
      clearStreaming,
      finalizeAssistantMessage,
      setIsWebSearching,
      toast,
    ]
  );

  // Handle non-streaming JSON response (fallback)
  const handleNonStreamingResponse = useCallback(
    (data: {
      conversationId: string;
      userMessage: { id: string; content: string; createdAt: string };
      assistantMessage: { id: string; content: string; createdAt: string };
      usage?: {
        logId: string;
        conversationId: string;
        modelId: string;
        modelName: string;
        provider: string;
        inputTokens: number;
        outputTokens: number;
        inputCost: number;
        outputCost: number;
        totalCost: number;
        createdAt: string;
      };
    }, tempId: string, originalMessage: string) => {
      const convId = activeConversationIdRef.current || data.conversationId;
      if (!activeConversationIdRef.current) {
        const title =
          originalMessage.trim().length > 50
            ? originalMessage.trim().substring(0, 50) + '...'
            : originalMessage.trim();
        addConversation({
          id: convId,
          title,
          model: activeModelRef.current,
          category: activeCategoryRef.current,
          pinned: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessage: null,
        });
        setActiveConversationId(convId);
      }

      const currentMessages = useChatStore.getState().messages;
      const updatedMessages = currentMessages.map((m) =>
        m.id === tempId
          ? {
              id: data.userMessage.id,
              role: 'user' as const,
              content: data.userMessage.content,
              createdAt: data.userMessage.createdAt,
            }
          : m
      );
      updatedMessages.push({
        id: data.assistantMessage.id,
        role: 'assistant' as const,
        content: data.assistantMessage.content,
        createdAt: data.assistantMessage.createdAt,
      });
      useChatStore.getState().setMessages(updatedMessages);

      updateConversationLastMessage(convId, {
        id: data.assistantMessage.id,
        role: 'assistant',
        content: data.assistantMessage.content.substring(0, 100),
        createdAt: data.assistantMessage.createdAt,
      });

      if (data.usage) {
        const actions = chatActionsRef.current;
        if (actions) {
          actions.deductCredit(data.usage.totalCost);
          actions.addUsageLog({
            id: data.usage.logId,
            conversationId: convId,
            modelId: data.usage.modelId,
            modelName: data.usage.modelName,
            provider: data.usage.provider,
            inputTokens: data.usage.inputTokens,
            outputTokens: data.usage.outputTokens,
            inputCost: data.usage.inputCost,
            outputCost: data.usage.outputCost,
            totalCost: data.usage.totalCost,
            category: activeCategoryRef.current,
            createdAt: data.usage.createdAt,
          });
        }
      }
    },
    [addConversation, setActiveConversationId, updateConversationLastMessage]
  );

  const handleSend = useCallback(
    async (message: string) => {
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Starting message send`);
      if (isGenerating) return;
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Checking generation status`);

      const currentCredit = useChatStore.getState().credit;
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Current credit`, { currentCredit });
      if (currentCredit <= 0) {
        console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Insufficient credit`);
        toast({
          title: 'Kredit Habis',
          description: 'Kredit Anda sudah habis. Silakan reset di pengaturan akun.',
          variant: 'destructive',
        });
        return;
      }

      const tempId = `temp-user-${Date.now()}`;
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Creating temp message`, { tempId });
      addMessage({
        id: tempId,
        role: 'user' as const,
        content: message,
        createdAt: new Date().toISOString(),
      });
      setIsGenerating(true);
      clearStreaming();

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const currentMessages = useChatStore.getState().messages;
        const recentMessages = currentMessages.slice(-20);
        const conversationHistory = recentMessages.map((m) => {
          let content = m.content;
          if (m.role === 'assistant') {
            content = content.replace(/<details>[\s\S]*?<\/details>/g, '').trim();
          }
          return {
            role: m.role as 'user' | 'assistant',
            content,
          };
        });

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            model: activeModelRef.current,
            category: activeCategoryRef.current,
            thinkingEnabled: thinkingEnabledRef.current,
            webSearchEnabled: webSearchEnabledRef.current,
            history: conversationHistory,
            conversationId: activeConversationIdRef.current,
            timezone: userTimezone,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: API response not OK`, { status: res.status });
          const contentType = res.headers.get('content-type') || '';
          let serverError = '';
          try {
            if (contentType && contentType.includes('application/json')) {
              const errorData = await res.json();
              serverError = errorData.error || '';
            } else {
              console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Processing non-streaming response`);
              serverError = await res.text();
            }
          } catch {
            serverError = `Server error (${res.status})`;
          }

          if (res.status === 402 || (serverError && serverError.includes('credit'))) {
            toast({
              title: 'Kredit Habis',
              description: 'Kredit Anda sudah habis. Silakan reset di pengaturan akun.',
              variant: 'destructive',
            });
          } else if (res.status === 504 || (serverError && serverError.includes('timeout'))) {
            toast({
              title: 'Timeout',
              description: 'AI membutuhkan waktu terlalu lama. Coba pesan yang lebih pendek.',
              variant: 'destructive',
            });
          } else if (res.status === 503 || (serverError && serverError.includes('koneksi'))) {
            toast({
              title: 'Koneksi Gagal',
              description: 'Tidak dapat terhubung ke AI. Periksa koneksi dan coba lagi.',
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Error', description: serverError || `Server error (${res.status})`, variant: 'destructive' });
          }

          const currentMessages = useChatStore.getState().messages;
          useChatStore.getState().setMessages(currentMessages.filter((m) => m.id !== tempId));
          clearStreaming();
          setIsGenerating(false);
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType && contentType.includes('text/event-stream')) {
          console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Processing SSE stream`);
          await processSSEStream(res, tempId, message);
        } else {
          const data = await res.json();
          handleNonStreamingResponse(data, tempId, message);
        }
      } catch (error) {
        console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Error occurred`, { error });
        const currentMessages = useChatStore.getState().messages;
        const streamingContent = useChatStore.getState().streamingContent;

        if (streamingContent.length > 0) {
          const assistantMsgId = `msg_a_partial_${Date.now()}`;
          const streamingThinking = useChatStore.getState().streamingThinkingContent;
          const filteredMessages = currentMessages.filter((m) => m.id !== tempId);
          let finalContent = '';
          if (streamingThinking) {
            finalContent += `<details>\n<summary>💭 Proses Berpikir</summary>\n\n${streamingThinking}\n\n</details>\n\n`;
          }
          finalContent += streamingContent;

          filteredMessages.push({
            id: assistantMsgId,
            role: 'assistant' as const,
            content: finalContent,
            createdAt: new Date().toISOString(),
          });
          useChatStore.getState().setMessages(filteredMessages);
        } else {
          useChatStore.getState().setMessages(currentMessages.filter((m) => m.id !== tempId));
        }

        clearStreaming();

        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Request aborted`, { error });
          // User cancelled
        } else {
          toast({
            title: 'Koneksi Terputus',
            description: 'Respons AI terputus. Pesan parsial telah disimpan.',
            variant: 'destructive',
          });
        }
      } finally {
        console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Finalizing request`);
        setIsGenerating(false);
        setRegeneratingMessageId(null);
        abortControllerRef.current = null;
      }
    },
    [
      isGenerating,
      addMessage,
      setIsGenerating,
      clearStreaming,
      toast,
      processSSEStream,
      handleNonStreamingResponse,
      setRegeneratingMessageId,
    ]
  );

  // Update refs after handleSend and chatActions are defined
  useEffect(() => {
    handleSendRef.current = handleSend;
    chatActionsRef.current = chatActions;
  }, [handleSend, chatActions]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const { streamingContent, streamingThinkingContent, messages: currentMessages } = useChatStore.getState();
    if (streamingContent.length > 0 || streamingThinkingContent.length > 0) {
      let finalContent = '';
      if (streamingThinkingContent) {
        finalContent += `<details>\n<summary>💭 Proses Berpikir</summary>\n\n${streamingThinkingContent}\n\n</details>\n\n`;
      }
      finalContent += streamingContent;

      const assistantMsgId = `msg_a_stopped_${Date.now()}`;
      const messagesWithResponse = [
        ...currentMessages,
        {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: finalContent,
          createdAt: new Date().toISOString(),
        },
      ];
      useChatStore.getState().setMessages(messagesWithResponse);
    }
    clearStreaming();
    setIsGenerating(false);
  }, [clearStreaming, setIsGenerating]);

  return {
    handleSend,
    handleStop,
    parseAndSaveCodeBlocks,
  };
}
