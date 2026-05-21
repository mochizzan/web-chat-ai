'use client';

import { useEffect, useRef } from 'react';
import { Brain } from 'lucide-react';

export function StreamingIndicator() {
  const brainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!brainRef.current) return;
    const tween = brainRef.current.animate(
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: 'scale(1.05)', opacity: 0.8 },
        { transform: 'scale(1)', opacity: 1 }
      ],
      {
        duration: 1500,
        iterations: Infinity,
        easing: 'ease-in-out'
      }
    );
    
    return () => tween.cancel();
  }, []);

  return (
    <div className="flex items-start gap-2.5 px-4 py-2">
      <div className="flex h-7 w-7 items-center justify-center">
        <div ref={brainRef} className="flex h-3.5 w-3.5 items-center justify-center">
          <Brain className="h-3 w-3 text-primary" />
        </div>
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-primary">
          Sedang berpikir...
        </span>
      </div>
    </div>
  );
}