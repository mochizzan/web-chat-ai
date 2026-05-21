'use client';

import { useSyncExternalStore } from 'react';

/**
 * Returns true only on the client, false during SSR.
 * Uses useSyncExternalStore for hydration-safe client detection.
 * Use this to prevent hydration mismatches by not rendering
 * client-specific content (dates, theme, dynamic values) during SSR.
 */

const emptySubscribe = () => () => {};

export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,   // client snapshot
    () => false   // server snapshot
  );
}
