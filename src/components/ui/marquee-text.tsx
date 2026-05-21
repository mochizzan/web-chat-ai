'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * MarqueeText — shows ellipsis (...) when text overflows.
 * On hover, the ellipsis disappears and text scrolls (marquee) to reveal full content.
 */
export function MarqueeText({
  text,
  className = '',
  speed = 30, // pixels per second
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [overflowPx, setOverflowPx] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const checkOverflow = useCallback(() => {
    if (innerRef.current && contentRef.current) {
      const containerWidth = innerRef.current.clientWidth;
      const textWidth = contentRef.current.scrollWidth;
      const overflow = textWidth - containerWidth;
      setIsOverflowing(overflow > 2);
      setOverflowPx(overflow > 0 ? overflow : 0);
    }
  }, []);

  useEffect(() => {
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    if (innerRef.current) {
      observer.observe(innerRef.current);
    }
    return () => observer.disconnect();
  }, [checkOverflow, text]);

  const animDuration = overflowPx > 0 ? Math.max(overflowPx / speed, 0.5) : 0.5;

  return (
    <div
      ref={innerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Measuring span - always full width, invisible but used for scrollWidth measurement */}
      <span
        ref={contentRef}
        className="inline-block whitespace-nowrap invisible absolute"
        aria-hidden="true"
      >
        {text}
      </span>

      {/* Visible text */}
      <span
        className="whitespace-nowrap block"
        style={
          isHovered && isOverflowing
            ? {
                display: 'inline-block',
                animation: `marquee-scroll-${overflowPx} ${animDuration}s linear infinite alternate`,
              }
            : isOverflowing
              ? {
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }
              : undefined
        }
      >
        {text}
      </span>

      {/* Scoped keyframes */}
      {isOverflowing && (
        <style>{`
          @keyframes marquee-scroll-${overflowPx} {
            0% { transform: translateX(0); }
            100% { transform: translateX(-${overflowPx}px); }
          }
        `}</style>
      )}
    </div>
  );
}
