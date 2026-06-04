'use client';

import React, { useEffect, useRef, useMemo, useState, useCallback, type ReactNode } from 'react';
import gsap from 'gsap';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, FileCode2, FolderOpen, Pencil, Copy, Check, Brain, ChevronDown, Globe, X, Send, RefreshCw, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useChatStore, type Message } from '@/lib/store';
import { FAKE_STREAM_CONFIG } from '@/config/stream-config';

// Language badge colors — MD3 soft, muted tones
export const LANGUAGE_COLORS: Record<string, string> = {
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

export function getLanguageColor(lang: string): string {
  return LANGUAGE_COLORS[lang.toLowerCase()] || 'bg-primary/8 text-primary/80 border-primary/12';
}

export const LANGUAGE_LABELS: Record<string, string> = {
  js: 'JS', javascript: 'JS', ts: 'TS', typescript: 'TS',
  py: 'Python', python: 'Python', jsx: 'JSX', tsx: 'TSX',
  html: 'HTML', css: 'CSS', json: 'JSON', bash: 'Shell', shell: 'Shell',
  sql: 'SQL', java: 'Java', cpp: 'C++', c: 'C', go: 'Go', rust: 'Rust',
  php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin', dart: 'Dart',
  yaml: 'YAML', yml: 'YAML', xml: 'XML', markdown: 'MD', md: 'MD',
};

export function getLanguageLabel(lang: string): string {
  return LANGUAGE_LABELS[lang.toLowerCase()] || lang.charAt(0).toUpperCase() + lang.slice(1);
}

export function formatMessageTime(dateStr: string): string {
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
export const URL_REGEX = /(?<!\]\()(https?:\/\/[^\s\)\]<>"']+)/g;

export function linkifyText(text: string): string {
  return text.replace(URL_REGEX, (url) => `[${url}](${url})`);
}

export function LinkRenderer({ href, children }: { href?: string; children?: ReactNode }) {
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

function getExcelColumnLabel(index: number): string {
  let label = '';
  let temp = index;
  while (temp >= 0) {
    label = String.fromCharCode((temp % 26) + 65) + label;
    temp = Math.floor(temp / 26) - 1;
  }
  return label;
}

// ─── Table renderer — Excel-like professional styling ─────────────
function TableRenderer(props: React.ComponentProps<'table'>) {
  const { children, ...rest } = props;

  // 1. Get column count
  let colCount = 0;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const isThead = child.type === 'thead' || child.type === TableHead;
    if (isThead) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headRows = React.Children.toArray((child as any).props.children);
      headRows.forEach((row) => {
        if (!React.isValidElement(row)) return;
        const isTr = row.type === 'tr' || row.type === TableRow;
        if (isTr) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cells = React.Children.toArray((row as any).props.children);
          const currentCount = cells.length;
          if (currentCount > colCount) {
            colCount = currentCount;
          }
        }
      });
    }
  });

  if (colCount === 0) {
    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const isTbody = child.type === 'tbody' || child.type === TableBody;
      if (isTbody) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bodyRows = React.Children.toArray((child as any).props.children);
        bodyRows.forEach((row) => {
          if (!React.isValidElement(row)) return;
          const isTr = row.type === 'tr' || row.type === TableRow;
          if (isTr) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cells = React.Children.toArray((row as any).props.children);
            const currentCount = cells.length;
            if (currentCount > colCount) {
              colCount = currentCount;
            }
          }
        });
      }
    });
  }

  colCount = colCount || 1;
  let globalRowNumber = 1;

  // 2. Map and reconstruct children
  const newChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const isThead = child.type === 'thead' || child.type === TableHead;

    if (isThead) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headRows = React.Children.toArray((child as any).props.children);
      const newHeadRows: React.ReactElement[] = [];

      // A. Excel Column letters Row: "A", "B", "C"...
      const letterCells = [
        <th key="corner" className="excel-corner-header shrink-0 pointer-events-none sticky left-0 z-20"></th>
      ];
      for (let i = 0; i < colCount; i++) {
        letterCells.push(
          <th key={`letter-${i}`} className="excel-col-header text-center shrink-0 pointer-events-none font-mono">
            {getExcelColumnLabel(i)}
          </th>
        );
      }
      newHeadRows.push(
        <tr key="excel-letters" className="excel-header-letters-row pointer-events-none select-none">
          {letterCells}
        </tr>
      );

      // B. Standard Markdown Head Rows
      headRows.forEach((row, rowIdx) => {
        if (!React.isValidElement(row)) return;
        const isTr = row.type === 'tr' || row.type === TableRow;
        if (!isTr) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cells = React.Children.toArray((row as any).props.children);
        const newCells = [
          <th key={`head-row-num-${rowIdx}`} className="excel-row-header text-center shrink-0 pointer-events-none font-mono sticky left-0 z-10 select-none">
            {globalRowNumber++}
          </th>,
          ...cells
        ];
        newHeadRows.push(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          React.cloneElement(row, { key: `head-row-${rowIdx}` } as any, newCells)
        );
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return React.cloneElement(child, {} as any, newHeadRows);
    }

    const isTbody = child.type === 'tbody' || child.type === TableBody;
    if (isTbody) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bodyRows = React.Children.toArray((child as any).props.children);
      const newBodyRows = bodyRows.map((row, rowIdx) => {
        if (!React.isValidElement(row)) return row;
        const isTr = row.type === 'tr' || row.type === TableRow;
        if (!isTr) return row;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cells = React.Children.toArray((row as any).props.children);
        const newCells = [
          <td key={`body-row-num-${rowIdx}`} className="excel-row-header text-center shrink-0 pointer-events-none font-mono sticky left-0 z-10 select-none">
            {globalRowNumber++}
          </td>,
          ...cells
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return React.cloneElement(row, { key: `body-row-${rowIdx}` } as any, newCells);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return React.cloneElement(child, {} as any, newBodyRows);
    }

    return child;
  });

  return (
    <div className="markdown-table-wrapper relative w-full">
      <div className="markdown-table-container custom-scrollbar">
        <table {...rest}>{newChildren}</table>
      </div>
    </div>
  );
}

