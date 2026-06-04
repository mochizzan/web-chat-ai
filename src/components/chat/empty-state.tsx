'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import Image from 'next/image';
import { Sparkles, FileText, Terminal } from 'lucide-react';
import { useChatStore } from '@/lib/store';

interface EmptyStateProps {
  onQuickAction: (prompt: string, category: string) => void;
}

export function EmptyState({ onQuickAction }: EmptyStateProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const cardsRef = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Logo: scale in & fade
      if (logoRef.current) {
        gsap.fromTo(
          logoRef.current,
          { opacity: 0, scale: 0.8 },
          { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' }
        );
      }

      // Title: fade up
      if (titleRef.current) {
        gsap.fromTo(
          titleRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.08 }
        );
      }

      // Subtitle: fade up
      if (subtitleRef.current) {
        gsap.fromTo(
          subtitleRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', delay: 0.15 }
        );
      }

      // Cards: staggered fade up
      const cards = cardsRef.current.filter(Boolean);
      if (cards.length > 0) {
        gsap.fromTo(
          cards,
          { opacity: 0, y: 12 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.06,
            ease: 'power3.out',
            delay: 0.22,
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const suggestions = [
    {
      text: 'Bantu saya menulis email profesional',
      icon: FileText,
      category: 'chat',
    },
    {
      text: 'Jelaskan konsep machine learning dengan sederhana',
      icon: Sparkles,
      category: 'chat',
    },
    {
      text: 'Buatkan rencana proyek untuk aplikasi web',
      icon: Terminal,
      category: 'chat',
    },
  ];

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full overflow-y-auto overflow-x-hidden custom-scrollbar"
    >
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 max-w-2xl mx-auto">
        {/* Modern bot icon */}
        <div
          ref={logoRef}
          className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 text-primary border border-primary/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(var(--primary),0.06)] backdrop-blur-sm"
        >
          <Image src="/logo.png" alt="MI-Labs Logo" width={28} height={28} className="object-contain" />
        </div>

        {/* Welcome Text */}
        <h1
          ref={titleRef}
          className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight text-center bg-clip-text"
        >
          Apa yang bisa saya bantu?
        </h1>
        <p
          ref={subtitleRef}
          className="mt-3 text-sm sm:text-base text-muted-foreground/80 max-w-sm text-center leading-relaxed font-medium"
        >
          Mulai percakapan atau pilih saran spesifik di bawah ini
        </p>

        {/* Suggestion chips grid */}
        <div className="mt-10 w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
          {suggestions.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                ref={(el) => {
                  cardsRef.current[idx] = el;
                }}
                onClick={() => onQuickAction(item.text, item.category)}
                className="group flex flex-col items-start p-4 rounded-xl border border-border/40 bg-card hover:border-primary/20 hover:bg-primary/[0.015] hover:shadow-[0_8px_30px_rgba(0,0,0,0.015)] active:scale-[0.98] transition-all text-left"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors mb-3">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-xs font-semibold text-foreground/80 group-hover:text-foreground transition-colors leading-relaxed line-clamp-2">
                  {item.text}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
