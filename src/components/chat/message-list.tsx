'use client';

import { useEffect, useRef, useMemo, useState, useCallback, type ReactNode } from 'react';
import gsap from 'gsap';
import ReactMarkdown from 'react-markdown';
import { Bot, FileCode2, FolderOpen, Pencil, Copy, Check, Brain, ChevronDown, Loader2, Globe, X, Send, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useChatStore, type Message } from '@/lib/store';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Language badge colors — MD3 soft, muted tones
const LANGUAGE_COLORS: Record<string, string> = {
  javascript: 'bg-yellow-600/8 text-yellow-700/80 dark:text-yellow-400/60 border-yellow-600/12',
  js: 'bg-yellow-600/8 text-yellow-700/80 dark:text-yellow-400/60 border-yellow-600/12',
  typescript: 'bg-sky-600/8 text-sky-700/80 dark:text-sky-400/60 border-sky-600/12',
  ts: 'bg-sky-600/8 text-sky-700/80 dark:text-sky-400/60 border-sky-600/12',
  python: 'bg-primary/8 text-primary/80 border-primary/12',
  py: 'bg-primary/8 text-primary/80 border-primary/12',
  html: 'bg-orange-600/8 text-orange-700/80 dark:text-orange-400/60 border-orange-600/12',
  css: 'bg-violet-600/8 text-violet-700/80 dark:text-violet-400/60 border-violet-600/12',
  jsx: 'bg-teal-600/8 text-teal-700/80 dark:text-teal-400/60 border-teal-600/12',
  tsx: 'bg-teal-600/8 text-teal-700/80 dark:text-teal-400/60 border-teal-600/12',
  bash: 'bg-stone-600/8 text-stone-600/80 dark:text-stone-400/60 border-stone-600/12',
  shell: 'bg-stone-600/8 text-stone-600/80 dark:text-stone-400/60 border-stone-600/12',
  json: 'bg-stone-600/8 text-stone-600/80 dark:text-stone-400/60 border-stone-600/12',
};

function getLanguageColor(lang: string): string {
  return LANGUAGE_COLORS[lang.toLowerCase()] || 'bg-primary/8 text-primary/80 border-primary/12';
}

const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JS', javascript: 'JS', ts: 'TS', typescript: 'TS',
  py: 'Python', python: 'Python', jsx: 'JSX', tsx: 'TSX',
  html: 'HTML', css: 'CSS', json: 'JSON', bash: 'Shell', shell: 'Shell',
  sql: 'SQL', java: 'Java', cpp: 'C++', c: 'C', go: 'Go', rust: 'Rust',
  php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin', dart: 'Dart',
  yaml: 'YAML', yml: 'YAML', xml: 'XML', markdown: 'MD', md: 'MD',
};

