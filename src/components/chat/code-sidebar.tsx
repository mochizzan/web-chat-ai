'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import gsap from 'gsap';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneDark from 'react-syntax-highlighter/dist/esm/styles/prism/one-dark';
import {
  X,
  FileCode2,
  Copy,
  Check,
  ChevronRight,
  Code2,
  FolderOpen,
  ArrowLeft,
  Download,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore, type CodeBlock } from '@/lib/store';

// ─── Language metadata ────────────────────────────────────────────────
const LANG_META: Record<string, { label: string; color: string; dot: string }> = {
  javascript: { label: 'JavaScript', color: 'text-yellow-600/70', dot: 'bg-yellow-500/40' },
  js:         { label: 'JavaScript', color: 'text-yellow-600/70', dot: 'bg-yellow-500/40' },
  typescript: { label: 'TypeScript', color: 'text-sky-600/70', dot: 'bg-sky-500/40' },
  ts:         { label: 'TypeScript', color: 'text-sky-600/70', dot: 'bg-sky-500/40' },
  python:     { label: 'Python', color: 'text-primary/70', dot: 'bg-primary/60' },
  py:         { label: 'Python', color: 'text-primary/70', dot: 'bg-primary/60' },
  jsx:        { label: 'React JSX', color: 'text-teal-600/70', dot: 'bg-teal-500/40' },
  tsx:        { label: 'React TSX', color: 'text-teal-600/70', dot: 'bg-teal-500/40' },
  html:       { label: 'HTML', color: 'text-orange-600/70', dot: 'bg-orange-500/40' },
  css:        { label: 'CSS', color: 'text-violet-600/70', dot: 'bg-violet-500/40' },
  json:       { label: 'JSON', color: 'text-stone-500/70', dot: 'bg-stone-500/40' },
  bash:       { label: 'Shell', color: 'text-stone-500/70', dot: 'bg-stone-500/40' },
  shell:      { label: 'Shell', color: 'text-stone-500/70', dot: 'bg-stone-500/40' },
  sql:        { label: 'SQL', color: 'text-stone-500/70', dot: 'bg-stone-500/40' },
  java:       { label: 'Java', color: 'text-red-600/70', dot: 'bg-red-500/40' },
  cpp:        { label: 'C++', color: 'text-sky-600/70', dot: 'bg-sky-500/40' },
  c:          { label: 'C', color: 'text-sky-600/70', dot: 'bg-sky-500/40' },
  go:         { label: 'Go', color: 'text-teal-600/70', dot: 'bg-teal-500/40' },
  rust:       { label: 'Rust', color: 'text-orange-600/70', dot: 'bg-orange-500/40' },
  php:        { label: 'PHP', color: 'text-violet-600/70', dot: 'bg-violet-500/40' },
  ruby:       { label: 'Ruby', color: 'text-red-600/70', dot: 'bg-red-500/40' },
  swift:      { label: 'Swift', color: 'text-orange-600/70', dot: 'bg-orange-500/40' },
  kotlin:     { label: 'Kotlin', color: 'text-violet-600/70', dot: 'bg-violet-500/40' },
  dart:       { label: 'Dart', color: 'text-teal-600/70', dot: 'bg-teal-500/40' },
  yaml:       { label: 'YAML', color: 'text-stone-500/70', dot: 'bg-stone-500/40' },
  yml:        { label: 'YAML', color: 'text-stone-500/70', dot: 'bg-stone-500/40' },
  xml:        { label: 'XML', color: 'text-orange-600/70', dot: 'bg-orange-500/40' },
};

function getMeta(lang: string) {
  return LANG_META[lang.toLowerCase()] || { label: lang, color: 'text-primary', dot: 'bg-primary' };
}

// ─── Relative time formatting ───────────────────────────────────────
function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  if (diffMin < 60) return `${diffMin} menit lalu`;
  if (diffHour < 24) return `${diffHour} jam lalu`;
  if (diffDay < 7) return `${diffDay} hari lalu`;

  // Fallback to date format
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

