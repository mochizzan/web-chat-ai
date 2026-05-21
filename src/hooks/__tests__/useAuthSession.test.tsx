import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useChatDataStore, ChatDataState } from '@/lib/store';
import { create } from 'zustand';

// Mock dependencies
jest.mock('@/lib/store');

const mockUseChatDataStore = useChatDataStore as jest.MockedFunction<typeof useChatDataStore>;

describe('useAuthSession', () => {
  const mockLogin = jest.fn();
  const mockLogout = jest.fn();
  const mockSetConversations = jest.fn();
  const mockSetTotalSpent = jest.fn();
  const mockSetUsageLogs = jest.fn();
  const mockSetCredit = jest.fn();

  const useMockStore = create<ChatDataState>((set) => ({
    isLoggedIn: false,
    user: null,
    credit: 0,
    totalSpent: 0,
    conversations: [],
    usageLogs: [],
    // Mock other required state fields to avoid TS errors
    activeConversationId: null,
    activeCategory: 'chat',
    activeModel: '',
    messages: [],
    models: [],
    codeBlocks: [],
    selectedCodeBlock: null,
    creditLogs: [],
    thinkingEnabled: true,
    webSearchEnabled: false,

    login: jest.fn().mockImplementation((user) => {
      mockLogin(user);
      set({ isLoggedIn: true, user, credit: user.credit ?? 0, totalSpent: user.totalSpent ?? 0 });
    }),
    logout: jest.fn().mockImplementation(() => {
      mockLogout();
      set({ isLoggedIn: false, user: null, credit: 0, totalSpent: 0, conversations: [], usageLogs: [] });
    }),
    setConversations: jest.fn().mockImplementation((conversations) => {
      mockSetConversations(conversations);
      set({ conversations });
    }),
    setTotalSpent: jest.fn().mockImplementation((totalSpent) => {
      mockSetTotalSpent(totalSpent);
      set({ totalSpent });
    }),
    setUsageLogs: jest.fn().mockImplementation((usageLogs) => {
      mockSetUsageLogs(usageLogs);
      set({ usageLogs });
    }),
    setCredit: jest.fn().mockImplementation((credit) => {
      mockSetCredit(credit);
      set({ credit });
    }),
    // Implement other actions as no-ops to satisfy type
    setActiveConversationId: () => {},
    setActiveCategory: () => {},
    setActiveModel: () => {},
    setMessages: () => {},
    addMessage: () => {},
    replaceTempAndAddResponse: () => {},
    removeLastMessage: () => {},
    removeMessagesFrom: () => {},
    addConversation: () => {},
    updateConversationLastMessage: () => {},
    removeConversation: () => {},
    setModels: () => {},
    addModel: () => {},
    removeModel: () => {},
    toggleModelActive: () => {},
    updateModelPricing: () => {},
    updateModel: () => {},
    toggleModelFree: () => {},
    addCodeBlock: () => {},
    updateCodeBlock: () => {},
    updateCodeBlockByFileName: () => {},
    setCodeBlocks: () => {},
    setSelectedCodeBlock: () => {},
    markCodeBlockOpened: () => {},
    clearCodeBlocks: () => {},
    setUser: () => {},
    setUserCredit: () => {},
    addUserCredit: () => {},
    resetAccount: () => {},
    resetChat: () => {},
    setThinkingEnabled: () => {},
    setWebSearchEnabled: () => {},
    toggleThinking: () => {},
    setCreditLogs: () => {},
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    
    // Reset store state
    useMockStore.setState({
      isLoggedIn: false,
      user: null,
      credit: 0,
      totalSpent: 0,
      conversations: [],
      usageLogs: [],
    });

    mockUseChatDataStore.mockImplementation((selector) => {
      return selector ? selector(useMockStore()) : useMockStore();
    });
  });

  describe('session initialization', () => {
    it('should initialize session successfully on mount', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        credit: 1000,
        totalSpent: 0,
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me');
      expect(mockLogin).toHaveBeenCalledWith(mockUser);
      expect(mockSetCredit).toHaveBeenCalledWith(1000);
      expect(mockSetTotalSpent).toHaveBeenCalledWith(0);
    });

    it('should handle nested response structure', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        credit: 500,
        totalSpent: 100,
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { user: mockUser }
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      expect(mockLogin).toHaveBeenCalledWith(mockUser);
    });

    it('should logout when session invalid', async () => {
      const mockResponse = {
        ok: false,
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('should logout on fetch error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('server data fetching', () => {
    it('should fetch conversations, account data, and usage logs when logged in', async () => {
      // First call to /api/auth/me succeeds
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      // Conversations response
      const convResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          conversations: [
            { id: 'conv-1', title: 'Test Conversation', model: 'gpt-4' }
          ]
        }),
      };

      // Account response
      const accountResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            totalSpent: 50,
            user: { credit: 950 }
          }
        }),
      };

      // Usage logs response
      const usageResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            usageLogs: [
              { id: 'log-1', model_name: 'gpt-4', total_cost: 10 }
            ]
          }
        }),
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(convResponse)
        .mockResolvedValueOnce(accountResponse)
        .mockResolvedValueOnce(usageResponse);

      const { result } = renderHook(() => useAuthSession());

      // Wait for login to complete
      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      // Wait for data fetching to complete
      await waitFor(() => {
        expect(mockSetConversations).toHaveBeenCalledWith([
          { id: 'conv-1', title: 'Test Conversation', model: 'gpt-4' }
        ]);
      });

      expect(mockSetTotalSpent).toHaveBeenCalledWith(50);
      expect(mockSetCredit).toHaveBeenCalledWith(expect.any(Number));
      expect(mockSetUsageLogs).toHaveBeenCalledWith([
        { id: 'log-1', model_name: 'gpt-4', total_cost: 10 }
      ]);
    });

    it('should not fetch data when not logged in', async () => {
      // Set store state to not logged in
      useMockStore.setState({ isLoggedIn: false });
      mockUseChatDataStore.mockImplementation((selector) => {
        return selector ? selector(useMockStore()) : useMockStore();
      });

      const authResponse = {
        ok: false,
      };
      global.fetch = jest.fn().mockResolvedValue(authResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(false);
      });

      // Only /api/auth/me should be called
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me');
    });

    it('should handle failed conversations fetch gracefully', async () => {
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      const convResponse = {
        ok: false,
        status: 500,
      };

      const accountResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { totalSpent: 50 }
        }),
      };

      const usageResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { usageLogs: [] }
        }),
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(convResponse)
        .mockResolvedValueOnce(accountResponse)
        .mockResolvedValueOnce(usageResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      // Should continue despite conversation fetch failure
      expect(mockSetTotalSpent).toHaveBeenCalledWith(50);
      expect(mockSetUsageLogs).toHaveBeenCalledWith([]);
    });

    it('should handle failed account fetch gracefully', async () => {
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      const convResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          conversations: []
        }),
      };

      const accountResponse = {
        ok: false,
        status: 500,
      };

      const usageResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { usageLogs: [] }
        }),
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(convResponse)
        .mockResolvedValueOnce(accountResponse)
        .mockResolvedValueOnce(usageResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      // Should continue despite account fetch failure
      expect(mockSetConversations).toHaveBeenCalledWith([]);
      expect(mockSetUsageLogs).toHaveBeenCalledWith([]);
    });

    it('should handle failed usage logs fetch gracefully', async () => {
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      const convResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          conversations: []
        }),
      };

      const accountResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { totalSpent: 50 }
        }),
      };

      const usageResponse = {
        ok: false,
        status: 500,
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(convResponse)
        .mockResolvedValueOnce(accountResponse)
        .mockResolvedValueOnce(usageResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      // Should continue despite usage logs fetch failure
      expect(mockSetConversations).toHaveBeenCalledWith([]);
      expect(mockSetTotalSpent).toHaveBeenCalledWith(50);
    });

    it('should cancel pending requests on unmount', async () => {
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      // Create a promise that never resolves to simulate hanging request
      const hangingPromise = new Promise(() => {});
      const convResponse = {
        ok: true,
        json: jest.fn().mockReturnValue(hangingPromise),
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(convResponse);

      const { result, unmount } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      unmount();

      // The component should clean up without errors
      // The hanging promise should be abandoned
    });
  });

  describe('loading state', () => {
    it('should show loading while fetching server data', async () => {
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      // Delay the response to test loading state
      let resolveConv: (value: unknown) => void;
      const convPromise = new Promise(resolve => {
        resolveConv = resolve!;
      });

      const convResponse = {
        ok: true,
        json: jest.fn().mockReturnValue(convPromise),
      };

      global.fetch = jest.fn().mockImplementation((url) => {
        if (url === '/api/auth/me') return Promise.resolve(authResponse);
        if (url === '/api/conversations') return Promise.resolve(convResponse);
        if (url === '/api/account') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
        if (url === '/api/usage?limit=100') return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) });
        return Promise.resolve({ ok: false });
      });

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(true);
      });

      // Initially loading should be true
      expect(result.current.isLoadingConversations).toBe(true);

      // Resolve the hanging promise
      await act(async () => {
        resolveConv({ conversations: [] });
      });

      await waitFor(() => {
        expect(result.current.isLoadingConversations).toBe(false);
      }, { timeout: 5000 });
    });
  });

  describe('edge cases', () => {
    it('should handle missing user data in response', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}), // No user data
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(result.current.isLoggedIn).toBe(false);
      });

      expect(mockLogin).not.toHaveBeenCalled();
    });

    it('should handle null credit and totalSpent', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        credit: null,
        totalSpent: null,
      };
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ user: mockUser }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(mockSetCredit).toHaveBeenCalledWith(0);
        expect(mockSetTotalSpent).toHaveBeenCalledWith(0);
      });
    });

    it('should handle empty conversations array', async () => {
      const authResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          user: { id: 'user-1', credit: 1000, totalSpent: 0 }
        }),
      };

      const convResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          conversations: []
        }),
      };

      const accountResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { totalSpent: 0 }
        }),
      };

      const usageResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: { usageLogs: [] }
        }),
      };

      global.fetch = jest.fn()
        .mockResolvedValueOnce(authResponse)
        .mockResolvedValueOnce(convResponse)
        .mockResolvedValueOnce(accountResponse)
        .mockResolvedValueOnce(usageResponse);

      renderHook(() => useAuthSession());

      await waitFor(() => {
        expect(mockSetConversations).toHaveBeenCalledWith([]);
      });
    });
  });
});
