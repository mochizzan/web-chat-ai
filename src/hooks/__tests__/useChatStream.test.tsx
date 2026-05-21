import { renderHook, act } from '@testing-library/react';
import { useChatStream } from '@/hooks/useChatStream';
import { useChatStore } from '@/lib/store';
import { useChatActions } from '@/hooks/useChatActions';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
jest.mock('@/lib/store');
jest.mock('@/hooks/useChatActions');
jest.mock('@/hooks/use-toast');

const mockUseChatStore = useChatStore as jest.MockedFunction<typeof useChatStore>;
const mockUseChatActions = useChatActions as jest.MockedFunction<typeof useChatActions>;
const mockUseToast = useToast as jest.MockedFunction<typeof useToast>;

// Mock TextDecoder
class MockTextDecoder {
  decode(value: Uint8Array, options?: { stream: boolean }): string {
    return String.fromCharCode(...value);
  }
}
global.TextDecoder = MockTextDecoder as typeof TextDecoder;

describe('useChatStream', () => {
  const mockToast = jest.fn();
  const mockAddMessage = jest.fn();
  const mockSetIsGenerating = jest.fn();
  const mockClearStreaming = jest.fn();
  const mockAddConversation = jest.fn();
  const mockSetActiveConversationId = jest.fn();
  const mockUpdateConversationLastMessage = jest.fn();
  const mockSetIsStreaming = jest.fn();
  const mockSetIsThinkingStreaming = jest.fn();
  const mockAppendStreamingThinkingContent = jest.fn();
  const mockSetIsWebSearching = jest.fn();
  const mockAppendStreamingContent = jest.fn();
  const mockSetRegeneratingMessageId = jest.fn();
  const mockSetMessages = jest.fn();

  const mockChatStore = {
    activeConversationId: null,
    activeModel: 'gpt-4',
    activeCategory: 'assistant',
    thinkingEnabled: true,
    webSearchEnabled: false,
    isGenerating: false,
    isStreaming: false,
    isThinkingStreaming: false,
    credit: 1000,
    messages: [],
    streamingContent: '',
    streamingThinkingContent: '',
    addMessage: mockAddMessage,
    setIsGenerating: mockSetIsGenerating,
    clearStreaming: mockClearStreaming,
    addConversation: mockAddConversation,
    setActiveConversationId: mockSetActiveConversationId,
    updateConversationLastMessage: mockUpdateConversationLastMessage,
    setIsStreaming: mockSetIsStreaming,
    setIsThinkingStreaming: mockSetIsThinkingStreaming,
    appendStreamingThinkingContent: mockAppendStreamingThinkingContent,
    setIsWebSearching: mockSetIsWebSearching,
    appendStreamingContent: mockAppendStreamingContent,
    setRegeneratingMessageId: mockSetRegeneratingMessageId,
    setMessages: mockSetMessages,
    getState: jest.fn(() => ({
      ...mockChatStore,
      isGenerating: false,
      credit: 1000,
      messages: [],
    })),
    setCodeSidebarOpen: jest.fn(),
    addCodeBlock: jest.fn(),
  };

  const mockAddCodeBlock = jest.fn();
  const mockSetCodeSidebarOpen = jest.fn();


  const mockChatActions = {
    deductCredit: jest.fn(),
    addUsageLog: jest.fn(),
    addCredit: jest.fn(),
    addCreditLog: jest.fn(),
  };

  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Reset mockChatStore properties that tests may have modified
    mockChatStore.isGenerating = false;
    mockChatStore.getState = jest.fn(() => ({
      ...mockChatStore,
      isGenerating: false,
      credit: 1000,
      messages: [],
    }));

    mockUseToast.mockReturnValue({ toast: mockToast, dismiss: jest.fn(), toasts: [] });
    mockUseChatStore.mockImplementation((selector) => {
      if (typeof selector === 'function') {
        return selector(mockChatStore as unknown as Record<string, unknown>);
      }
      return mockChatStore as unknown as Record<string, unknown>;
    });
    // Mock static getState method
    (useChatStore as unknown as { getState: jest.Mock }).getState = jest.fn(() => mockChatStore.getState());
    mockUseChatActions.mockReturnValue(mockChatActions as unknown as Record<string, unknown>);
  });

  describe('handleSend', () => {
    it('should not send if already generating', async () => {
      mockChatStore.isGenerating = true;
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: true,
        credit: 1000,
        messages: [],
      }));

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockChatStore.getState().addMessage).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not send if credit is zero or negative', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 0,
        messages: [],
      }));

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Kredit Habis',
        description: 'Kredit Anda sudah habis. Silakan reset di pengaturan akun.',
        variant: 'destructive',
      });
      expect(mockChatStore.getState().addMessage).not.toHaveBeenCalled();
    });

    it('should send message and handle SSE stream response', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 1000,
        messages: [],
      }));

      // Create a mock SSE stream
      const sseData = `data: {"type":"init","conversationId":"conv-1","userMessage":{"id":"user-1","role":"user","content":"Hello","createdAt":"2024-01-01"},"assistantMessageId":"assistant-1"}

data: {"type":"thinking","content":"Thinking..."}

data: {"type":"delta","content":"Hello"}

data: {"type":"done","usage":{"modelId":"gpt-4","modelName":"GPT-4","provider":"openai","inputTokens":10,"outputTokens":5,"inputCost":0.01,"outputCost":0.02,"totalCost":0.03,"creditRemaining":999.97,"logId":"log-1","createdAt":"2024-01-01"}}

`;

      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(sseData) })
          .mockResolvedValueOnce({ done: true, value: undefined }),
        releaseLock: jest.fn(),
      };

      const mockBody = {
        getReader: jest.fn().mockReturnValue(mockReader),
      };

      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/event-stream'),
        },
        body: mockBody,
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockAddMessage).toHaveBeenCalledWith({
        id: expect.stringMatching(/^temp-user-/),
        role: 'user',
        content: 'Hello',
        createdAt: expect.any(String),
      });
      expect(mockSetIsGenerating).toHaveBeenCalledWith(true);
      expect(mockChatActions.deductCredit).toHaveBeenCalledWith(0.03);
      expect(mockChatActions.addUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log-1',
          conversationId: 'conv-1',
          modelId: 'gpt-4',
          totalCost: 0.03,
        })
      );
    });

    it('should handle non-streaming JSON response', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 1000,
        messages: [],
      }));

      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('application/json'),
        },
        json: jest.fn().mockResolvedValue({
          conversationId: 'conv-1',
          userMessage: {
            id: 'user-1',
            content: 'Hello',
            createdAt: '2024-01-01',
          },
          assistantMessage: {
            id: 'assistant-1',
            content: 'Hi there',
            createdAt: '2024-01-01',
          },
          usage: {
            logId: 'log-1',
            conversationId: 'conv-1',
            modelId: 'gpt-4',
            modelName: 'GPT-4',
            provider: 'openai',
            inputTokens: 10,
            outputTokens: 5,
            inputCost: 0.01,
            outputCost: 0.02,
            totalCost: 0.03,
            createdAt: '2024-01-01',
          },
        }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockAddMessage).toHaveBeenCalledWith({
        id: expect.stringMatching(/^temp-user-/),
        role: 'user',
        content: 'Hello',
        createdAt: expect.any(String),
      });
      expect(mockChatActions.deductCredit).toHaveBeenCalledWith(0.03);
      expect(mockChatActions.addUsageLog).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'log-1',
          totalCost: 0.03,
        })
      );
    });

    it('should handle API error response', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 1000,
        messages: [],
      }));

      const mockResponse = {
        ok: false,
        status: 402,
        headers: {
          get: jest.fn().mockReturnValue('application/json'),
        },
        json: jest.fn().mockResolvedValue({ error: 'Insufficient credits' }),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Kredit Habis',
        description: 'Kredit Anda sudah habis. Silakan reset di pengaturan akun.',
        variant: 'destructive',
      });
      expect(mockSetIsGenerating).toHaveBeenCalledWith(false);
    });

    it('should handle network error', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 1000,
        messages: [],
      }));

      mockFetch.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Koneksi Terputus',
        description: 'Respons AI terputus. Pesan parsial telah disimpan.',
        variant: 'destructive',
      });
    });
  });

  describe('handleStop', () => {
    it('should stop streaming and save partial content', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        streamingContent: 'Partial response',
        streamingThinkingContent: 'Thinking process',
        messages: [
          { id: 'temp-1', role: 'user', content: 'Hello', createdAt: '2024-01-01' },
        ],
        clearStreaming: mockClearStreaming,
        setIsGenerating: mockSetIsGenerating,
      }));

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        result.current.handleStop();
      });

      expect(mockChatStore.getState().setMessages).toHaveBeenCalledWith([
        { id: 'temp-1', role: 'user', content: 'Hello', createdAt: '2024-01-01' },
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Partial response'),
        }),
      ]);
      expect(mockClearStreaming).toHaveBeenCalled();
      expect(mockSetIsGenerating).toHaveBeenCalledWith(false);
    });

    it('should not add message if no streaming content', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        streamingContent: '',
        streamingThinkingContent: '',
        messages: [
          { id: 'temp-1', role: 'user', content: 'Hello', createdAt: '2024-01-01' },
        ],
        clearStreaming: mockClearStreaming,
        setIsGenerating: mockSetIsGenerating,
      }));

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        result.current.handleStop();
      });

      // When no streaming content, setMessages should NOT be called (no new message added)
      expect(mockSetMessages).not.toHaveBeenCalled();
      expect(mockClearStreaming).toHaveBeenCalled();
      expect(mockSetIsGenerating).toHaveBeenCalledWith(false);
    });
  });

  describe('SSE event processing', () => {
    it('should handle credit_warning event', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 100,
        messages: [],
      }));

      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/event-stream'),
        },
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(
                `data: {"type":"credit_warning","level":"low","message":"Credit low"}\n\n`
              )})
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: jest.fn(),
          }),
        },
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Kredit Rendah',
        })
      );
    });

    it('should handle credit_error event', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 0,
        messages: [
          { id: 'temp-1', role: 'user', content: 'Hello', createdAt: '2024-01-01' },
        ],
        setAccountDialogOpen: jest.fn(),
      }));

      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/event-stream'),
        },
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(
                `data: {"type":"credit_error","code":"INSUFFICIENT_CREDITS","message":"Not enough credits"}\n\n`
              )})
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: jest.fn(),
          }),
        },
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Kredit Habis',
        description: 'Kredit Anda sudah habis. Silakan reset di pengaturan akun.',
        variant: 'destructive',
      });
    });

    it('should handle web_search events', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 1000,
        messages: [],
        webSearchEnabled: true,
      }));

      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/event-stream'),
        },
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(
                `data: {"type":"web_search","status":"searching","message":"Searching..."}\n\n` +
                `data: {"type":"web_search","status":"results_found","message":"Found 5 results","resultCount":5}\n\n`
              )})
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: jest.fn(),
          }),
        },
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Hello');
      });

      expect(mockSetIsWebSearching).toHaveBeenCalledWith(true);
      expect(mockSetIsWebSearching).toHaveBeenCalledWith(false);
    });

    it('should parse and save code blocks from response', async () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        isGenerating: false,
        credit: 1000,
        messages: [],
        addCodeBlock: mockAddCodeBlock,
        setCodeSidebarOpen: mockSetCodeSidebarOpen,
      }));

      const codeBlockContent = "console.log('Hello');";
      const mockResponse = {
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('text/event-stream'),
        },
        body: {
          getReader: jest.fn().mockReturnValue({
            read: jest.fn()
              .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode(
                `data: {"type":"init","conversationId":"conv-1","userMessage":{"id":"user-1","role":"user","content":"Write code","createdAt":"2024-01-01"},"assistantMessageId":"assistant-1"}\n\n` +
                `data: {"type":"delta","content":"Here is some code:\\n\\n\`\`\`javascript\\n${codeBlockContent}\\n\`\`\`"}\n\n` +
                `data: {"type":"done"}\n\n`
              )})
              .mockResolvedValueOnce({ done: true, value: undefined }),
            releaseLock: jest.fn(),
          }),
        },
      };

      mockFetch.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useChatStream());

      await act(async () => {
        await result.current.handleSend('Write code');
      });

      expect(mockAddCodeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'javascript',
          fileName: 'file-1.js',
          code: codeBlockContent,
        })
      );
    });
  });

  describe('parseAndSaveCodeBlocks', () => {
    it('should extract code blocks with language and filename', () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        setCodeSidebarOpen: mockSetCodeSidebarOpen,
        addCodeBlock: mockAddCodeBlock,
      }));

      const { result } = renderHook(() => useChatStream());

      const content = `
Here is some TypeScript code:

\`\`\`typescript:src/components/Button.tsx
import React from 'react';

const Button: React.FC = () => {
  return <button>Click me</button>;
};

export default Button;
\`\`\`

And some Python:

\`\`\`python
def hello():
    print("Hello")
\`\`\`
`;

      act(() => {
        result.current.parseAndSaveCodeBlocks(content, 'msg-1');
      });

      expect(mockAddCodeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-1',
          language: 'typescript',
          fileName: 'src/components/Button.tsx',
          code: expect.stringContaining('import React'),
        })
      );

      expect(mockAddCodeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-1',
          language: 'python',
          fileName: 'file-2.py',
          code: expect.stringContaining('def hello'),
        })
      );

      expect(mockSetCodeSidebarOpen).toHaveBeenCalled();
    });

    it('should generate default filename if not provided', () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        setCodeSidebarOpen: mockSetCodeSidebarOpen,
        addCodeBlock: mockAddCodeBlock,
      }));

      const { result } = renderHook(() => useChatStream());

      const content = `
\`\`\`javascript
console.log('test');
\`\`\`
`;

      act(() => {
        result.current.parseAndSaveCodeBlocks(content, 'msg-1');
      });

      expect(mockAddCodeBlock).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: 'file-1.js',
        })
      );
    });

    it('should not add empty code blocks', () => {
      mockChatStore.getState = jest.fn(() => ({
        ...mockChatStore,
        setCodeSidebarOpen: mockSetCodeSidebarOpen,
        addCodeBlock: mockAddCodeBlock,
      }));

      const { result } = renderHook(() => useChatStream());

      const content = `
\`\`\`javascript
\`\`\`
`;

      act(() => {
        result.current.parseAndSaveCodeBlocks(content, 'msg-1');
      });

      expect(mockAddCodeBlock).not.toHaveBeenCalled();
    });
  });
});
