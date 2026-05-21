import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─────────────────────────────────────────────
// Shared Types (exported for consumers)
// ─────────────────────────────────────────────

export type ModelStatus = 'active' | 'maintenance' | 'disabled';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ConversationPreview {
  id: string;
  title: string;
  model: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  lastMessage: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  } | null;
}

export type SpeedTier = 'fast' | 'normal' | 'slow' | 'overloaded';
export type DiscountType = 'none' | 'input' | 'output' | 'both';

export interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  status: ModelStatus;
  maxContext: number;
  thinking: boolean;
  inputPrice: number;  // price per 1M input tokens in USD
  outputPrice: number; // price per 1M output tokens in USD
  free: boolean;       // if true, no credit deducted

  // Speed & Discount
  speed: SpeedTier;
  discountPercent: number; // 0-100
  discountType: DiscountType;
}

export interface CodeBlock {
  id: string;
  messageId: string;
  language: string;
  fileName: string;
  code: string;
  version: number;       // incremented each time the same file is updated
  createdAt: string;     // ISO date when first created
  updatedAt: string;     // ISO date when last updated
  opened: boolean;       // whether the file has been opened/viewed in the sidebar
}

export type CodeBlockInput = Omit<CodeBlock, 'version' | 'createdAt' | 'updatedAt' | 'opened'>;

export interface UsageLogEntry {
  id: string;
  conversationId: string | null;
  modelId: string;
  modelName: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  category: string;
  createdAt: string;
}

export interface CreditLogEntry {
  id: string;
  type: 'topup' | 'usage';
  amount: number; // positive for topup, negative for usage
  balance: number; // balance after this transaction
  description: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  createdAt: string;
}

// ─────────────────────────────────────────────
// Slice 1: UI Store
// State: sidebar, dialogs, account UI, streaming indicators
// ─────────────────────────────────────────────

interface UIState {
  sidebarOpen: boolean;
  codeSidebarOpen: boolean;
  accountDialogOpen: boolean;
  accountTab: 'overview' | 'topup';
  isGenerating: boolean;
  isWebSearching: boolean;
  editingMessageId: string | null;
  regeneratingMessageId: string | null;
  streamingContent: string;
  streamingThinkingContent: string;
  isStreaming: boolean;
  isThinkingStreaming: boolean;

