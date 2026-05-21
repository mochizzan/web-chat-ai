import { renderHook, act } from '@testing-library/react';
import { useChatActions } from '@/hooks/useChatActions';
import { useChatStore, useChatDataStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
jest.mock('@/lib/store');
jest.mock('@/hooks/use-toast');
jest.mock('@/hooks/useChatStream', () => ({
  useChatStream: jest.fn(() => ({
    handleSend: jest.fn(),
  })),
}));

const mockUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;
const mockUseChatDataStore = useChatDataStore as jest.MockedFunction<typeof useChatDataStore>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

let mockChatStore: Record<string, unknown>;

describe('useChatActions', () => {
  const mockToast = jest.fn();
  const mockDismiss = jest.fn();
  const mockSetMessages = jest.fn();
  const mockSetActiveCategory = jest.fn();
  const mockRemoveConversation = jest.fn();
  const mockSetRegeneratingMessageId = jest.fn();

  const mockUIState = {
    // UIState properties
    sidebarOpen: true,
    codeSidebarOpen: false,
    accountDialogOpen: false,
    accountTab: 'overview' as const,
    isGenerating: false,
    isWebSearching: false,
    editingMessageId: null,
    regeneratingMessageId: null,
    streamingContent: '',
    streamingThinkingContent: '',
    isStreaming: false,
    isThinkingStreaming: false,
    // UI Actions
    setSidebarOpen: jest.fn(),
    toggleSidebar: jest.fn(),
    setCodeSidebarOpen: jest.fn(),
    toggleCodeSidebar: jest.fn(),
    setAccountDialogOpen: jest.fn(),
    setAccountTab: jest.fn(),
    setIsGenerating: jest.fn(),
    setIsWebSearching: jest.fn(),
    setEditingMessageId: jest.fn(),
    setRegeneratingMessageId: mockSetRegeneratingMessageId,
    setStreamingContent: jest.fn(),
    appendStreamingContent: jest.fn(),
    setStreamingThinkingContent: jest.fn(),
    appendStreamingThinkingContent: jest.fn(),
    setIsStreaming: jest.fn(),
    setIsThinkingStreaming: jest.fn(),
    clearStreaming: jest.fn(),
  };

  const mockChatDataStore = {
    // ChatDataState properties
    credit: 1000,
    totalSpent: 0,
    usageLogs: [],
    creditLogs: [],
    user: null,
    isLoggedIn: false,
    thinkingEnabled: true,
    webSearchEnabled: false,
    activeConversationId: null,
    activeCategory: 'assistant',
    activeModel: 'gpt-4',
    messages: [],
    conversations: [],
    models: [],
    codeBlocks: [],
    selectedCodeBlock: null,
    // Data Actions
    setActiveConversationId: jest.fn(),
    setActiveCategory: mockSetActiveCategory,
    setActiveModel: jest.fn(),
    setMessages: mockSetMessages,
    addMessage: jest.fn(),
    replaceTempAndAddResponse: jest.fn(),
    removeLastMessage: jest.fn(),
    removeMessagesFrom: jest.fn(),
    setConversations: jest.fn(),
    addConversation: jest.fn(),
    updateConversationLastMessage: jest.fn(),
    removeConversation: mockRemoveConversation,
    setModels: jest.fn(),
    addModel: jest.fn(),
    removeModel: jest.fn(),
    toggleModelActive: jest.fn(),
    updateModelPricing: jest.fn(),
    updateModel: jest.fn(),
    toggleModelFree: jest.fn(),
    addCodeBlock: jest.fn(),
    updateCodeBlock: jest.fn(),
    updateCodeBlockByFileName: jest.fn(),
    setCodeBlocks: jest.fn(),
    setSelectedCodeBlock: jest.fn(),
    markCodeBlockOpened: jest.fn(),
    clearCodeBlocks: jest.fn(),
    setCredit: jest.fn(),
    setTotalSpent: jest.fn(),
    setUsageLogs: jest.fn(),
    setCreditLogs: jest.fn(),
    setUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
    setUserCredit: jest.fn(),
    addUserCredit: jest.fn(),
    resetAccount: jest.fn(),
    resetChat: jest.fn(),
    setThinkingEnabled: jest.fn(),
    setWebSearchEnabled: jest.fn(),
    toggleThinking: jest.fn(),
  };

  const baseMockState = { ...mockUIState, ...mockChatDataStore };

  const mockChatStore = {
    ...baseMockState,
    getState: jest.fn(() => baseMockState),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    mockUseToast.mockReturnValue({ toast: mockToast, dismiss: mockDismiss, toasts: [] });
    mockUseChatDataStore.mockReturnValue(mockChatDataStore);
    mockUseChatStore.mockImplementation((selector) => {
      if (selector) {
        return selector(mockChatStore);
      }
      return mockChatStore;
    });
    // Also mock the static getState method - delegate to mockChatStore.getState so tests can override it
    (useChatStore as unknown as { getState: jest.Mock }).getState = jest.fn(() => mockChatStore.getState());
    // Also mock useChatDataStore.getState for handleLoadConversation
    (useChatDataStore as unknown as { getState: jest.Mock }).getState = jest.fn(() => mockChatDataStore);
  });

  describe('handleLoadConversation', () => {
    it('should load conversation and update store on success', async () => {
      const mockMessages = [
        { id: '1', role: 'user', content: 'Hello' },
        { id: '2', role: 'assistant', content: 'Hi there' }
      ];
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          data: {
            messages: mockMessages,
            conversation: { category: 'assistant' }
          }
        })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleLoadConversation('conv-1');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-1');
      expect(mockSetMessages).toHaveBeenCalledWith(mockMessages);
      expect(mockSetActiveCategory).toHaveBeenCalledWith('assistant');
      expect(mockChatDataStore.setActiveConversationId).toHaveBeenCalledWith('conv-1');
    });

    it('should not call setActiveConversationId on API error', async () => {
      const mockResponse = { ok: false };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleLoadConversation('conv-1');
      });

      expect(mockChatDataStore.setActiveConversationId).not.toHaveBeenCalled();
      expect(mockSetMessages).not.toHaveBeenCalled();
    });

    it('should handle API error gracefully', async () => {
      const mockResponse = { ok: false };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleLoadConversation('conv-1');
      });

      expect(mockSetMessages).not.toHaveBeenCalled();
    });

    it('should handle fetch exception', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleLoadConversation('conv-1');
      });

      expect(mockSetMessages).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteConversation', () => {
    it('should delete conversation from server and store on success', async () => {
      const mockResponse = { ok: true };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleDeleteConversation('conv-1');
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/conversations/conv-1', { method: 'DELETE' });
      expect(mockRemoveConversation).toHaveBeenCalledWith('conv-1');
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Deleted',
        description: 'Conversation deleted successfully.'
      });
    });

    it('should show error toast on failure', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Not found' })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleDeleteConversation('conv-1');
      });

      expect(mockRemoveConversation).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Gagal',
        description: 'Not found',
        variant: 'destructive',
      });
    });

    it('should handle connection error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChatActions(jest.fn()));

      await act(async () => {
        await result.current.handleDeleteConversation('conv-1');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Error',
        description: 'Gagal terhubung ke server',
        variant: 'destructive',
      });
    });
  });

  describe('handleEditConfirm', () => {
    it('should edit message and send new content', async () => {
      jest.useFakeTimers();
      const mockHandleSend = jest.fn();
      const { result } = renderHook(() => useChatActions(mockHandleSend));

      const messages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'Hi' },
        { id: 'msg-3', role: 'user', content: 'Edit this' }
      ];
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        messages,
        isGenerating: false,
      }));

      await act(async () => {
        result.current.handleEditConfirm('msg-3', 'Updated content');
      });

      expect(mockSetMessages).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'msg-1' }),
        expect.objectContaining({ id: 'msg-2' }),
      ]);

      act(() => {
        jest.runAllTimers();
      });

      expect(mockHandleSend).toHaveBeenCalledWith('Updated content');
      jest.useRealTimers();
    });

    it('should not edit if message not found', async () => {
      const mockHandleSend = jest.fn();
      const { result } = renderHook(() => useChatActions(mockHandleSend));

      const messages = [
        { id: 'msg-1', role: 'user', content: 'Hello' }
      ];
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        messages,
        isGenerating: false,
      }));

      await act(async () => {
        result.current.handleEditConfirm('nonexistent', 'Updated');
      });

      expect(mockSetMessages).not.toHaveBeenCalled();
      expect(mockHandleSend).not.toHaveBeenCalled();
    });

    it('should not edit if currently generating', async () => {
      const mockHandleSend = jest.fn();
      const { result } = renderHook(() => useChatActions(mockHandleSend));

      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
        isGenerating: true,
      }));

      await act(async () => {
        result.current.handleEditConfirm('msg-1', 'Updated');
      });

      expect(mockSetMessages).not.toHaveBeenCalled();
      expect(mockHandleSend).not.toHaveBeenCalled();
    });
  });

  describe('handleRegenerate', () => {
    it('should regenerate last assistant response', async () => {
      jest.useFakeTimers();
      const mockHandleSend = jest.fn();
      const { result } = renderHook(() => useChatActions(mockHandleSend));

      const messages = [
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'First response' },
        { id: 'msg-3', role: 'user', content: 'Second question' },
        { id: 'msg-4', role: 'assistant', content: 'Second response' }
      ];
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        messages,
        isGenerating: false,
      }));

      await act(async () => {
        result.current.handleRegenerate();
      });

      expect(mockSetRegeneratingMessageId).toHaveBeenCalledWith('msg-4');
      expect(mockSetMessages).toHaveBeenCalledWith([
        { id: 'msg-1', role: 'user', content: 'Hello' },
        { id: 'msg-2', role: 'assistant', content: 'First response' },
        { id: 'msg-3', role: 'user', content: 'Second question' }
      ]);

      act(() => {
        jest.runAllTimers();
      });

      expect(mockHandleSend).toHaveBeenCalledWith('Second question');
      jest.useRealTimers();
    });

    it('should not regenerate if no assistant message found', async () => {
      const mockHandleSend = jest.fn();
      const { result } = renderHook(() => useChatActions(mockHandleSend));

      const messages = [
        { id: 'msg-1', role: 'user', content: 'Hello' }
      ];
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        messages,
        isGenerating: false,
      }));

      await act(async () => {
        result.current.handleRegenerate();
      });

      expect(mockSetRegeneratingMessageId).not.toHaveBeenCalled();
      expect(mockSetMessages).not.toHaveBeenCalled();
      expect(mockHandleSend).not.toHaveBeenCalled();
    });

    it('should not regenerate if currently generating', async () => {
      const mockHandleSend = jest.fn();
      const { result } = renderHook(() => useChatActions(mockHandleSend));

      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello' },
          { id: 'msg-2', role: 'assistant', content: 'Hi' }
        ],
        isGenerating: true,
      }));

      await act(async () => {
        result.current.handleRegenerate();
      });

      expect(mockSetRegeneratingMessageId).not.toHaveBeenCalled();
      expect(mockSetMessages).not.toHaveBeenCalled();
      expect(mockHandleSend).not.toHaveBeenCalled();
    });
  });

  describe('deductCredit', () => {
    it('should deduct credit successfully and update store', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          credit: 900,
          totalSpent: 100,
          creditLog: {
            id: 'log-1',
            user_id: 'user-1',
            type: 'deduction',
            amount: -100,
            balance: 900,
            description: 'AI usage'
          }
        })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const deductResult = await act(async () => {
        return await result.current.deductCredit(100);
      });

      expect(deductResult).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/billing/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 })
      });
      expect(mockChatDataStore.setCredit).toHaveBeenCalledWith(900);
      expect(mockChatDataStore.setTotalSpent).toHaveBeenCalledWith(100);
      expect(mockChatDataStore.setCreditLogs).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'log-1' }),
        ...mockChatDataStore.creditLogs
      ]);
    });

    it('should not deduct if amount is zero or negative', async () => {
      const { result } = renderHook(() => useChatActions(jest.fn()));

      const deductResult1 = await act(async () => {
        return await result.current.deductCredit(0);
      });
      expect(deductResult1).toBe(true);

      const deductResult2 = await act(async () => {
        return await result.current.deductCredit(-50);
      });
      expect(deductResult2).toBe(true);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle deduction failure and show error toast', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Insufficient balance' })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const deductResult = await act(async () => {
        return await result.current.deductCredit(100);
      });

      expect(deductResult).toBe(false);
      expect(mockChatDataStore.setCredit).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Gagal Mengurangi Kredit',
        description: 'Insufficient balance',
        variant: 'destructive',
      });
    });

    it('should handle network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const deductResult = await act(async () => {
        return await result.current.deductCredit(100);
      });

      expect(deductResult).toBe(false);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Gagal Mengurangi Kredit',
        description: 'Network error',
        variant: 'destructive',
      });
    });
  });

  describe('addCredit', () => {
    it('should add credit successfully and update store', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          credit: 1100,
          creditLog: {
            id: 'log-2',
            user_id: 'user-1',
            type: 'topup',
            amount: 100,
            balance: 1100,
            description: 'Top up'
          }
        })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      let addResult: boolean = false;
      await act(async () => {
        addResult = await result.current.addCredit(100);
      });

      expect(addResult).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 100 })
      });
      expect(mockChatDataStore.setCredit).toHaveBeenCalledWith(1100);
      expect(mockChatDataStore.setCreditLogs).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'log-2' }),
        ...mockChatDataStore.creditLogs
      ]);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Berhasil',
        description: '+100 kredit ditambahkan',
      });
    });

    it('should not add if amount is zero or negative', async () => {
      const { result } = renderHook(() => useChatActions(jest.fn()));

      let addResult1: boolean = false;
      await act(async () => {
        addResult1 = await result.current.addCredit(0);
      });
      expect(addResult1).toBe(false);

      let addResult2: boolean = false;
      await act(async () => {
        addResult2 = await result.current.addCredit(-50);
      });
      expect(addResult2).toBe(false);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle topup failure and show error toast', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Invalid amount' })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      let addResult: boolean = false;
      await act(async () => {
        addResult = await result.current.addCredit(100);
      });

      expect(addResult).toBe(false);
      expect(mockChatDataStore.setCredit).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Gagal Top Up',
        description: 'Invalid amount',
        variant: 'destructive',
      });
    });
  });

  describe('addUsageLog', () => {
    it('should add usage log successfully and update store', async () => {
      const mockResponse = { ok: true };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const entry: Record<string, unknown> = {
        id: 'usage-1',
        user_id: 'user-1',
        modelId: 'gpt-4',
        modelName: 'gpt-4',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        inputCost: 0.5,
        outputCost: 1.0,
        totalCost: 1.5,
        category: 'chat',
        conversationId: 'conv-1',
        createdAt: new Date().toISOString()
      };

      let logResult: boolean = false;
      await act(async () => {
        logResult = await result.current.addUsageLog(entry);
      });

      expect(logResult).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      expect(mockChatDataStore.setUsageLogs).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'usage-1' }),
        ...mockChatDataStore.usageLogs
      ]);
    });

    it('should not add duplicate usage logs', async () => {
      const mockResponse = { ok: true };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const existingEntry: Record<string, unknown> = {
        id: 'existing-1',
        user_id: 'user-1',
        modelId: 'gpt-4',
        modelName: 'gpt-4',
        provider: 'openai',
        inputTokens: 100,
        outputTokens: 50,
        inputCost: 0.5,
        outputCost: 1.0,
        totalCost: 1.5,
        category: 'chat',
        conversationId: 'conv-1',
        createdAt: new Date().toISOString()
      };
      mockChatDataStore.usageLogs = [existingEntry];

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const entry = { ...existingEntry };

      let logResult: boolean = false;
      await act(async () => {
        logResult = await result.current.addUsageLog(entry);
      });

      expect(logResult).toBe(true);
      expect(mockChatDataStore.setUsageLogs).not.toHaveBeenCalled();
    });

    it('should handle usage log failure', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Server error' })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const entry = {
        id: 'usage-1',
        user_id: 'user-1',
        model_name: 'gpt-4',
        input_tokens: 100,
        output_tokens: 50,
        total_cost: 1.5
      };

      let logResult: boolean = false;
      await act(async () => {
        logResult = await result.current.addUsageLog(entry);
      });

      expect(logResult).toBe(false);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Gagal Menyimpan Log',
        description: 'Server error',
        variant: 'destructive',
      });
    });
  });

  describe('addCreditLog', () => {
    it('should add credit log successfully and update store', async () => {
      const mockResponse = { ok: true };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const entry: Record<string, unknown> = {
        id: 'credit-1',
        user_id: 'user-1',
        type: 'topup',
        amount: 100,
        balance: 1100,
        description: 'Top up via wallet',
        createdAt: new Date().toISOString()
      };

      let logResult: boolean = false;
      await act(async () => {
        logResult = await result.current.addCreditLog(entry);
      });

      expect(logResult).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('/api/billing/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      expect(mockChatDataStore.setCreditLogs).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'credit-1' }),
        ...mockChatDataStore.creditLogs
      ]);
    });

    it('should not add duplicate credit logs', async () => {
      const mockResponse = { ok: true };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const existingEntry: Record<string, unknown> = {
        id: 'existing-1',
        user_id: 'user-1',
        type: 'topup',
        amount: 100,
        balance: 1100,
        description: 'Top up',
        createdAt: new Date().toISOString()
      };
      mockChatDataStore.creditLogs = [existingEntry];

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const entry = { ...existingEntry };

      let logResult: boolean = false;
      await act(async () => {
        logResult = await result.current.addCreditLog(entry);
      });

      expect(logResult).toBe(true);
      expect(mockChatDataStore.setCreditLogs).not.toHaveBeenCalled();
    });

    it('should handle credit log failure', async () => {
      const mockResponse = {
        ok: false,
        json: jest.fn().mockResolvedValue({ error: 'Database error' })
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatActions(jest.fn()));

      const entry = {
        id: 'credit-1',
        user_id: 'user-1',
        type: 'deduction',
        amount: -50,
        balance: 950,
        description: 'AI usage'
      };

      let logResult: boolean = false;
      await act(async () => {
        logResult = await result.current.addCreditLog(entry);
      });

      expect(logResult).toBe(false);
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Gagal Menyimpan Log',
        description: 'Database error',
        variant: 'destructive',
      });
    });
  });
});