function TableHead(props: React.ComponentProps<'thead'>) {
  return <thead {...props} />;
}

function TableBody(props: React.ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

function TableRow(props: React.ComponentProps<'tr'>) {
  return <tr {...props} />;
}

function TableCell(props: React.ComponentProps<'td'> & { isHeader?: boolean }) {
  const { isHeader, ...rest } = props;
  return isHeader ? <th {...rest} /> : <td {...rest} />;
}

export function MarkdownContent({ content }: { content: string }) {
  const linkified = useMemo(() => linkifyText(content), [content]);
  return (
    <div className="markdown-content text-sm leading-relaxed break-words overflow-wrap-anywhere">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: LinkRenderer,
          table: TableRenderer,
          thead: TableHead,
          tbody: TableBody,
          tr: TableRow,
          th: (props) => <TableCell {...props} isHeader />,
          td: TableCell,
        }}
      >
        {linkified}
      </ReactMarkdown>
    </div>
  );
}



// ─── Code badge ───────────────────────────────────────────────
export function CodeBadge({ language, fileName, onClick }: { language: string; fileName: string; onClick: () => void }) {
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
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all hover:shadow-md hover:scale-[1.03] active:scale-[0.97] cursor-pointer max-w-full min-w-0 ${getLanguageColor(language)}`}
    >
      <FileCode2 className="h-3 w-3 shrink-0" />
      <span className="font-semibold truncate">{fileName}</span>
      <span className="opacity-50 shrink-0">·</span>
      <span className="opacity-60 shrink-0">{getLanguageLabel(language)}</span>
    </button>
  );
}

// ─── Streaming code container (shows incomplete code during streaming) ──
export const LANG_DOT: Record<string, string> = {
  javascript: 'bg-yellow-500/40', js: 'bg-yellow-500/40', typescript: 'bg-sky-500/40', ts: 'bg-sky-500/40',
  python: 'bg-primary/50', py: 'bg-primary/50', jsx: 'bg-teal-500/40', tsx: 'bg-teal-500/40',
  html: 'bg-orange-500/40', css: 'bg-violet-500/40', json: 'bg-stone-500/40',
  bash: 'bg-stone-500/40', shell: 'bg-stone-500/40', sql: 'bg-stone-500/40',
};

export function StreamingCodeContainer({ language, fileName, code }: { language: string; fileName: string; code: string }) {
  const codeRef = useRef<HTMLDivElement>(null);
  const dot = LANG_DOT[language.toLowerCase()] || 'bg-primary/50';

  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code]);

  const lineCount = code.split('\n').length;

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 dark:border-zinc-700/50">
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
      <div
        ref={codeRef}
        className="overflow-y-auto overflow-x-auto custom-scrollbar bg-zinc-900 max-h-52"
      >
        <div className="flex min-w-fit">
          <div className="flex flex-col items-end px-2.5 py-2.5 select-none border-r border-zinc-800/50 shrink-0 sticky left-0 bg-zinc-900 z-10">
            {code.split('\n').map((_, i) => (
              <span key={i} className="text-[10px] leading-[1.6] text-zinc-600 font-mono">
                {i + 1}
              </span>
            ))}
          </div>
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

export function extractCodeBlocks(content: string): { language: string; code: string; fileName?: string }[] {
  const blocks: { language: string; code: string; fileName?: string }[] = [];
  // Support ```lang, ```lang:filename, and bare ``` (no language tag) formats
  const regex = /```(\w+)?(?::([^\n]+))?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({ language: match[1] || 'text', code: match[3].trim(), fileName: match[2]?.trim() || undefined });
  }
  return blocks;
}

export function stripCodeBlocks(content: string): string {
  return content.replace(/```[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Incomplete code block detection (for streaming) ──────────
export interface IncompleteCodeBlock {
  language: string;
  fileName?: string;
  code: string;
}

export function extractIncompleteCodeBlock(content: string): IncompleteCodeBlock | null {
  const withoutComplete = content.replace(/```(\w+)?(?::([^\n]+))?\n[\s\S]*?```/g, '');
  const remainingMatch = withoutComplete.match(/```(\w+)?(?::([^\n]+))?\n([\s\S]*)$/);
  if (remainingMatch) {
    return {
      language: remainingMatch[1] || 'text',
      fileName: remainingMatch[2]?.trim() || undefined,
      code: remainingMatch[3] || '',
    };
  }
  return null;
}

export function stripIncompleteCodeBlock(content: string): string {
  let result = content.replace(/```(\w+)?(?::([^\n]+))?\n[\s\S]*?```/g, '');
  result = result.replace(/```(\w+)?(?::([^\n]+))?\n[\s\S]*$/, '');
  result = result.replace(/\n{3,}/g, '\n\n').trim();
  return result;
}

export function generateFileName(language: string, index: number, fileNameHint?: string): string {
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
export function CopyButton({ text, label = 'Salin pesan' }: { text: string; label?: string }) {
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
export function EditButton({ onClick }: { onClick: () => void }) {
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
export function RefreshButton({ onClick, isRegenerating }: { onClick: () => void; isRegenerating: boolean }) {
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

export function ThinkingSection({ content, initialExpanded = false, onComplete, disabled = false, onScroll }: { content: string; initialExpanded?: boolean; onComplete?: () => void; disabled?: boolean; onScroll?: () => void }) {
  const [expanded, setExpanded] = useState(initialExpanded);
  const [visibleLength, setVisibleLength] = useState(disabled ? content.length : 0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      setVisibleLength(content.length);
      return;
    }

    if (visibleLength < content.length) {
      const timer = setTimeout(() => {
        setVisibleLength((prev) => Math.min(prev + FAKE_STREAM_CONFIG.AVG_WORD_LENGTH, content.length));
      }, FAKE_STREAM_CONFIG.MS_PER_WORD);
      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [visibleLength, content.length, onComplete, disabled]);

  useEffect(() => {
    if (expanded && onScroll) {
      onScroll();
    }
  }, [visibleLength, expanded, onScroll]);

  useEffect(() => {
    if (expanded && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [visibleLength, expanded]);

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs text-amber-600/70 dark:text-amber-400/60 hover:text-amber-700/80 dark:hover:text-amber-300/70 transition-colors group w-full"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${expanded ? 'rotate-0' : '-rotate-90'}`} />
        <Brain className="h-3 w-3" />
        <span className="font-semibold">Proses Berpikir</span>
      </button>
      {expanded && (
        <div 
          ref={containerRef}
          className="mt-2 ml-1 pl-3 border-l-2 border-amber-500/15 max-h-[200px] overflow-y-auto custom-scrollbar"
        >
          <p className="text-[12px] leading-relaxed text-amber-700/50 dark:text-amber-300/40 whitespace-pre-wrap break-words">
            {content.slice(0, visibleLength)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Parse thinking from message content ──────────────────────
export function parseThinkingContent(content: string): { thinkingContent: string | null; mainContent: string } {
  const match = content.match(/<details>\s*\n<summary>💭 Proses Berpikir<\/summary>\s*\n\n([\s\S]*?)\n\n<\/details>\s*\n\n([\s\S]*)/);
  if (match) {
    return { thinkingContent: match[1].trim(), mainContent: match[2] };
  }
  return { thinkingContent: null, mainContent: content };
}

// ─── MessageBubble component - extracted from MessageList.tsx ─────
interface MessageBubbleProps {
  message: Message;
  isLatestUserMessage: boolean;
  isLatestAssistantMessage: boolean;
  onEditConfirm: (messageId: string, newContent: string) => void;
  onRegenerate: () => void;
}

export function MessageBubble({ 
  message, 
  isLatestUserMessage, 
  isLatestAssistantMessage, 
  onEditConfirm, 
  onRegenerate 
}: MessageBubbleProps) {
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
  }, [message.content, mainContent, isUser]);

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
    const ctx = gsap.context(() => {
      gsap.fromTo(msgRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
    }, msgRef);
    return () => ctx.revert();
  }, []);

  const hasTextContent = displayContent.length > 0;

  // ─── User message ───────────────────────────────────────
  if (isUser) {
    return (
      <div ref={msgRef} className="flex flex-col items-end px-4 sm:px-6 py-1">
        {!isEditing ? (
          <div className="w-fit max-w-[90%] sm:max-w-[85%] min-w-0 rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-3.5 py-2.5">
            <MarkdownContent content={displayContent} />
          </div>
        ) : (
          /* Inline edit modal overlay on bubble */
          <div className="w-[90%] sm:w-[85%] max-w-[700px]">
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
  // Defensive guard: jangan render bubble AI yang benar-benar kosong
  // (mencegah ghost bubble selama fase inisialisasi sebelum streaming)
  if (!isUser && !hasTextContent && !thinkingContent && extractedBlocks.length === 0) {
    return null;
  }

  return (
    <div ref={msgRef} className="flex items-start gap-2.5 px-4 sm:px-6 py-1">
      <Avatar className="h-7 w-7 shrink-0 border border-border/25 mt-0.5 bg-background overflow-hidden">
        <AvatarImage src="/logo.png" alt="AI Avatar" className="object-contain p-1" />
        <AvatarFallback className="bg-primary/8 text-primary">
          <Bot className="h-3.5 w-3.5" />
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="w-fit max-w-[95%] min-w-0 rounded-2xl rounded-tl-sm border border-border/20 bg-card text-card-foreground px-3.5 py-2.5 overflow-hidden">
          {/* Thinking section (collapsible) */}
          {thinkingContent && <ThinkingSection content={thinkingContent} disabled={true} />}

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