'use client';

import { useEffect } from 'react';

const APP_NAME = 'MI-Labs Chat';

/**
 * Custom hook to dynamically set the browser tab title.
 * Format: `{pageTitle} | MI-Labs Chat`
 *
 * @param pageTitle - The title segment for the current page.
 *                    If omitted, falls back to just "MI-Labs Chat".
 *
 * @example
 *   usePageTitle('Chat')                // → "Chat | MI-Labs Chat"
 *   usePageTitle('Sign In')             // → "Sign In | MI-Labs Chat"
 *   usePageTitle('Admin Control Panel') // → "Admin Control Panel | MI-Labs Chat"
 */
export function usePageTitle(pageTitle?: string): void {
  useEffect(() => {
    document.title = pageTitle
      ? `${pageTitle} | ${APP_NAME}`
      : APP_NAME;
  }, [pageTitle]);
}
