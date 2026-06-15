'use client';

import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { Bot, Brain, ChevronDown, Globe, FolderOpen } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore, useChatDataStore, useShallow } from '@/lib/store';
import { FAKE_STREAM_CONFIG } from '@/config/stream-config';
import { HashLoader } from 'react-spinners';
import {
  MarkdownContent,
  ThinkingSection,
  CodeBadge,
  StreamingCodeContainer,
  extractCodeBlocks,
  stripCodeBlocks,
  extractIncompleteCodeBlock,
  stripIncompleteCodeBlock,
  generateFileName,
  MessageBubble,
} from './message-bubble';

// ─── Web Search indicator — shown while backend searches ──────
function WebSearchIndicator() {
  return (
    <div className="flex items-start gap-2.5 px-4 sm:px-6 py-2">
      <Avatar className="h-7 w-7 shrink-0 border border-border/30">
        <AvatarFallback className="bg-primary/8 text-primary">
          <HashLoader size={14} color="currentColor" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <div className="w-fit rounded-2xl rounded-tl-sm border border-sky-500/15 bg-sky-500/[0.03] dark:bg-sky-500/[0.06] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-sky-600/70 dark:text-sky-400/60">
              Mencari informasi di web...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator with HashLoader ──────────────────────
function TypingIndicator() {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const generationStatus = useChatStore((s) => s.generationStatus);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => { clearInterval(timer); };
  }, []);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="flex items-start gap-2.5 px-4 sm:px-6 py-2">
      <Avatar className="h-7 w-7 shrink-0 border border-border/30">
        <AvatarFallback className="bg-primary/8 text-primary">
          <HashLoader size={14} color="currentColor" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <div className="w-fit rounded-2xl rounded-tl-sm border border-border/25 bg-card px-3.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-primary">
              {generationStatus || 'Membuat koneksi ke AI...'}
            </span>
          </div>
        </div>
        {elapsed > 3 && (
          <span className="text-[10px] text-muted-foreground/35 ml-1 tabular-nums">
            Menunggu respons... {formatElapsed(elapsed)}
          </span>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ content }: { content: string }) {
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const [visibleLength, setVisibleLength] = useState(0);
  const prevStableLengthRef = useRef(0);

  // Timer setup for elapsed thinking time
  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (visibleLength < content.length) {
      const timer = setTimeout(() => {
        setVisibleLength((prev) => Math.min(prev + FAKE_STREAM_CONFIG.AVG_WORD_LENGTH, content.length));
      }, FAKE_STREAM_CONFIG.MS_PER_WORD);
      return () => clearTimeout(timer);
    }
  }, [visibleLength, content]);

  // Auto-scroll thinking content as it streams
  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = contentAreaRef.current.scrollHeight;
    }
  }, [visibleLength]);

  // Track stable length for fade-in split
  useEffect(() => {
    prevStableLengthRef.current = visibleLength;
  }, [visibleLength]);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const stableText = content.slice(0, prevStableLengthRef.current);
  const newText = content.slice(prevStableLengthRef.current, visibleLength);

  return (
    <div className="flex items-start gap-2.5 px-4 sm:px-6 py-2">
      <Avatar className="h-7 w-7 shrink-0 border border-amber-500/20">
        <AvatarFallback className="bg-amber-500/8 text-amber-600/70 dark:text-amber-400/60">
          <HashLoader size={14} color="currentColor" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="w-fit max-w-[95%] rounded-2xl rounded-tl-sm border border-amber-500/15 bg-amber-500/[0.03] dark:bg-amber-500/[0.06] px-3.5 py-2.5">
          {/* Header */}
          <button
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center gap-2 w-full text-left group"
          >
            <ChevronDown className={`h-3.5 w-3.5 text-amber-600/50 dark:text-amber-400/50 transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
            <span className="text-xs font-semibold text-amber-600/70 dark:text-amber-400/60 flex items-center gap-1.5">
              <Brain className="h-3 w-3" />
              Sedang berpikir...
            </span>
            <span className="text-[10px] text-amber-600/35 dark:text-amber-400/35 tabular-nums ml-auto">
              {formatElapsed(elapsed)}
            </span>
          </button>

          {/* Thinking content - collapsible with auto-scroll */}
          {isExpanded && content.length > 0 && (
            <div
              ref={contentAreaRef}
              className="mt-2 pl-2 border-l-2 border-amber-500/15 max-h-[140px] overflow-y-auto custom-scrollbar"
            >
              <p className="text-[12px] leading-relaxed text-amber-700/50 dark:text-amber-300/40 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {stableText}
                {newText && (
                  <span className="chunk-fade-in">{newText}</span>
                )}
                <span className="inline-block w-1 h-3 bg-amber-500/30 animate-pulse ml-0.5 align-middle" />
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Streaming bubble — shows content as it arrives ────────────
function StreamingBubble({ 
  content, 
  thinkingContent, 
  onVisualComplete,
  onScroll 
}: { 
  content: string;
  thinkingContent: string;
  onVisualComplete: () => void;
  onScroll?: () => void;
}) {
  const { isStreaming, isThinkingStreaming, setCodeSidebarOpen, setSelectedCodeBlock, codeBlocks } = useChatStore();
  const [visibleLength, setVisibleLength] = useState(0);
  const [phase, setPhase] = useState<'thinking' | 'responding'>(!thinkingContent ? 'responding' : 'thinking');
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const prevDisplayLenRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = Date.now();
    const timer = setInterval(() => {
      if (startTimeRef.current !== null) {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Phase 'responding' is only set when there is no thinking content at all.
    // When thinking content exists, the phase transition is controlled by
    // ThinkingSection.onComplete() — which fires after the thinking fake stream
    // animation finishes. This ensures thinking content is fully revealed
    // word-by-word before the content phase begins.
    if (!thinkingContent) {
      setPhase('responding');
    }
  }, [thinkingContent]);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  useEffect(() => {
    if (visibleLength < content.length && phase === 'responding') {
      const timer = setTimeout(() => {
        setVisibleLength((prev) => Math.min(prev + FAKE_STREAM_CONFIG.AVG_WORD_LENGTH, content.length));
      }, FAKE_STREAM_CONFIG.MS_PER_WORD);
      return () => clearTimeout(timer);
    }
  }, [visibleLength, content, phase]);

  useEffect(() => {
    if (phase === 'responding' && onScroll) {
      onScroll();
    }
  }, [visibleLength, phase, onScroll]);

  // Visual Completion Handshake:
  // Signal completion only when:
  // 1. We are in the responding phase
  // 2. The server has stopped streaming (!isStreaming)
  // 3. The visual reveal has caught up to the total content length
  useEffect(() => {
    if (phase === 'responding' && !isStreaming && visibleLength === content.length && content.length > 0) {
      console.log(`[FakeStream-Response] Finalizing: visibleLength(${visibleLength}) === content.length(${content.length}) and !isStreaming`);
      onVisualComplete();
    }
  }, [phase, isStreaming, visibleLength, content.length, onVisualComplete]);

  const currentContent = useMemo(() => {
    let length = visibleLength;
    if (length >= content.length) return content;
    
    let slice = content.slice(0, length);
    
    // Snap to complete code block markers (```) to prevent jarring layout shifts
    if (slice.endsWith('`')) {
      const remaining = content.slice(length);
      const match = remaining.match(/^`{0,2}/);
      if (match) length += match[0].length;
    }
    
    // Snap to complete bold/italic markers (** or __)
    if (slice.endsWith('*') || slice.endsWith('_')) {
      const char = slice.slice(-1);
      const remaining = content.slice(length);
      if (remaining.startsWith(char)) length += 1;
    }
    
    return content.slice(0, length);
  }, [content, visibleLength]);

  // Extract COMPLETED code blocks (have closing ```)
  const extractedBlocks = useMemo(() => {
    if (!currentContent) return [];
    return extractCodeBlocks(currentContent);
  }, [currentContent]);

  // Detect INCOMPLETE code block (still streaming, no closing ```)
  const incompleteBlock = useMemo(() => {
    if (!currentContent) return null;
    return extractIncompleteCodeBlock(currentContent);
  }, [currentContent]);

  // Display content: strip both complete AND incomplete code blocks
  const displayContent = useMemo(() => {
    if (!currentContent) return '';
    // First strip complete blocks, then strip incomplete
    const withoutComplete = stripCodeBlocks(currentContent);
    return stripIncompleteCodeBlock(withoutComplete);
  }, [currentContent]);

  // Track stable display length so we only fade-in newly revealed characters
  useEffect(() => {
    prevDisplayLenRef.current = displayContent.length;
  }, [displayContent]);

  const hasTextContent = displayContent.length > 0;

  const handleCodeBadgeClick = useCallback((fileName: string) => {
    // Find the latest version of the file (highest version number)
    const sameNameBlocks = codeBlocks.filter((b) => b.fileName === fileName);
    const latestBlock = sameNameBlocks.length > 0
      ? sameNameBlocks.reduce((a, b) => (a.version || 1) > (b.version || 1) ? a : b)
      : null;
    if (latestBlock) { setSelectedCodeBlock(latestBlock); setCodeSidebarOpen(true); }
  }, [codeBlocks, setSelectedCodeBlock, setCodeSidebarOpen]);

  // Determine if we should show the blinking cursor outside code containers
  // The cursor now stops blinking as soon as the fake stream catches up to the actual content,
  // providing a visual cue that the message is "complete" even before the server sends the 'done' event.
  const showBlinkingCursor = isStreaming && !isThinkingStreaming && !incompleteBlock && visibleLength < content.length;

  // Split displayContent at the previously rendered length so only the new
  // chunk receives the fade-in animation. The already-revealed text stays stable.
  const stableMarkdownLen = Math.min(prevDisplayLenRef.current, displayContent.length);
  const stableMarkdown = displayContent.slice(0, stableMarkdownLen);
  const newMarkdown = displayContent.slice(stableMarkdownLen);

  return (
    <div className="relative">
      <style jsx global>{`
        .streaming-reveal-container {
          animation: stream-fade-in 0.3s ease-out;
        }
        @keyframes stream-fade-in {
          from { opacity: 0.7; transform: translateY(1px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chunk-fade-in {
          animation: chunk-fade-in ${FAKE_STREAM_CONFIG.FADE_IN_MS}ms ease-out;
        }
        @keyframes chunk-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
      <div className="flex items-start gap-2.5 px-4 sm:px-6 py-1">
      <Avatar className={`h-7 w-7 shrink-0 border mt-0.5 bg-background overflow-hidden transition-colors ${phase === 'thinking' ? 'border-amber-500/20' : 'border-border/25'}`}>
        <AvatarImage src="/logo.png" alt="AI Avatar" className="object-contain p-1" />
        <AvatarFallback className={`${phase === 'thinking' ? 'bg-amber-500/8 text-amber-600/70 dark:text-amber-400/60' : 'bg-primary/8 text-primary'}`}>
          {phase === 'thinking' ? <HashLoader size={14} color="currentColor" /> : <Bot className="h-3.5 w-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="w-fit max-w-[95%] min-w-0 rounded-2xl rounded-tl-sm border border-border/20 bg-card text-card-foreground px-3.5 py-2.5 overflow-hidden">

            {/* Show thinking section if we have thinking content */}
            {thinkingContent && (
              <div className="relative streaming-reveal-container">
                <ThinkingSection
                  content={thinkingContent}
                  initialExpanded={true}
                  onComplete={() => {
                    setPhase('responding');
                    // Bridge: notify store that thinking animation is complete.
                    // This allows isAIActive to eventually become false and
                    // the permanent MessageBubble to appear.
                    useChatStore.getState().setIsThinkingStreaming(false);
                  }}
                  disabled={phase === 'responding'}
                  onScroll={onScroll}
                />
                {phase === 'thinking' && (
                  <div className="absolute top-0 right-0 -mt-1">
                    <span className="text-[10px] text-amber-600/35 dark:text-amber-400/35 tabular-nums px-1">
                      {formatElapsed(elapsed)}
                    </span>
                  </div>
                )}
              </div>
            )}

           {phase === 'responding' && (
             <>
               {hasTextContent && (
                 <div className="streaming-reveal-container">
                   <MarkdownContent content={stableMarkdown} />
                   {newMarkdown && (
                     <span className="chunk-fade-in">
                       <MarkdownContent content={newMarkdown} />
                     </span>
                   )}
                 </div>
               )}

               {/* Incomplete code block — streaming code in mini editor container */}
               {incompleteBlock && (
                 <div className={`${hasTextContent ? 'mt-3' : ''} max-w-full`}>
                   <StreamingCodeContainer
                     language={incompleteBlock.language}
                     fileName={generateFileName(incompleteBlock.language, extractedBlocks.length, incompleteBlock.fileName)}
                     code={incompleteBlock.code}
                   />
                 </div>
               )}

               {/* Completed code blocks — shown as clickable badges */}
               {extractedBlocks.length > 0 && (
                 <div className={`${hasTextContent || incompleteBlock ? 'mt-3 pt-2.5 border-t border-border/15' : ''}`}>
                   <div className="flex items-center gap-1.5 mb-2">
                     <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
                     <span className="text-[11px] font-semibold text-muted-foreground">{extractedBlocks.length} file kode</span>
                   </div>
                   <div className="flex flex-wrap gap-2 max-w-full">
                     {extractedBlocks.map((block, idx) => {
                       const fileName = generateFileName(block.language, idx, block.fileName);
                       return (
                         <CodeBadge
                           key={`streaming-code-${idx}`}
                           language={block.language}
                           fileName={fileName}
                           onClick={() => handleCodeBadgeClick(fileName)}
                         />
                       );
                     })}
                   </div>
                 </div>
               )}
             </>
           )}

          {/* Blinking cursor — only when no incomplete code (code container has its own cursor) */}
          {showBlinkingCursor && (
            <span className="inline-block w-0.5 h-4 bg-primary/50 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

// ─── Main message list ────────────────────────────────────────
export function MessageList({ onEditConfirm, onRegenerate }: { onEditConfirm?: (messageId: string, newContent: string) => void; onRegenerate?: () => void }) {
  // UI selectors
  const { isGenerating, setIsGenerating, clearStreaming } =
    useUIStore(useShallow(s => ({
      isGenerating: s.isGenerating,
      setIsGenerating: s.setIsGenerating,
      clearStreaming: s.clearStreaming,
    })));

  // Data selectors
  const { messages, streamingContent, streamingThinkingContent, isThinkingStreaming, isWebSearching } =
    useChatDataStore(useShallow(s => ({
      messages: s.messages,
      streamingContent: s.streamingContent,
      streamingThinkingContent: s.streamingThinkingContent,
      isThinkingStreaming: s.isThinkingStreaming,
      isWebSearching: s.isWebSearching,
    })));

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Find the latest user message ID
  const latestUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') return messages[i].id;
    }
    return null;
  }, [messages]);

  // Find the latest assistant message ID
  const latestAssistantMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  const handleEditConfirm = useCallback((messageId: string, newContent: string) => {
    if (onEditConfirm) {
      onEditConfirm(messageId, newContent);
    }
  }, [onEditConfirm]);

  const handleRegenerate = useCallback(() => {
    if (onRegenerate) {
      onRegenerate();
    }
  }, [onRegenerate]);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScrollEnabled(isAtBottom);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (autoScrollEnabled && scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [autoScrollEnabled]);

  useEffect(() => {
    if (isGenerating) {
      setAutoScrollEnabled(true);
    }
  }, [isGenerating]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      setAutoScrollEnabled(true);
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isGenerating, streamingContent, streamingThinkingContent, scrollToBottom]);

  // Determine what to show while generating
  const isAIActive = isGenerating && (isThinkingStreaming || streamingThinkingContent.length > 0 || streamingContent.length > 0);
  const showTypingIndicator = isGenerating && !isAIActive;

  return (
    <div 
      ref={scrollRef} 
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-4"
    >
      <div className="mx-auto max-w-4xl w-full px-4 sm:px-6 space-y-8">
        {messages.map((msg) => {
          if ((isAIActive || showTypingIndicator) && msg.id === latestAssistantMessageId) {
            return null;
          }
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLatestUserMessage={msg.id === latestUserMessageId}
              isLatestAssistantMessage={msg.id === latestAssistantMessageId}
              onEditConfirm={handleEditConfirm}
              onRegenerate={handleRegenerate}
            />
          );
        })}

        {/* Web Search indicator — shown while backend is searching */}
        {isWebSearching && (
          <WebSearchIndicator />
        )}

        {/* Unified Streaming Bubble - handles both thinking and responding phases */}
        {isAIActive && (
          <StreamingBubble 
            content={streamingContent} 
            thinkingContent={streamingThinkingContent} 
            onVisualComplete={() => {
              setIsGenerating(false);
              clearStreaming();
            }} 
            onScroll={scrollToBottom}
          />
        )}

        {/* Typing indicator (waiting for first response) */}
        {showTypingIndicator && !isWebSearching && <TypingIndicator />}
      </div>
    </div>
  );
}
