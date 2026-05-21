'use client';

import { useWebSocketContext } from '@/context/websocket-context';

export function useWebSocket() {
  const context = useWebSocketContext();
  
  // Return an object that mimics the previous wsRef behavior for backward compatibility
  // although the actual WebSocket instance is now managed by the Provider.
  return {
    isConnected: context.isConnected,
    sendEvent: context.sendEvent,
  };
}
