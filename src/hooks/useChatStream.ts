'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useChatStore, useChatDataStore, type Message, type UsageLogEntry, type CreditLogEntry } from '@/lib/store';
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
  isError?: boolean;
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
    reasoningLevel,
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
    setGenerationStatus,
  } = useChatStore();

  // Refs to avoid stale closures
  const activeConversationIdRef = useRef(activeConversationId);
  const activeModelRef = useRef(activeModel);
  const activeCategoryRef = useRef(activeCategory);
  const reasoningLevelRef = useRef(reasoningLevel);
  const webSearchEnabledRef = useRef(webSearchEnabled);
  const chatActionsRef = useRef<ReturnType<typeof useChatActions> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
    activeModelRef.current = activeModel;
    activeCategoryRef.current = activeCategory;
    reasoningLevelRef.current = reasoningLevel;
    webSearchEnabledRef.current = webSearchEnabled;
  }, [activeConversationId, activeModel, activeCategory, reasoningLevel, webSearchEnabled]);

  // Ref to hold handleSend for useChatActions (to avoid circular dependency)
  const handleSendRef = useRef<((message: string) => void) | null>(null);

  // Helper: Parse code blocks from AI response and save to code sidebar
  const parseAndSaveCodeBlocks = useCallback((content: string, messageId: string) => {
    const codeBlockRegex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
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

    // Removed: auto-open sidebar on finalization.
    // Code blocks are registered in the store and accessible via badge clicks.
    // The StreamingCodeContainer shows incomplete code during streaming.
  }, []);

  // Helper: Add finalized assistant message
  const finalizeAssistantMessage = useCallback(
    (assistantMsgId: string, content: string, thinkingContent: string, reasoningLevel: string) => {
      let finalContent = '';
      if (thinkingContent && reasoningLevel !== 'off') {
        finalContent += `<details>\n<summary>💭 Proses Berpikir</summary>\n\n${thinkingContent}\n\n</details>\n\n`;
      }
      finalContent += content;

      const currentMessages = useChatStore.getState().messages;
      const existingIndex = currentMessages.findIndex((m) => m.id === assistantMsgId);

      if (existingIndex >= 0) {
        // Update existing placeholder with final content
        const updated = [...currentMessages];
        updated[existingIndex] = {
          ...updated[existingIndex],
          content: finalContent,
        };
        useChatStore.getState().setMessages(updated);
      } else {
        // Fallback: append new (non-streaming / partial content path)
        useChatStore.getState().setMessages([
          ...currentMessages,
          {
            id: assistantMsgId,
            role: 'assistant' as const,
            content: finalContent,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

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
        while (!streamDone) {
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
                    setGenerationStatus('');

                    const currentMessages = useChatStore.getState().messages;
                    const updatedMessages = currentMessages.map((m) => {
                      // Replace temp user message with real one from server
                      if (m.id === tempId) {
                        return {
                          id: event.userMessage.id,
                          role: 'user' as const,
                          content: event.userMessage.content,
                          createdAt: event.userMessage.createdAt,
                        };
                      }
                      // Replace temp placeholder (added in handleSend) with real assistant ID
                      if (m.role === 'assistant' && m.id.startsWith('placeholder-') && m.content === '') {
                        return {
                          ...m,
                          id: event.assistantMessageId,
                        };
                      }
                      return m;
                    });
                    useChatStore.getState().setMessages(updatedMessages);

                    setIsStreaming(true);

                    // Set active conversation ID - conversation data will be updated by backend
                    const convId = activeConversationIdRef.current || event.conversationId;
                    if (!activeConversationIdRef.current) {
                      const title = originalMessage.trim().length > 50
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
                    // Defense-in-depth: skip thinking if reasoning is off
                    if (reasoningLevelRef.current === 'off') break;
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
                    // NOTE: Do NOT set isThinkingStreaming(false) here!
                    // isThinkingStreaming is managed by StreamingBubble's ThinkingSection.onComplete()
                    // to ensure thinking fake stream animation finishes before content phase starts.
                    fullContent += event.content;
                    appendStreamingContent(event.content);
                    break;
                  }
                  case 'status': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Status event`, { message: event.message });
                    setGenerationStatus(event.message);
                    break;
                  }

                  case 'error': {
                    console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Error event`, { message: event.message });
                    setIsStreaming(false);
                    console.warn('SSE stream error from server:', event.message);
                    toast({
                      title: 'Terjadi Kesalahan',
                      description: event.message,
                      variant: 'destructive',
                    });
                    toast({
                      title: 'Koneksi Terputus',
                      description: event.partialContent
                        ? 'Respons AI terputus. Pesan parsial telah disimpan.'
                        : 'Gagal mendapatkan respons AI. Silakan generate ulang.',
                      variant: 'destructive',
                    });
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
                      setIsStreaming(false);
                      setGenerationStatus('');

                      if (fullContent.length === 0 && fullThinkingContent.length === 0 && event.isError) {
                        // Error path with no content: remove the placeholder assistant message
                        // instead of creating an empty bubble. Error toast already shown by the error event handler.
                        console.log(`[${new Date().toISOString()}] [useChatStream] processSSEStream: Error done with no content, skipping finalize`);
                        setIsGenerating(false);
                        clearStreaming();
                        break;
                      }

                    const assistantMsgId = initEvent?.assistantMessageId || `msg_a_${Date.now()}`;
                    const convId = activeConversationIdRef.current || initEvent?.conversationId || `conv_${Date.now()}`;

                    finalizeAssistantMessage(assistantMsgId, fullContent, fullThinkingContent, reasoningLevelRef.current);

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

                      // Skip usage log update on error path — the done event contains
                      // estimated (inaccurate) token data when the upstream API errored.
                      // Only update the frontend store for successful completions.
                      if (!event.isError && event.usage) {
                        const usageEntry: UsageLogEntry = {
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
                        };
                        const currentLogs = useChatDataStore.getState().usageLogs;
                        if (!currentLogs.find((l) => l.id === usageEntry.id)) {
                          useChatDataStore.getState().setUsageLogs([usageEntry, ...currentLogs]);
                        }

                        // Update credit balance from backend response
                        if (event.usage.creditRemaining !== undefined) {
                          useChatDataStore.getState().setCredit(event.usage.creditRemaining);
                        }

                        // Synthesize a credit log entry for the timeline
                        if (event.usage.totalCost > 0) {
                          const store = useChatDataStore.getState();
                          const creditLogEntry: CreditLogEntry = {
                            id: `cl_${event.usage.logId}`,
                            type: 'usage',
                            amount: -event.usage.totalCost,
                            balance: event.usage.creditRemaining ?? store.credit,
                            description: `Penggunaan ${event.usage.modelName}`,
                            createdAt: event.usage.createdAt || new Date().toISOString(),
                          };
                          const currentCreditLogs = store.creditLogs;
                          if (!currentCreditLogs.find((l) => l.id === creditLogEntry.id)) {
                            store.setCreditLogs([creditLogEntry, ...currentCreditLogs]);
                          }
                        }
                      }

                      if (fullContent.length === 0 && fullThinkingContent.length === 0) {
                        setIsGenerating(false);
                        clearStreaming();
                      }
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
          finalizeAssistantMessage(assistantMsgId, fullContent, fullThinkingContent, reasoningLevelRef.current);
          clearStreaming();
        }
      } catch (readError) {

        if (fullContent.length > 0 || fullThinkingContent.length > 0) {
          const assistantMsgId = initEvent?.assistantMessageId || `msg_a_partial_${Date.now()}`;
          finalizeAssistantMessage(assistantMsgId, fullContent, fullThinkingContent, reasoningLevelRef.current);
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
      // Set active conversation ID - conversation data will be updated by backend
      if (!activeConversationIdRef.current) {
        const title = originalMessage.trim().length > 50
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
      const hasPlaceholder = currentMessages.some((m) => m.role === 'assistant' && m.id.startsWith('placeholder-'));
      const updatedMessages = currentMessages.map((m) => {
        if (m.id === tempId) {
          return {
            id: data.userMessage.id,
            role: 'user' as const,
            content: data.userMessage.content,
            createdAt: data.userMessage.createdAt,
          };
        }
        // Replace placeholder with real assistant message
        if (m.role === 'assistant' && m.id.startsWith('placeholder-')) {
          return {
            id: data.assistantMessage.id,
            role: 'assistant' as const,
            content: data.assistantMessage.content,
            createdAt: data.assistantMessage.createdAt,
          };
        }
        return m;
      });
      if (!hasPlaceholder) {
        updatedMessages.push({
          id: data.assistantMessage.id,
          role: 'assistant' as const,
          content: data.assistantMessage.content,
          createdAt: data.assistantMessage.createdAt,
        });
      }
      useChatStore.getState().setMessages(updatedMessages);

      updateConversationLastMessage(convId, {
        id: data.assistantMessage.id,
        role: 'assistant',
        content: data.assistantMessage.content.substring(0, 100),
        createdAt: data.assistantMessage.createdAt,
      });

      // Update frontend store with usage data from backend response
      // Backend already saved usage_log to DB — we only update the UI store here
      if (data.usage) {
        const usageEntry: UsageLogEntry = {
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
        };
        const currentLogs = useChatDataStore.getState().usageLogs;
        if (!currentLogs.find((l) => l.id === usageEntry.id)) {
          useChatDataStore.getState().setUsageLogs([usageEntry, ...currentLogs]);
        }

        // Update credit balance from backend response
        if ('creditRemaining' in data.usage && (data.usage as { creditRemaining?: number }).creditRemaining !== undefined) {
          useChatDataStore.getState().setCredit((data.usage as { creditRemaining: number }).creditRemaining);
        }
      }
    },
    [setActiveConversationId, updateConversationLastMessage]
  );

  const handleSend = useCallback(
    async (message: string) => {
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Starting message send`);
      if (isGenerating) return;
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Checking generation status`);

      // Get credit AND active model to check if it's a free model
      const { credit, models, activeModel } = useChatStore.getState();
      const currentModel = models.find(m => m.id === activeModel);
      const isFreeModel = currentModel?.free === true;
      
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Credit check`, {
        credit,
        activeModel,
        isFreeModel,
        modelFree: currentModel?.free
      });
      
      // Only block if credit is 0 AND model is NOT free
      if (credit <= 0 && !isFreeModel) {
        console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Insufficient credit for non-free model`);
        const { isLoggedIn } = useChatDataStore.getState();
        if (!isLoggedIn) {
          toast({
            title: 'Model Berbayar',
            description: 'Login untuk menggunakan model ini.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Kredit Habis',
            description: 'Kredit Anda sudah habis. Silakan top up untuk melanjutkan.',
            variant: 'destructive',
          });
        }
        return;
      }

      // ─── Anonymous Trial Guard ──────────────────────────────
      // Block unauthenticated users who have exceeded the free trial limit (4 messages)
      const { isLoggedIn } = useChatDataStore.getState();
      if (!isLoggedIn && isFreeModel) {
        const TRIAL_KEY = 'anonymous_trial_count';
        const MAX_TRIAL = 4;
        const trialCount = parseInt(localStorage.getItem(TRIAL_KEY) || '0', 10);

        if (trialCount >= MAX_TRIAL) {
          console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Anonymous trial limit reached`);

          setIsGenerating(true);

          addMessage({
            id: `temp-user-${Date.now()}`,
            role: 'user' as const,
            content: message,
            createdAt: new Date().toISOString(),
          });

          addMessage({
            id: `auth-block-${Date.now()}`,
            role: 'assistant' as const,
            content: 'Maaf, Anda telah mencapai batas percobaan gratis (4 pesan). Silakan Masuk dengan Akun untuk melanjutkan layanan dan menikmati fitur lengkap kami!',
            createdAt: new Date().toISOString(),
          });

          setIsGenerating(false);
          return;
        }

        // Increment trial counter
        localStorage.setItem(TRIAL_KEY, String(trialCount + 1));
        console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Anonymous trial count incremented to ${trialCount + 1}`);
      }

      const tempId = `temp-user-${Date.now()}`;
      const placeholderAssistantId = `placeholder-${Date.now()}`;
      console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Creating temp message`, { tempId, placeholderAssistantId });
      setIsGenerating(true);
      clearStreaming();

      // -----------------------------------------------------------------
      // [FIX] Read store BEFORE adding current messages to UI.
      // This ensures conversationHistory does NOT include the current user
      // message or the assistant placeholder, preventing duplicate payload.
      // -----------------------------------------------------------------
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

      addMessage({
        id: tempId,
        role: 'user' as const,
        content: message,
        createdAt: new Date().toISOString(),
      });

      // Add assistant placeholder immediately so latestAssistantMessageId
      // points to this placeholder (not the previous assistant) during the
      // timing gap between handleSend and the init SSE event.
      addMessage({
        id: placeholderAssistantId,
        role: 'assistant' as const,
        content: '',
        createdAt: new Date().toISOString(),
      });

      try {
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            model: activeModelRef.current,
            category: activeCategoryRef.current,
            reasoningLevel: reasoningLevelRef.current,
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
              serverError = errorData.error?.message || errorData.error || '';
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
          useChatStore.getState().setMessages(currentMessages.filter((m) => m.id !== tempId && !m.id.startsWith('placeholder-')));
          clearStreaming();
          setIsGenerating(false);
          throw new Error('API_ERROR');
        }

        const contentType = res.headers.get('content-type') || '';
        if (contentType && contentType.includes('text/event-stream')) {
          console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Processing SSE stream`);
          await processSSEStream(res, tempId, message);
        } else {
          const data = await res.json();
          handleNonStreamingResponse(data, tempId, message);
        }

        // ── Persist anonymous conversation to localStorage ──
        const { isLoggedIn } = useChatDataStore.getState();
        if (!isLoggedIn && isFreeModel) {
          const convId = activeConversationIdRef.current || '';
          if (convId) {
            const storageKey = `anon_conversation_${convId}`;
            const currentMsgs = useChatStore.getState().messages;
            localStorage.setItem(storageKey, JSON.stringify(currentMsgs));
            console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Saved anonymous conversation to localStorage`, { convId, msgCount: currentMsgs.length });
          }
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
          useChatStore.getState().setMessages(currentMessages.filter((m) => m.id !== tempId && !m.id.startsWith('placeholder-')));
        }

        clearStreaming();

        if (error instanceof DOMException && error.name === 'AbortError') {
          console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Request aborted`, { error });
          // User cancelled
        } else if (error instanceof Error && error.message === 'API_ERROR') {
          // Do not show double toast for initial api errors, already handled
          console.log(`[useChatStream] API_ERROR handled without dual toast`);
        } else {
          toast({
            title: 'Koneksi Terputus',
            description: 'Respons AI terputus. Pesan parsial telah disimpan.',
            variant: 'destructive',
          });
        }

        setIsGenerating(false);
        throw error;
      } finally {
        console.log(`[${new Date().toISOString()}] [useChatStream] handleSend: Finalizing request`);
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

      // Check if placeholder already exists from init event
      const existingIndex = currentMessages.findIndex((m) => m.id.startsWith('msg_a_'));

      if (existingIndex >= 0) {
        // Update existing placeholder
        const updated = [...currentMessages];
        updated[existingIndex] = { ...updated[existingIndex], content: finalContent };
        useChatStore.getState().setMessages(updated);
      } else {
        // Fallback: add new
        const assistantMsgId = `msg_a_stopped_${Date.now()}`;
        useChatStore.getState().setMessages([
          ...currentMessages,
          { id: assistantMsgId, role: 'assistant', content: finalContent, createdAt: new Date().toISOString() },
        ]);
      }
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
