'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Ban, Lightbulb, LightbulbOff, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChatStore } from '@/lib/store';
import { toast } from '@/hooks/use-toast';

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  onStop: () => void;
  initialMessage?: string;
}

export function ChatInput({ onSend, onStop, initialMessage }: ChatInputProps) {
  const [message, setMessage] = useState(initialMessage || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    activeModel,
    credit,
    isGenerating,
    setThinkingEnabled,
    thinkingEnabled,
    webSearchEnabled,
    setWebSearchEnabled,
    models,
  } = useChatStore();

  const currentModel = models.find(m => m.id === activeModel);
  const isModelAvailable = currentModel ? currentModel.status === 'active' : false;
  const isThinkingModel = currentModel?.thinking;

  useEffect(() => {
    if (initialMessage) {
      setTimeout(() => {
        setMessage(initialMessage);
      }, 0);
    }
  }, [initialMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isGenerating) return;
    if (credit <= 0 && !currentModel?.free) {
      toast({
        title: 'Kredit Habis',
        description: 'Silakan top up kredit untuk melanjutkan percakapan.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await onSend(message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Send error:', error);
    }
  }, [message, onSend, currentModel, isGenerating, credit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Estimate cost for current input (simplified since estimateTokens was missing)
  const estimatedInputTokens = message.trim() ? message.trim().length * 1.5 + 100 : 0;
  const estimatedOutputTokens = Math.min(estimatedInputTokens * 2, 2000);
  const estimatedInputCost = currentModel ? (estimatedInputTokens / 1_000_000) * currentModel.inputPrice : 0;
  const estimatedOutputCost = currentModel ? (estimatedOutputTokens / 1_000_000) * currentModel.outputPrice : 0;
  const estimatedTotalCost = estimatedInputCost + estimatedOutputCost;

  const formatEstCost = (cost: number | undefined): string => {
    const safe = cost ?? 0;
    if (safe === 0) return '$0.00';
    if (safe >= 0.01) return `~$${safe.toFixed(4)}`;
    return `~$${safe.toFixed(6)}`;
  };

  // Determine input container border color based on model status
  const inputBorderClass = (() => {
    if (credit <= 0) return 'border-destructive/25 opacity-60';
    if (!isModelAvailable && currentModel) {
      if (currentModel.status === 'maintenance') return 'border-amber-500/40 focus-within:border-amber-500/60';
      if (currentModel.status === 'disabled') return 'border-red-500/40 focus-within:border-red-500/60';
    }
    return 'focus-within:border-primary/25';
  })();

  // Model status warning badge
  const modelStatusBadge = (() => {
    if (!currentModel || isModelAvailable) return null;
    if (currentModel.status === 'maintenance') {
      return (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Model &quot;{currentModel.name}&quot; sedang maintenance
            </span>
          </span>
        </div>
      );
    }
    if (currentModel.status === 'disabled') {
      return (
        <div className="flex items-center gap-1.5 mb-2 px-1">
          <span className="flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1">
            <Ban className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              Model &quot;{currentModel.name}&quot; telah dinonaktifkan
            </span>
          </span>
        </div>
      );
    }
    return null;
  })();

  return (
    <div className="shrink-0 border-t bg-background px-3 pb-3 pt-2">
      <div className="mx-auto max-w-3xl">
        {/* Model status warning */}
        {modelStatusBadge}

        {/* Toggle bar: Thinking Mode + Web Search */}
        <div className="flex items-center gap-2 mb-2 px-1">
          {/* Thinking Mode toggle - only for thinking models */}
          {isThinkingModel && isModelAvailable && (
            <button
              onClick={() => setThinkingEnabled(!thinkingEnabled)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all ${
                thinkingEnabled
                  ? 'bg-amber-500/[0.06] border-amber-500/15 hover:bg-amber-500/[0.08]'
                  : 'bg-muted/20 border-border/15 hover:bg-muted/40'
              }`}
            >
              {thinkingEnabled ? (
                <Lightbulb className="h-3.5 w-3.5 text-amber-500/70" />
              ) : (
                <LightbulbOff className="h-3.5 w-3.5 text-muted-foreground/50" />
              )}
              <span className={`text-xs font-medium transition-colors ${
                thinkingEnabled
                  ? 'text-amber-600/80 dark:text-amber-400/70'
                  : 'text-muted-foreground/60'
              }`}>
                Thinking Mode
              </span>
            </button>
          )}

          {/* Web Search toggle - always visible */}
          <button
            onClick={() => setWebSearchEnabled(!webSearchEnabled)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 transition-all ${
              webSearchEnabled
                ? 'bg-sky-500/[0.08] border-sky-500/20 hover:bg-sky-500/[0.12]'
                : 'bg-muted/20 border-border/15 hover:bg-muted/40'
            }`}
          >
            <Globe className={`h-3.5 w-3.5 ${webSearchEnabled ? 'text-sky-500' : 'text-muted-foreground/50'}`} />
            <span className={`text-xs font-medium transition-colors ${
              webSearchEnabled
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-muted-foreground/60'
            }`}>
              Web Search
            </span>
          </button>
        </div>

        <div className={`relative flex items-end gap-2 rounded-2xl border bg-muted/30 p-2 transition-all ${inputBorderClass}`}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan sesuatu..."
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: '200px' }}
          />
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onStop}
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
              >
                <Ban className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSend}
                disabled={!message.trim() || (credit <= 0 && !currentModel?.free)}
                className="h-8 w-8 p-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="m5 12 7-7 7 7" />
                  <path d="M12 19V5" />
                </svg>
              </Button>
            )}
          </div>
        </div>
        
        <div className="mt-2 flex items-center justify-between px-1">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            {currentModel && (
              <span className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {currentModel.name}
              </span>
            )}
            <span>Est. Cost: {formatEstCost(estimatedTotalCost)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