function getLanguageLabel(lang: string): string {
  return LANGUAGE_LABELS[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;
  if (isToday) return timeStr;
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month} ${timeStr}`;
}

// ─── URL detection & auto-link rendering ─────────────────────
const URL_REGEX = /(?<!\]\()(https?:\/\/[^\s\)\]<>"']+)/g;

function linkifyText(text: string): string {
  return text.replace(URL_REGEX, (url) => `[${url}](${url})`);
}

function LinkRenderer({ href, children }: { href?: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/60 transition-colors"
    >
      <Globe className="h-3 w-3 shrink-0 text-primary/60" />
      <span className="truncate max-w-[300px]">{children}</span>
    </a>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const linkified = useMemo(() => linkifyText(content), [content]);
  return (
    <div className="markdown-content text-sm leading-relaxed break-words overflow-wrap-anywhere">
      <ReactMarkdown components={{ a: LinkRenderer }}>{linkified}</ReactMarkdown>
    </div>
  );
}

// ─── Web Search indicator — shown while backend searches ──────
function WebSearchIndicator() {
  const globeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!globeRef.current) return;
    const tween = gsap.to(globeRef.current, {
      rotation: 360,
      duration: 2.5,
      repeat: -1,
      ease: 'none',
    });
    return () => { tween.kill(); };
  }, []);

  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <Avatar className="h-7 w-7 shrink-0 border border-sky-500/20">
        <AvatarFallback className="bg-sky-500/8 text-sky-600/70 dark:text-sky-400/60">
          <div ref={globeRef}>
            <Globe className="h-3.5 w-3.5" />
          </div>
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <div className="rounded-2xl rounded-tl-sm border border-sky-500/15 bg-sky-500/[0.03] dark:bg-sky-500/[0.06] px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 text-sky-500/70 animate-spin" />
            <span className="text-xs font-medium text-sky-600/70 dark:text-sky-400/60">
              Mencari informasi di web...
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Typing indicator with elapsed timer ──────────────────────
function TypingIndicator() {
  const dotsRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!dotsRef.current) return;
    const dots = dotsRef.current.querySelectorAll('.typing-dot');
    const tl = gsap.timeline({ repeat: -1 });
    tl.fromTo(dots, { y: 0, opacity: 0.4 }, { y: -5, opacity: 1, duration: 0.3, stagger: { each: 0.12 }, ease: 'power2.out' })
      .to(dots, { y: 0, opacity: 0.4, duration: 0.3, stagger: { each: 0.12 }, ease: 'power2.in' }, '+=0.1');

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => { tl.kill(); clearInterval(timer); };
  }, []);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <Avatar className="h-7 w-7 shrink-0 border border-border/30">
        <AvatarFallback className="bg-primary/8 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <div className="rounded-2xl rounded-tl-sm border border-border/25 bg-card px-3.5 py-2.5">
          <div ref={dotsRef} className="flex items-center gap-1.5">
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/50" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/50" />
            <span className="typing-dot h-1.5 w-1.5 rounded-full bg-primary/50" />
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

// ─── Thinking animation — brain pulse + streaming thoughts ─────
function ThinkingIndicator({ content }: { content: string }) {
  const brainRef = useRef<HTMLDivElement>(null);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!brainRef.current) return;
    const tween = gsap.to(brainRef.current, {
      scale: 1.12,
      opacity: 0.65,
      duration: 0.9,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });

    const startTime = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => { tween.kill(); clearInterval(timer); };
  }, []);

  // Auto-scroll thinking content as it streams
  useEffect(() => {
    if (contentAreaRef.current) {
      contentAreaRef.current.scrollTop = contentAreaRef.current.scrollHeight;
    }
  }, [content]);

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  // Show last ~300 chars of thinking content as preview
  const previewText = content.length > 300 ? '...' + content.slice(-300) : content;

  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <Avatar className="h-7 w-7 shrink-0 border border-amber-500/20">
        <AvatarFallback className="bg-amber-500/8 text-amber-600/70 dark:text-amber-400/60">
          <div ref={brainRef}>
            <Brain className="h-3.5 w-3.5" />
          </div>
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm border border-amber-500/15 bg-amber-500/[0.03] dark:bg-amber-500/[0.06] px-3.5 py-2.5">
          {/* Header */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <ChevronDown className={`h-3.5 w-3.5 text-amber-600/50 dark:text-amber-400/50 transition-transform duration-300 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
            <span className="text-xs font-semibold text-amber-600/70 dark:text-amber-400/60 flex items-center gap-1.5">
              <Brain className="h-3 w-3" />
              Sedang berpikir...
            </span>
            <span className="text-[10px] text-amber-600/35 dark:text-amber-400/35 tabular-nums ml-auto">
              {formatElapsed(elapsed)}
            </span>
          </button>

          {/* Thinking content - collapsible with auto-scroll */}
          {expanded && content.length > 0 && (
            <div
              ref={contentAreaRef}
              className="mt-2 pl-2 border-l-2 border-amber-500/15 max-h-40 overflow-y-auto custom-scrollbar"
            >
              <p className="text-[12px] leading-relaxed text-amber-700/50 dark:text-amber-300/40 whitespace-pre-wrap break-words overflow-wrap-anywhere">
                {previewText}
                <span className="inline-block w-1 h-3 bg-amber-500/30 animate-pulse ml-0.5 align-middle" />
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Code badge ───────────────────────────────────────────────
function CodeBadge({ language, fileName, onClick }: { language: string; fileName: string; onClick: () => void }) {
  const badgeRef = useRef<HTMLButtonElement>(null);
  const handleClick = useCallback(() => {
    if (badgeRef.current) {
      gsap.fromTo(badgeRef.current, { scale: 0.93 }, { scale: 1, duration: 0.2, ease: 'back.out(2)' });
    }
    onClick();
  }, [onClick]);

  return (
    <button
      ref={badgeRef}
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all hover:shadow-md hover:scale-[1.03] active:scale-[0.97] cursor-pointer max-w-full min-w-0 ${getLanguageColor(language)}`}
    >
      <FileCode2 className="h-3 w-3 shrink-0" />
      <span className="font-semibold truncate">{fileName}</span>
      <span className="opacity-50 shrink-0">·</span>
      <span className="opacity-60 shrink-0">{getLanguageLabel(language)}</span>
    </button>
  );
}

// ─── Streaming code container (shows incomplete code during streaming) ──
const LANG_DOT: Record<string, string> = {
  javascript: 'bg-yellow-500/40', js: 'bg-yellow-500/40', typescript: 'bg-sky-500/40', ts: 'bg-sky-500/40',
  python: 'bg-primary/50', py: 'bg-primary/50', jsx: 'bg-teal-500/40', tsx: 'bg-teal-500/40',
  html: 'bg-orange-500/40', css: 'bg-violet-500/40', json: 'bg-stone-500/40',
  bash: 'bg-stone-500/40', shell: 'bg-stone-500/40', sql: 'bg-stone-500/40',
};

function StreamingCodeContainer({ language, fileName, code }: { language: string; fileName: string; code: string }) {
  const codeRef = useRef<HTMLDivElement>(null);
  const dot = LANG_DOT[language.toLowerCase()] || 'bg-primary/50';

  // Auto-scroll to bottom as code streams in
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code]);

  const lineCount = code.split('\n').length;

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 dark:border-zinc-700/50">
      {/* Editor tab bar */}
      <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-[11px] font-medium text-zinc-400 truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-600">{lineCount} baris</span>
          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
            <Loader2 className="h-2.5 w-2.5 animate-spin" />
            Menulis...
          </span>
        </div>
      </div>

      {/* Code content with max-height and scroll */}
      <div
        ref={codeRef}
        className="overflow-y-auto overflow-x-auto custom-scrollbar bg-zinc-900 max-h-52"
      >
        <div className="flex min-w-fit">
          {/* Line numbers */}
          <div className="flex flex-col items-end px-2.5 py-2.5 select-none border-r border-zinc-800/50 shrink-0 sticky left-0 bg-zinc-900 z-10">
            {code.split('\n').map((_, i) => (
              <span key={i} className="text-[10px] leading-[1.6] text-zinc-600 font-mono">
                {i + 1}
              </span>
            ))}
          </div>
          {/* Code text */}
          <div className="py-2.5 pr-4">
            <pre className="text-[11px] leading-[1.6] text-zinc-300 font-mono whitespace-pre">
              {code}
              <span className="inline-block w-1.5 h-3.5 bg-primary/50 animate-pulse ml-0.5 align-middle" />
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function extractCodeBlocks(content: string): { language: string; code: string; fileName?: string }[] {
  const blocks: { language: string; code: string; fileName?: string }[] = [];
  // Support both ```lang and ```lang:filename formats
  const regex = /```(\w+)(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({ language: match[1] || 'text', code: match[3].trim(), fileName: match[2]?.trim() || undefined });
  }
  return blocks;
}

function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Incomplete code block detection (for streaming) ──────────
interface IncompleteCodeBlock {
  language: string;
  fileName?: string;
  code: string;
}

function extractIncompleteCodeBlock(content: string): IncompleteCodeBlock | null {
  // Remove all COMPLETE code blocks first, then check for an unclosed opening fence
  const withoutComplete = content.replace(/```(\w+)(?::([^\n]+))?\n[\s\S]*?```/g, '');
  const remainingMatch = withoutComplete.match(/```(\w+)(?::([^\n]+))?\n([\s\S]*)$/);
  if (remainingMatch) {
    return {
      language: remainingMatch[1] || 'text',
      fileName: remainingMatch[2]?.trim() || undefined,
      code: remainingMatch[3] || '',
    };
  }
  return null;
}

function stripIncompleteCodeBlock(content: string): string {
  // Remove all complete code blocks
  let result = content.replace(/```(\w+)(?::([^\n]+))?\n[\s\S]*?```/g, '');
  // Remove incomplete code block (opening fence + content to end)
  result = result.replace(/```(\w+)(?::([^\n]+))?\n[\s\S]*$/, '');
  // Clean up extra newlines
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

function generateFileName(language: string, index: number, fileNameHint?: string): string {
  if (fileNameHint) return fileNameHint;
  const extensions: Record<string, string> = {
    javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
    jsx: 'jsx', tsx: 'tsx', python: 'py', py: 'py',
    html: 'html', css: 'css', json: 'json', bash: 'sh', shell: 'sh',
    sql: 'sql', java: 'java', cpp: 'cpp', c: 'c', go: 'go',
    rust: 'rs', php: 'php', ruby: 'rb', swift: 'swift', kotlin: 'kt',
    dart: 'dart', yaml: 'yml', yml: 'yml', xml: 'xml', markdown: 'md', md: 'md',
  };
  const ext = extensions[language.toLowerCase()] || language.toLowerCase();
  return `file-${index + 1}.${ext}`;
}

// ─── Copy button ──────────────────────────────────────────────
function CopyButton({ text, label = 'Salin pesan' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={handleCopy} className="flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground/40 transition-colors hover:text-muted-foreground hover:bg-accent/40">
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] bg-popover text-popover-foreground border border-border/30 shadow-md">
          {copied ? 'Tersalin' : label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Edit button ──────────────────────────────────────────────
function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onClick} className="flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground/40 transition-colors hover:text-muted-foreground hover:bg-accent/40">
            <Pencil className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] bg-popover text-popover-foreground border border-border/30 shadow-md">
          Edit dan kirim ulang pesan ini
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Refresh/Regenerate button ─────────────────────────────────
function RefreshButton({ onClick, isRegenerating }: { onClick: () => void; isRegenerating: boolean }) {
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            disabled={isRegenerating}
            className="flex items-center justify-center rounded-md h-6 w-6 text-muted-foreground/40 transition-colors hover:text-primary hover:bg-primary/8 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] bg-popover text-popover-foreground border border-border/30 shadow-md">
          Generate ulang respons AI
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Thinking section (collapsible, in final messages) ────────
function ThinkingSection({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-amber-600/60 dark:text-amber-400/50 hover:text-amber-700/70 dark:hover:text-amber-300/60 transition-colors group w-full"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
        <Brain className="h-3 w-3" />
        <span className="font-medium">Proses Berpikir</span>
      </button>
      {expanded && (
        <div className="mt-1.5 ml-1 pl-3 border-l-2 border-amber-500/12">
          <p className="text-[12px] leading-relaxed text-amber-700/45 dark:text-amber-300/35 whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Parse thinking from message content ──────────────────────
function parseThinkingContent(content: string): { thinkingContent: string | null; mainContent: string } {
  const match = content.match(/<details>\s*\n<summary>💭 Proses Berpikir<\/summary>\s*\n\n([\s\S]*?)\n\n<\/details>\s*\n\n([\s\S]*)/);
  if (match) {
    return { thinkingContent: match[1].trim(), mainContent: match[2] };
  }
  return { thinkingContent: null, mainContent: content };
}

// ─── Single message component ─────────────────────────────────
function MessageBubble({ message, isLatestUserMessage, isLatestAssistantMessage, onEditConfirm, onRegenerate }: { message: Message; isLatestUserMessage: boolean; isLatestAssistantMessage: boolean; onEditConfirm: (messageId: string, newContent: string) => void; onRegenerate: () => void }) {
  const msgRef = useRef<HTMLDivElement>(null);
  const isUser = message.role === 'user';
  const { addCodeBlock, setCodeSidebarOpen, setSelectedCodeBlock, codeBlocks, regeneratingMessageId } = useChatStore();
  const isThisRegenerating = regeneratingMessageId === message.id;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // Parse thinking content
  const { thinkingContent, mainContent } = useMemo(() => {
    if (isUser) return { thinkingContent: null, mainContent: message.content };
    return parseThinkingContent(message.content);
  }, [message.content, isUser]);

  const extractedBlocks = useMemo(() => {
    if (isUser) return [];
    return extractCodeBlocks(mainContent);
  }, [mainContent, isUser]);

  const displayContent = useMemo(() => {
    if (isUser) return message.content;
    return stripCodeBlocks(mainContent);
  }, [mainContent, isUser, message.content]);

  // Track processed block IDs to prevent infinite loop on re-render
  const processedBlockIds = useRef(new Set<string>());

  // Register code blocks to store — guard against duplicate processing
  useEffect(() => {
    if (isUser || extractedBlocks.length === 0) return;
    extractedBlocks.forEach((block, idx) => {
      const blockId = `${message.id}-code-${idx}`;
      if (processedBlockIds.current.has(blockId)) return;
      processedBlockIds.current.add(blockId);
      addCodeBlock({
        id: blockId, messageId: message.id, language: block.language,
        fileName: generateFileName(block.language, idx, block.fileName), code: block.code,
      });
    });
  }, [extractedBlocks, message.id, isUser, addCodeBlock]);

  // Reset processed set when message changes (new message = new blocks)
  useEffect(() => {
    processedBlockIds.current = new Set<string>();
  }, [message.id]);

  const handleCodeBadgeClick = useCallback((fileName: string) => {
    // Find the latest version of the file (highest version number)
    const sameNameBlocks = codeBlocks.filter((b) => b.fileName === fileName);
    const latestBlock = sameNameBlocks.length > 0
      ? sameNameBlocks.reduce((a, b) => (a.version || 1) > (b.version || 1) ? a : b)
      : null;
    if (latestBlock) { setSelectedCodeBlock(latestBlock); setCodeSidebarOpen(true); }
  }, [codeBlocks, setSelectedCodeBlock, setCodeSidebarOpen]);

  const handleStartEdit = useCallback(() => {
    setEditText(message.content);
    setIsEditing(true);
  }, [message.content]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditText('');
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (editText.trim() && editText.trim() !== message.content) {
      onEditConfirm(message.id, editText.trim());
    }
    setIsEditing(false);
    setEditText('');
  }, [editText, message.id, message.content, onEditConfirm]);

  useEffect(() => {
    if (!msgRef.current) return;
    gsap.fromTo(msgRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
  }, []);

  const hasTextContent = displayContent.length > 0;

  // ─── User message ───────────────────────────────────────
  if (isUser) {
    return (
      <div ref={msgRef} className="flex flex-col items-end px-4 py-1">
        {!isEditing ? (
          <div className="w-fit max-w-[85%] sm:max-w-[75%] min-w-0 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5">
            <MarkdownContent content={displayContent} />
          </div>
        ) : (
          /* Inline edit modal overlay on bubble */
          <div className="w-[85%] sm:w-[75%] max-w-[600px]">
            <div className="rounded-2xl rounded-tr-sm border-2 border-primary/30 bg-card text-card-foreground overflow-hidden shadow-lg">
              {/* Edit header */}
              <div className="flex items-center justify-between px-3.5 py-2 bg-primary/[0.04] border-b border-border/15">
                <div className="flex items-center gap-1.5">
                  <Pencil className="h-3 w-3 text-primary" />
                  <span className="text-[11px] font-semibold text-primary">Edit Pesan</span>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="h-5 w-5 flex items-center justify-center rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent/40 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {/* Edit textarea */}
              <div className="p-3">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full resize-none rounded-lg border border-border/20 bg-background px-3 py-2 text-sm leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/20 min-h-[60px] max-h-[200px]"
                  rows={3}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleConfirmEdit();
                    }
                    if (e.key === 'Escape') {
                      handleCancelEdit();
                    }
                  }}
                />
              </div>
              {/* Edit footer */}
              <div className="flex items-center justify-between px-3 pb-2.5">
                <span className="text-[10px] text-muted-foreground/40">
                  Enter untuk kirim · Esc untuk batal
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-3"
                    onClick={handleCancelEdit}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 gap-1.5 text-[11px] px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleConfirmEdit}
                    disabled={!editText.trim() || editText.trim() === message.content}
                  >
                    <Send className="h-3 w-3" />
                    Kirim Ulang
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-0.5 mr-1">
          <span className="text-[10px] tabular-nums text-muted-foreground/40">{formatMessageTime(message.createdAt)}</span>
          <CopyButton text={message.content} label="Salin pesan" />
          {isLatestUserMessage && !isEditing && <EditButton onClick={handleStartEdit} />}
        </div>
      </div>
    );
  }

  // ─── AI message ─────────────────────────────────────────
  return (
    <div ref={msgRef} className="flex items-start gap-2.5 px-4 py-1">
      <Avatar className="h-7 w-7 shrink-0 border border-border/25 mt-0.5">
        <AvatarFallback className="bg-primary/8 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <div className="max-w-[90%] min-w-0 rounded-2xl rounded-tl-sm border border-border/20 bg-card text-card-foreground px-3.5 py-2.5 overflow-hidden">
          {/* Thinking section (collapsible) */}
          {thinkingContent && <ThinkingSection content={thinkingContent} />}

          {hasTextContent && (
            <MarkdownContent content={displayContent} />
          )}

          {/* Code file badges */}
          {extractedBlocks.length > 0 && (
            <div className={`${hasTextContent ? 'mt-3 pt-2.5 border-t border-border/15' : ''}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <FolderOpen className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[11px] font-semibold text-muted-foreground">{extractedBlocks.length} file kode</span>
              </div>
              <div className="flex flex-wrap gap-2 max-w-full">
                {extractedBlocks.map((block, idx) => {
                  const fileName = generateFileName(block.language, idx, block.fileName);
                  return <CodeBadge key={`${message.id}-code-${idx}`} language={block.language} fileName={fileName} onClick={() => handleCodeBadgeClick(fileName)} />;
                })}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 ml-1">
          <span className="text-[10px] tabular-nums text-muted-foreground/40">{formatMessageTime(message.createdAt)}</span>
          <CopyButton text={message.content} />
          {isLatestAssistantMessage && <RefreshButton onClick={onRegenerate} isRegenerating={isThisRegenerating} />}
        </div>
      </div>
    </div>
  );
}

// ─── Streaming bubble — shows content as it arrives ────────────
function StreamingBubble({ content, thinkingContent }: { content: string; thinkingContent: string }) {
  const { isStreaming, isThinkingStreaming, addCodeBlock, setCodeSidebarOpen, setSelectedCodeBlock, codeBlocks } = useChatStore();

  // Extract COMPLETED code blocks (have closing ```)
  const extractedBlocks = useMemo(() => {
    if (!content) return [];
    return extractCodeBlocks(content);
  }, [content]);

  // Detect INCOMPLETE code block (still streaming, no closing ```)
  const incompleteBlock = useMemo(() => {
    if (!content) return null;
    return extractIncompleteCodeBlock(content);
  }, [content]);

  // Display content: strip both complete AND incomplete code blocks
  const displayContent = useMemo(() => {
    if (!content) return '';
    // First strip complete blocks, then strip incomplete
    const withoutComplete = stripCodeBlocks(content);
    return stripIncompleteCodeBlock(withoutComplete);
  }, [content]);

  const hasTextContent = displayContent.length > 0;

  // Register streaming code blocks to store — always call addCodeBlock, store handles dedup
  useEffect(() => {
    if (extractedBlocks.length === 0) return;
    extractedBlocks.forEach((block, idx) => {
      const fileName = generateFileName(block.language, idx, block.fileName);
      // For streaming: use dedicated streaming ID so it gets replaced when finalized
      addCodeBlock({
        id: `streaming-code-${idx}`,
        messageId: 'streaming',
        language: block.language,
        fileName,
        code: block.code,
      });
    });
  }, [extractedBlocks, addCodeBlock]);

  const handleCodeBadgeClick = useCallback((fileName: string) => {
    // Find the latest version of the file (highest version number)
    const sameNameBlocks = codeBlocks.filter((b) => b.fileName === fileName);
    const latestBlock = sameNameBlocks.length > 0
      ? sameNameBlocks.reduce((a, b) => (a.version || 1) > (b.version || 1) ? a : b)
      : null;
    if (latestBlock) { setSelectedCodeBlock(latestBlock); setCodeSidebarOpen(true); }
  }, [codeBlocks, setSelectedCodeBlock, setCodeSidebarOpen]);

  // Determine if we should show the blinking cursor outside code containers
  const showBlinkingCursor = isStreaming && !isThinkingStreaming && !incompleteBlock;

  return (
    <div className="flex items-start gap-2.5 px-4 py-1">
      <Avatar className="h-7 w-7 shrink-0 border border-border/25 mt-0.5">
        <AvatarFallback className="bg-primary/8 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0">
        <div className="max-w-[90%] min-w-0 rounded-2xl rounded-tl-sm border border-border/20 bg-card text-card-foreground px-3.5 py-2.5 overflow-hidden">

          {/* Show thinking section if we have thinking content AND are past the thinking phase */}
          {thinkingContent && !isThinkingStreaming && (
            <ThinkingSection content={thinkingContent} />
          )}

          {hasTextContent && (
            <MarkdownContent content={displayContent} />
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

          {/* Blinking cursor — only when no incomplete code (code container has its own cursor) */}
          {showBlinkingCursor && (
            <span className="inline-block w-0.5 h-4 bg-primary/50 animate-pulse ml-0.5 align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main message list ────────────────────────────────────────
export function MessageList({ onEditConfirm, onRegenerate }: { onEditConfirm?: (messageId: string, newContent: string) => void; onRegenerate?: () => void }) {
  const { messages, isGenerating, isStreaming, isThinkingStreaming, isWebSearching, streamingContent, streamingThinkingContent } = useChatStore();
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages.length, isGenerating, streamingContent, streamingThinkingContent]);

  // Determine what to show while generating
  const showThinkingIndicator = isGenerating && isThinkingStreaming;
  const showStreamingBubble = isGenerating && isStreaming && streamingContent.length > 0;
  const showTypingIndicator = isGenerating && !isStreaming && !isThinkingStreaming;

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3">
      <div className="mx-auto max-w-3xl w-full px-4 space-y-1">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLatestUserMessage={msg.id === latestUserMessageId}
            isLatestAssistantMessage={msg.id === latestAssistantMessageId}
            onEditConfirm={handleEditConfirm}
            onRegenerate={handleRegenerate}
          />
        ))}

        {/* Web Search indicator — shown while backend is searching */}
        {isWebSearching && (
          <WebSearchIndicator />
        )}

        {/* Thinking indicator (when AI is thinking, before content arrives) */}
        {showThinkingIndicator && !showStreamingBubble && (
          <ThinkingIndicator content={streamingThinkingContent} />
        )}

        {/* Streaming content bubble */}
        {showStreamingBubble && (
          <StreamingBubble content={streamingContent} thinkingContent={streamingThinkingContent} />
        )}

        {/* Typing indicator (waiting for first response) */}
        {showTypingIndicator && !isWebSearching && <TypingIndicator />}
      </div>
    </div>
  );
}