  // ─── UI Actions ───────────────────────────────
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCodeSidebarOpen: (open: boolean) => void;
  toggleCodeSidebar: () => void;
  setAccountDialogOpen: (open: boolean) => void;
  setAccountTab: (tab: 'overview' | 'topup') => void;
  setIsGenerating: (generating: boolean) => void;
  setIsWebSearching: (searching: boolean) => void;
  setEditingMessageId: (id: string | null) => void;
  setRegeneratingMessageId: (id: string | null) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (chunk: string) => void;
  setStreamingThinkingContent: (content: string) => void;
  appendStreamingThinkingContent: (chunk: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setIsThinkingStreaming: (streaming: boolean) => void;
  clearStreaming: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      codeSidebarOpen: false,
      accountDialogOpen: false,
      accountTab: 'overview',
      isGenerating: false,
      isWebSearching: false,
      editingMessageId: null,
      regeneratingMessageId: null,
      streamingContent: '',
      streamingThinkingContent: '',
      isStreaming: false,
      isThinkingStreaming: false,

      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setCodeSidebarOpen: (open) => set({ codeSidebarOpen: open }),
      toggleCodeSidebar: () => set((state) => ({ codeSidebarOpen: !state.codeSidebarOpen })),
      setAccountDialogOpen: (open) => set({ accountDialogOpen: open }),
      setAccountTab: (tab) => set({ accountTab: tab }),
      setIsGenerating: (generating) => set({ isGenerating: generating }),
      setIsWebSearching: (searching) => set({ isWebSearching: searching }),
      setEditingMessageId: (id) => set({ editingMessageId: id }),
      setRegeneratingMessageId: (id) => set({ regeneratingMessageId: id }),
      setStreamingContent: (content) => set({ streamingContent: content }),
      appendStreamingContent: (chunk) =>
        set((state) => ({ streamingContent: state.streamingContent + chunk })),
      setStreamingThinkingContent: (content) => set({ streamingThinkingContent: content }),
      appendStreamingThinkingContent: (chunk) =>
        set((state) => ({ streamingThinkingContent: state.streamingThinkingContent + chunk })),
      setIsStreaming: (streaming) => set({ isStreaming: streaming }),
      setIsThinkingStreaming: (streaming) => set({ isThinkingStreaming: streaming }),
      clearStreaming: () =>
        set({ streamingContent: '', streamingThinkingContent: '', isStreaming: false, isThinkingStreaming: false }),
    }),
    {
      name: 'z-ai-ui-store',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// ─────────────────────────────────────────────
// Slice 2: Chat Data Store
// State: messages, conversations, models, billing, user auth state
// ─────────────────────────────────────────────

export interface ChatDataState {
  activeConversationId: string | null;
  activeCategory: string;
  activeModel: string;
  messages: Message[];
  conversations: ConversationPreview[];
  models: Model[];
  codeBlocks: CodeBlock[];
  selectedCodeBlock: CodeBlock | null;
  credit: number;
  totalSpent: number;
  usageLogs: UsageLogEntry[];
  creditLogs: CreditLogEntry[];
  user: UserProfile | null;
  isLoggedIn: boolean;
  thinkingEnabled: boolean;
  webSearchEnabled: boolean;

  // ─── Data Actions ─────────────────────────────
  setActiveConversationId: (id: string | null) => void;
  setActiveCategory: (category: string) => void;
  setActiveModel: (model: string) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  replaceTempAndAddResponse: (tempId: string, userMsg: Message, assistantMsg: Message) => void;
  removeLastMessage: () => void;
  removeMessagesFrom: (id: string) => void;
  setConversations: (conversations: ConversationPreview[]) => void;
  addConversation: (conversation: ConversationPreview) => void;
  updateConversationLastMessage: (id: string, lastMessage: ConversationPreview['lastMessage'], updatedAt?: string) => void;
  removeConversation: (id: string) => void;
  setModels: (models: Model[]) => void;
  addModel: (model: Model) => void;
  removeModel: (modelId: string) => void;
  toggleModelActive: (modelId: string) => void;
  updateModelPricing: (modelId: string, inputPrice: number, outputPrice: number) => void;
  updateModel: (modelId: string, updates: Partial<Model>) => void;
  toggleModelFree: (modelId: string) => void;
  addCodeBlock: (block: CodeBlockInput) => void;
  updateCodeBlock: (id: string, updates: Partial<CodeBlock>) => void;
  updateCodeBlockByFileName: (fileName: string, updates: Partial<CodeBlock>) => void;
  setCodeBlocks: (blocks: CodeBlock[]) => void;
  setSelectedCodeBlock: (block: CodeBlock | null) => void;
  markCodeBlockOpened: (id: string) => void;
  clearCodeBlocks: () => void;
  setCredit: (credit: number) => void;
  setTotalSpent: (spent: number) => void;
  setUsageLogs: (logs: UsageLogEntry[]) => void;
  setCreditLogs: (logs: CreditLogEntry[]) => void;
  setUser: (user: UserProfile | null) => void;
  login: (user: UserProfile) => void;
  logout: () => void;
  setUserCredit: (userId: string, credit: number) => void;
  addUserCredit: (userId: string, amount: number) => void;
  resetAccount: () => void;
  resetChat: () => void;
  setThinkingEnabled: (enabled: boolean) => void;
  setWebSearchEnabled: (enabled: boolean) => void;
  toggleThinking: () => void;
}

const DEFAULT_MODELS: Model[] = [];

export const useChatDataStore = create<ChatDataState>()(
  persist(
    (set) => ({
      activeConversationId: null,
      activeCategory: 'chat',
      activeModel: '',
      messages: [],
      conversations: [],
      models: DEFAULT_MODELS,
      codeBlocks: [],
      selectedCodeBlock: null,
      credit: 0,
      totalSpent: 0,
      usageLogs: [],
      creditLogs: [],
      user: null,
      isLoggedIn: false,
      thinkingEnabled: true,
      webSearchEnabled: false,

      setActiveConversationId: (id) => set({ activeConversationId: id }),
      setActiveCategory: (category) => set({ activeCategory: category }),
      setActiveModel: (model) => set({ activeModel: model }),
      setMessages: (messages) => set({ messages }),
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      replaceTempAndAddResponse: (tempId, userMsg, assistantMsg) =>
        set((state) => ({
          messages: [
            ...state.messages.map((m) => (m.id === tempId ? userMsg : m)),
            assistantMsg,
          ],
        })),
      removeLastMessage: () =>
        set((state) => ({
          messages: state.messages.slice(0, -1),
        })),
      removeMessagesFrom: (id) =>
        set((state) => {
          const index = state.messages.findIndex((m) => m.id === id);
          if (index === -1) return {};
          return { messages: state.messages.slice(0, index) };
        }),
      setConversations: (conversations) => set({ conversations }),
      addConversation: (conversation) =>
        set((state) => ({
          conversations: [conversation, ...state.conversations],
        })),
      updateConversationLastMessage: (id, lastMessage, updatedAt) =>
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id
              ? { ...c, lastMessage, updatedAt: updatedAt || new Date().toISOString() }
              : c
          ),
        })),
      removeConversation: (id) =>
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
          messages: state.activeConversationId === id ? [] : state.messages,
          usageLogs: state.activeConversationId === id
            ? []
            : state.usageLogs.filter((l) => l.conversationId !== id),
        })),
      setModels: (models) => set({ models }),
      addModel: (model) => set((state) => ({ models: [...state.models, model] })),
      removeModel: (modelId) =>
        set((state) => ({ models: state.models.filter((m) => m.id !== modelId) })),
      toggleModelActive: (modelId) =>
        set((state) => {
          const model = state.models.find((m) => m.id === modelId);
          if (!model) return state;
          const newStatus: ModelStatus = model.status === 'active' ? 'disabled' : 'active';
          return {
            models: state.models.map((m) => (m.id === modelId ? { ...m, status: newStatus } : m)),
          };
        }),
      updateModelPricing: (modelId, inputPrice, outputPrice) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === modelId ? { ...m, inputPrice, outputPrice } : m)),
        })),
      updateModel: (modelId, updates) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === modelId ? { ...m, ...updates } : m)),
        })),
      toggleModelFree: (modelId) =>
        set((state) => ({
          models: state.models.map((m) => (m.id === modelId ? { ...m, free: !m.free } : m)),
        })),
      addCodeBlock: (block) =>
        set((state) => {
          const now = new Date().toISOString();
          const existingByIdx = state.codeBlocks.findIndex((b) => b.id === block.id);
          if (existingByIdx !== -1) {
            const existing = state.codeBlocks[existingByIdx];
            const codeChanged = existing.code !== block.code;
            if (!codeChanged) return state;
            const updatedBlock: CodeBlock = {
              ...existing,
              code: block.code,
              language: block.language,
              version: existing.version,
              updatedAt: now,
              opened: existing.opened,
            };
            const newBlocks = [...state.codeBlocks];
            newBlocks[existingByIdx] = updatedBlock;
            const newSelected =
              state.selectedCodeBlock?.id === existing.id ? updatedBlock : state.selectedCodeBlock;
            return { codeBlocks: newBlocks, selectedCodeBlock: newSelected };
          }
          const streamingIdx = state.codeBlocks.findIndex(
            (b) =>
              b.fileName === block.fileName &&
              b.messageId === 'streaming' &&
              block.messageId !== 'streaming'
          );
          if (streamingIdx !== -1) {
            const streamingBlock = state.codeBlocks[streamingIdx];
            const updatedBlock: CodeBlock = {
              id: block.id,
              messageId: block.messageId,
              language: block.language,
              fileName: block.fileName,
              code: block.code,
              version: streamingBlock.version,
              createdAt: streamingBlock.createdAt,
              updatedAt: now,
              opened: streamingBlock.opened,
            };
            const newBlocks = [...state.codeBlocks];
            newBlocks[streamingIdx] = updatedBlock;
            const newSelected =
              state.selectedCodeBlock?.id === streamingBlock.id
                ? updatedBlock
                : state.selectedCodeBlock;
            return { codeBlocks: newBlocks, selectedCodeBlock: newSelected };
          }
          const sameNameBlocks = state.codeBlocks.filter((b) => b.fileName === block.fileName);
          const nextVersion =
            sameNameBlocks.length > 0
              ? Math.max(...sameNameBlocks.map((b) => b.version || 1)) + 1
              : 1;
          const newBlock: CodeBlock = {
            id: block.id,
            messageId: block.messageId,
            language: block.language,
            fileName: block.fileName,
            code: block.code,
            version: nextVersion,
            createdAt: now,
            updatedAt: now,
            opened: false,
          };
          return { codeBlocks: [...state.codeBlocks, newBlock] };
        }),
      updateCodeBlock: (id, updates) =>
        set((state) => ({
          codeBlocks: state.codeBlocks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        })),
      updateCodeBlockByFileName: (fileName, updates) =>
        set((state) => ({
          codeBlocks: state.codeBlocks.map((b) =>
            b.fileName === fileName ? { ...b, ...updates } : b
          ),
        })),
      setCodeBlocks: (blocks) => set({ codeBlocks: blocks }),
      setSelectedCodeBlock: (block) => set({ selectedCodeBlock: block }),
      markCodeBlockOpened: (id) =>
        set((state) => ({
          codeBlocks: state.codeBlocks.map((b) => (b.id === id ? { ...b, opened: true } : b)),
          selectedCodeBlock:
            state.selectedCodeBlock?.id === id
              ? { ...state.selectedCodeBlock, opened: true }
              : state.selectedCodeBlock,
        })),
      clearCodeBlocks: () => set({ codeBlocks: [], selectedCodeBlock: null }),

      setCredit: (credit) => set({ credit }),
      setTotalSpent: (spent) => set({ totalSpent: spent }),
      setUsageLogs: (logs) => set({ usageLogs: logs }),

      // ─── Pure auth state setters (no async logic) ───
      setUser: (user) => set({ user, isLoggedIn: !!user }),
      login: (user) => set({ user, isLoggedIn: true }),
      logout: () =>
        set({
          user: null,
          isLoggedIn: false,
          credit: 0,
          totalSpent: 0,
          conversations: [],
          usageLogs: [],
          creditLogs: [],
          messages: [],
          activeConversationId: null,
        }),

      setUserCredit: (userId, credit) =>
        set((state) => ({
          credit: state.user?.id === userId ? credit : state.credit,
        })),
      addUserCredit: (userId, amount) =>
        set((state) => ({
          credit: state.user?.id === userId ? state.credit + amount : state.credit,
        })),
      resetAccount: () =>
        set(() => ({
          credit: 0,
          totalSpent: 0,
          usageLogs: [],
          creditLogs: [],
        })),
      resetChat: () =>
        set({
          activeConversationId: null,
          messages: [],
          codeBlocks: [],
          selectedCodeBlock: null,
          usageLogs: [],
        }),

      setThinkingEnabled: (enabled) => set({ thinkingEnabled: enabled }),
      setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
      toggleThinking: () => set((state) => ({ thinkingEnabled: !state.thinkingEnabled })),
      setCreditLogs: (logs) => set({ creditLogs: logs }),
    }),
    {
      name: 'z-ai-chat-store',
      partialize: (state) => ({
        activeModel: state.activeModel,
        activeCategory: state.activeCategory,
        thinkingEnabled: state.thinkingEnabled,
        webSearchEnabled: state.webSearchEnabled,
        models: state.models,
        user: state.user
          ? { id: state.user.id, name: state.user.name, role: state.user.role }
          : null,
        isLoggedIn: state.isLoggedIn,
        // Persist as cache so data doesn't vanish on refresh
        conversations: state.conversations,
        usageLogs: state.usageLogs.slice(0, 100),
        creditLogs: state.creditLogs.slice(0, 50),
      }),
    }
  )
);

// ─────────────────────────────────────────────
// useChatStore — Unified backward-compat accessor
// Merges UIStore + ChatDataStore into a single selector hook.
// All existing consumers (useChatStore()) continue to work unchanged.
// ─────────────────────────────────────────────

type ChatState = UIState & ChatDataState;

/**
 * Backward-compatible unified store hook.
 * Delegates to useUIStore + useChatDataStore under the hood.
 * Use the individual slices (useUIStore / useChatDataStore) for new code.
 */
export function useChatStore(): ChatState;
export function useChatStore<T>(selector: (state: ChatState) => T): T;
export function useChatStore<T>(selector?: (state: ChatState) => T): ChatState | T {
  const uiState = useUIStore();
  const chatDataState = useChatDataStore();
  const merged: ChatState = { ...uiState, ...chatDataState };
  if (selector) return selector(merged);
  return merged;
}

// Expose getState for imperative access (e.g., useChatStore.getState())
useChatStore.getState = (): ChatState => ({
  ...useUIStore.getState(),
  ...useChatDataStore.getState(),
});
