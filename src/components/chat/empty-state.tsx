'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useChatStore } from '@/lib/store';

interface EmptyStateProps {
  onQuickAction: (prompt: string, category: string) => void;
}

export function EmptyState({ onQuickAction }: EmptyStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Title: fade up
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
        );
      }

      // Subtitle: fade up
      if (subtitleRef.current) {
        gsap.fromTo(
          subtitleRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 }
        );
      }

      // Cards: staggered fade up
      const cards = cardsRef.current.filter(Boolean);
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            stagger: 0.06,
            ease: 'power3.out',
            delay: 0.2,
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const suggestions = [
    'Bantu saya menulis email profesional',
    'Jelaskan konsep machine learning dengan sederhana',
    'Buatkan rencana proyek untuk aplikasi web',
  ];

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
    >
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-8">
        {/* Welcome Text */}
        <h1
          ref={titleRef}
          className="text-xl sm:text-2xl font-bold text-foreground tracking-tight text-center"
        >
          Apa yang bisa saya bantu?
        </h1>
        <p
          ref={subtitleRef}
          className="mt-2 text-sm text-muted-foreground/70 max-w-sm text-center leading-relaxed"
        >
          Mulai percakapan atau pilih saran di bawah
        </p>

        {/* Suggestion chips - compact, no icons */}
        <div className="mt-6 w-full max-w-md space-y-1.5">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              ref={(el) => {
                cardsRef.current[idx] = el;
              }}
              onClick={() => onQuickAction(suggestion, useChatStore.getState().activeCategory)}
              className="group w-full rounded-lg border border-border/10 bg-card/20 px-4 py-2.5 text-left text-sm font-medium text-foreground/70 transition-all hover:border-primary/15 hover:bg-primary/[0.03] hover:text-foreground active:scale-[0.98]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