// ─── File card in list view ───────────────────────────────────────────
function FileCard({
  block,
  index,
  isSelected,
  onClick,
  isRecentlyUpdated,
  isLatestVersion,
  hasMultipleVersions,
  isOpened,
}: {
  block: CodeBlock;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  isRecentlyUpdated: boolean;
  isLatestVersion: boolean;
  hasMultipleVersions: boolean;
  isOpened: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const meta = getMeta(block.language);
  const lineCount = block.code.split('\n').length;

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(cardRef.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', delay: index * 0.04 });
    }
  }, [index]);

  // Pulse animation for recently updated files
  useEffect(() => {
    if (isRecentlyUpdated && badgeRef.current) {
      gsap.fromTo(
        badgeRef.current,
        { scale: 0.8, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' }
      );
    }
  }, [isRecentlyUpdated]);

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'bg-primary/8 border border-primary/20'
          : isRecentlyUpdated
            ? 'bg-primary/4 border border-primary/15 hover:bg-primary/8'
            : 'hover:bg-accent/50 border border-transparent hover:border-border/50'
      } ${!isLatestVersion && hasMultipleVersions ? 'opacity-60 hover:opacity-100' : ''}`}
    >
      {/* Unopened indicator dot */}
      {!isOpened && (
        <span className="absolute left-1 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" />
      )}

      {/* File icon with language dot */}
      <div className="relative shrink-0">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          isRecentlyUpdated ? 'bg-primary/6 dark:bg-primary/5' : isOpened ? 'bg-muted/50 dark:bg-muted/25' : 'bg-primary/4 dark:bg-primary/3'
        }`}>
          <FileCode2 className={`h-4.5 w-4.5 ${isOpened ? meta.color : 'text-primary/60'}`} />
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${meta.dot}`} />
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={`text-[13px] font-semibold truncate group-hover:text-primary transition-colors ${isOpened ? 'text-foreground' : 'text-foreground/80'}`}>
            {block.fileName}
          </p>
          {/* Version badge — always show when there are multiple versions */}
          {hasMultipleVersions && (
            <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-amber-500/8 text-amber-600/70 dark:text-amber-400/60 px-1.5 py-0 text-[9px] font-bold leading-[18px] border border-amber-500/10">
              v{block.version}
            </span>
          )}
          {/* "Baru" badge only on the latest version */}
          {isRecentlyUpdated && isLatestVersion && (
            <span
              ref={badgeRef}
              className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-primary/8 text-primary/80 px-1.5 py-0 text-[9px] font-bold leading-[18px] border border-primary/10"
            >
              <Sparkles className="h-2.5 w-2.5" />
              Baru
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[11px] font-medium ${meta.color}`}>
            {meta.label}
          </span>
          <span className="text-[10px] text-muted-foreground/50">·</span>
          <span className="text-[10px] text-muted-foreground">
            {lineCount} baris
          </span>
          {/* Updated time */}
          {block.updatedAt && (
            <>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {formatRelativeTime(block.updatedAt)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 transition-colors shrink-0" />
    </div>
  );
}

// ─── Code detail view ─────────────────────────────────────────────────
function CodeDetailView({
  block,
  onBack,
  hasMultipleVersions,
}: {
  block: CodeBlock;
  onBack: () => void;
  hasMultipleVersions: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const meta = getMeta(block.language);
  const lineCount = block.code.split('\n').length;

  useEffect(() => {
    if (detailRef.current) {
      gsap.fromTo(detailRef.current, { opacity: 0, x: 12 }, { opacity: 1, x: 0, duration: 0.25, ease: 'power2.out' });
    }
  }, [block.id]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(block.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [block.code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([block.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = block.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, [block.code, block.fileName]);

  return (
    <div ref={detailRef} className="flex flex-col h-full min-h-0">
      {/* Back button + file header */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors mb-3 group"
        >
          <ArrowLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
          Daftar file
        </button>

        {/* File info card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
          <div className="relative shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 dark:bg-muted/30">
              <FileCode2 className={`h-5 w-5 ${meta.color}`} />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${meta.dot}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground truncate">{block.fileName}</p>
              {hasMultipleVersions && (
                <span className="shrink-0 inline-flex items-center gap-0.5 rounded-md bg-amber-500/8 text-amber-600/70 dark:text-amber-400/60 px-1.5 py-0 text-[10px] font-bold leading-[18px] border border-amber-500/10">
                  v{block.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <span className="text-[10px] text-muted-foreground">{lineCount} baris kode</span>
            </div>
          </div>
        </div>

        {/* Version history info */}
        {hasMultipleVersions && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-2 rounded-lg bg-amber-500/[0.03] dark:bg-amber-500/[0.06] border border-amber-500/8">
            <Layers className="h-3.5 w-3.5 text-amber-600/60 dark:text-amber-400/50 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-amber-700/70 dark:text-amber-300/60">
              </p>
              <p className="text-[10px] text-amber-600/50 dark:text-amber-400/40">
              </p>
            </div>
            <span className="text-[10px] font-bold text-amber-600/40 dark:text-amber-400/30 shrink-0">
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px] flex-1 rounded-lg"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Tersalin!' : 'Salin Kode'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-[11px] flex-1 rounded-lg"
            onClick={handleDownload}
          >
            <Download className="h-3 w-3" />
            Unduh
          </Button>
        </div>
      </div>

      {/* Code block with line numbers */}
      <div className="flex-1 mx-3 mb-3 rounded-xl overflow-hidden border border-zinc-800 dark:border-zinc-700/50 min-h-0">
        {/* Editor tab bar */}
        <div className="flex items-center justify-between bg-zinc-900 dark:bg-zinc-900 px-3 py-1.5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dot}`} />
            <span className="text-[11px] font-medium text-zinc-400 truncate">{block.fileName}</span>
            {hasMultipleVersions && (
              <span className="shrink-0 text-[9px] font-bold text-amber-600/60 dark:text-amber-400/50 bg-amber-500/8 px-1.5 py-0 rounded">
                v{block.version}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-zinc-600">{meta.label}</span>
          </div>
        </div>

        {/* Code with line numbers - horizontal scroll enabled */}
        <div className="overflow-auto custom-scrollbar bg-zinc-900 dark:bg-zinc-900" style={{ maxHeight: 'calc(100% - 30px)' }}>
          <div className="flex min-w-fit">
            {/* Line numbers */}
            <div className="flex flex-col items-end px-2.5 py-3 select-none border-r border-zinc-800/50 shrink-0 sticky left-0 bg-zinc-900 dark:bg-zinc-900 z-10">
              {block.code.split('\n').map((_, i) => (
                <span key={i} className="text-[11px] leading-[1.65] text-zinc-600 font-mono">
                  {i + 1}
                </span>
              ))}
            </div>
            {/* Code content - full width for horizontal scroll */}
            <div className="py-3 pr-4">
              <SyntaxHighlighter
                style={oneDark}
                language={block.language}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: 'transparent',
                  fontSize: '0.75rem',
                  lineHeight: '1.65',
                  whiteSpace: 'pre',
                  overflow: 'visible',
                }}
                codeTagProps={{
                  style: { fontFamily: 'var(--font-geist-mono)' },
                }}
              >
                {block.code}
              </SyntaxHighlighter>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main sidebar component ───────────────────────────────────────────
export function CodeSidebar() {
  const { codeSidebarOpen, codeBlocks, selectedCodeBlock, setCodeSidebarOpen, setSelectedCodeBlock, markCodeBlockOpened } = useChatStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // Always use the latest version from codeBlocks (selectedCodeBlock can be stale)
  const activeBlock: CodeBlock | null = useMemo(() => {
    if (!selectedCodeBlock) return null;
    return codeBlocks.find((b) => b.id === selectedCodeBlock.id) || selectedCodeBlock;
  }, [selectedCodeBlock, codeBlocks]);

  const versionCounts = useMemo(() => {
    // Compute version counts per fileName
    const counts: Record<string, number> = {};
    codeBlocks.forEach((b) => {
      counts[b.fileName] = (counts[b.fileName] || 0) + 1;
    });
    return counts;
  }, [codeBlocks]);

  // Determine the latest version ID per fileName (highest version number)
  const latestVersionIds = useMemo(() => {
    const latest: Record<string, CodeBlock> = {};
    codeBlocks.forEach((b) => {
      if (!latest[b.fileName] || (b.version || 1) > (latest[b.fileName].version || 1)) {
        latest[b.fileName] = b;
      }
    });
    return new Set(Object.values(latest).map((b) => b.id));
  }, [codeBlocks]);

  // Determine recently updated files (updated within last 60 seconds)
  const recentlyUpdatedIds = useMemo(() => {
    const now = new Date().getTime();
    return new Set(
      codeBlocks
        .filter((b) => {
          if (!b.updatedAt) return false;
          return now - new Date(b.updatedAt).getTime() < 60_000;
        })
        .map((b) => b.id)
    );
  }, [codeBlocks]);

  // Grouped code blocks for rendering (mapped as array for direct JSX iteration)
  const groupedEntries: { groupName: string; blocks: CodeBlock[] }[] = useMemo(() => {
    const sorted = [...codeBlocks].sort((a, b) => {
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    const groups: Record<string, CodeBlock[]> = {};
    sorted.forEach((block) => {
      const key = getMeta(block.language).label;
      if (!groups[key]) groups[key] = [];
      groups[key].push(block);
    });

    const result: { groupName: string; blocks: CodeBlock[] }[] = [];
    for (const key in groups) {
      if (Object.prototype.hasOwnProperty.call(groups, key)) {
        result.push({ groupName: key, blocks: groups[key] });
      }
    }
    return result;
  }, [codeBlocks]);

  // Count unique file names
  const uniqueFileCount = useMemo(() => {
    return new Set(codeBlocks.map((b) => b.fileName)).size;
  }, [codeBlocks]);

  // Count unopened files
  const unopenedCount = useMemo(() => {
    return codeBlocks.filter((b) => !b.opened).length;
  }, [codeBlocks]);

  // Animation handled purely via CSS transition (no GSAP conflicts)
  // The transition-all on the outer div handles width + opacity smoothly

  // Determine if active block has multiple versions
  const hasMultipleVersions = activeBlock ? (versionCounts[activeBlock.fileName] || 1) > 1 : false;

  // Handler for clicking a file card — mark as opened and select it
  const handleFileClick = useCallback((block: CodeBlock) => {
    if (!block.opened) {
      markCodeBlockOpened(block.id);
    }
    setSelectedCodeBlock(block);
  }, [markCodeBlockOpened, setSelectedCodeBlock]);

  // Helper to render a list of CodeBlocks as FileCards (extracted to avoid TS 5.9 inferrence bug in nested JSX callbacks)
  function renderCodeBlockList(blocks: CodeBlock[], idxOffset: number) {
    return blocks.map((block, idx) => {
      const isLatestVersion = latestVersionIds.has(block.id);
      return (
        <FileCard
          key={block.id}
          block={block}
          index={idxOffset + idx}
          isSelected={activeBlock?.id === block.id}
          onClick={() => handleFileClick(block)}
          isRecentlyUpdated={recentlyUpdatedIds.has(block.id)}
          isLatestVersion={isLatestVersion}
          hasMultipleVersions={hasMultipleVersions}
          isOpened={!!block.opened}
        />
      );
    });
  }

  return (
    <>
      {/* Mobile overlay */}
      {codeSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 lg:hidden"
          onClick={() => setCodeSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel - always rendered, smooth CSS transition */}
      <div
        ref={sidebarRef}
        className={`flex h-full flex-col bg-background border-l border-border/30 transition-all duration-300 ease-in-out overflow-hidden ${codeSidebarOpen ? 'w-[420px] opacity-100' : 'w-0 opacity-0'} fixed right-0 top-0 z-50 lg:relative lg:z-0 lg:shadow-none`}
      >
        {/* Header */}
        <div ref={headerRef} className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/6">
              <Code2 className="h-4 w-4 text-primary/70" />
            </div>
            <div>
              <h2 className="text-[13px] font-bold text-foreground">Code Panel</h2>
              <p className="text-[10px] text-muted-foreground font-medium">
                {codeBlocks.length} file · {uniqueFileCount} nama{unopenedCount > 0 ? ` · ${unopenedCount} belum dibuka` : ''}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setCodeSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeBlock ? (
            <CodeDetailView
              block={activeBlock}
              onBack={() => setSelectedCodeBlock(null)}
              hasMultipleVersions={hasMultipleVersions}
            />
          ) : (
            <ScrollArea className="h-full">
              <div className="p-3">
                {codeBlocks.length === 0 ? (
                  /* Empty state */
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40 border border-border/30">
                      <FolderOpen className="h-7 w-7 text-muted-foreground/25" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">
                      Belum ada kode
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/50 max-w-[200px]">
                      Kode dari AI akan otomatis muncul di sini sebagai file
                    </p>
                  </div>
                ) : (
                  /* Grouped file list (sorted by newest first) */
                  <div className="space-y-4">
                    {groupedEntries.map((entry) => {
                      const groupName = entry.groupName;
                      const blocksForGroup = entry.blocks;
                      return (
                                              <div key={groupName}>
                          {/* Group header */}
                          <div className="flex items-center gap-2 px-1 mb-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${getMeta(blocksForGroup[0].language).dot}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                              {groupName}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">
                              ({blocksForGroup.length})
                            </span>
                          </div>
                          {/* File cards */}
                          <div className="space-y-0.5">
                            {renderCodeBlockList(blocksForGroup, 0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </>
  );
}
