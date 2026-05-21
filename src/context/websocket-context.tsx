'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore, type Model, type UserProfile } from '@/lib/store';
import { type WSEvent } from '@/lib/ws-events';

interface WebSocketContextType {
  isConnected: boolean;
  sendEvent: (type: string, payload?: Record<string, unknown>) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

// ─── Smart Default Model Selection ─────────────────────────────
function findBestDefaultModel(models: Model[]): string {
  // 1. Cek apakah activeModel saat ini masih valid
  //  (ini akan dicek oleh caller)

  // 2. Cari model gratis + active
  const freeActive = models.find((m) => m.free && m.status === 'active');
  if (freeActive) return freeActive.id;

  // 3. Cari model active termurah (inputPrice + outputPrice)
  const activeModels = models.filter((m) => m.status === 'active');
  if (activeModels.length > 0) {
    const cheapest = activeModels.sort(
      (a, b) => a.inputPrice + a.outputPrice - (b.inputPrice + b.outputPrice)
    )[0];
    return cheapest.id;
  }

  // 4. Tidak ada model active sama sekali
  return '';
}

function ensureValidActiveModel(models: Model[], currentActiveModel: string): string {
  // Jika model saat ini masih active, pertahankan
  const currentStillActive = models.find(
    (m) => m.id === currentActiveModel && m.status === 'active'
  );
  if (currentStillActive) return currentActiveModel;

  // Jika tidak, cari default terbaik
  return findBestDefaultModel(models);
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<(() => void) | null>(null);
  
  const store = useChatStore;
  const handleWSEventRef = useRef<((data: WSEvent) => void) | null>(null);

  // Fetch fresh models from API after DB changes detected
  const fetchFreshModels = useCallback(async () => {
    try {
      const adminPath = window.location.pathname.startsWith('/admin');
      const response = await fetch(adminPath ? '/api/models?all=true' : '/api/models');
      if (response.ok) {
        const data = await response.json();
        if (data.models) {
          const state = store.getState();
          state.setModels(data.models);

          // Smart default model selection if current model is no longer active
          const bestModel = ensureValidActiveModel(data.models, state.activeModel);
          if (bestModel !== state.activeModel) {
            state.setActiveModel(bestModel);
          }
          console.log('[WS-Global] Models refreshed after DB change');
        }
      }
    } catch (error) {
      console.error('[WS-Global] Failed to fetch fresh models:', error);
    }
  }, [store]);

  const sendEvent = useCallback((type: string, payload?: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn('[WS-Global] Cannot send event, WebSocket is not connected');
    }
  }, []);

  const handleWSEvent = useCallback((data: WSEvent) => {
    const state = store.getState();

    switch (data.type) {
      case 'response:initial_sync':
        if (data.models) {
          // Cast to Model[] as we trust the WS event structure for these fields
          const models = data.models as unknown as Model[];
          store.getState().setModels(models);

          // Smart default model selection
          const bestModel = ensureValidActiveModel(models, state.activeModel);
          if (bestModel !== state.activeModel) {
            store.getState().setActiveModel(bestModel);
          }
        }
        if (data.user && data.user.role !== 'guest') {
          // Cast to UserProfile as we only get partial data from WS
          store.getState().setUser(data.user as unknown as UserProfile);
          if (data.credit) store.getState().setCredit(data.credit);
        }
        break;
      case 'model:update': {
        store.getState().updateModel(data.model.id, data.model as unknown as Partial<Model>);

        // Jika model yang di-update adalah activeModel dan statusnya berubah
        const currentState = store.getState();
        if (data.model.id === currentState.activeModel && data.model.status !== 'active') {
          const bestModel = findBestDefaultModel(currentState.models);
          if (bestModel !== currentState.activeModel) {
            store.getState().setActiveModel(bestModel);
          }
        }
        break;
      }
      case 'model:delete': {
        store.getState().removeModel(data.modelId);

        // Jika model yang dihapus adalah activeModel
        const currentStateAfterDelete = store.getState();
        if (data.modelId === currentStateAfterDelete.activeModel) {
          const bestModel = findBestDefaultModel(currentStateAfterDelete.models);
          if (bestModel !== currentStateAfterDelete.activeModel) {
            store.getState().setActiveModel(bestModel);
          }
        }
        break;
      }
      case 'model:create':
        store.getState().addModel(data.model as unknown as Model);
        break;
      case 'credit:update':
        if (data.userId === state.user?.id) {
          store.getState().setCredit(data.newBalance);
        }
        break;
      case 'user:update':
        if (data.user.id === state.user?.id) {
          store.getState().setUser(data.user as unknown as UserProfile);
        }
        break;
      case 'models:changed': {
        // Ada perubahan data models di DB (INSERT/UPDATE/DELETE via HeidiSQL atau API lain).
        // Fetch ulang data models dari API untuk mendapatkan data terbaru.
        console.log('[WS-Global] Models changed in DB, refetching...');
        fetchFreshModels();
        break;
      }
      case 'ping':
        sendEvent('pong');
        break;
    }
  }, [store, fetchFreshModels, sendEvent]);

  // Keep the ref updated with the latest handler
  useEffect(() => {
    handleWSEventRef.current = handleWSEvent;
  }, [handleWSEvent]);

  // Create connect function that uses refs to avoid circular dependency
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3003';
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS-Global] Connected to', wsUrl);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        // Initial sync request upon connection with userId
        const userId = store.getState().user?.id;
        ws.send(JSON.stringify({
          type: 'request:initial_sync',
          userId: userId || null
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWSEventRef.current?.(data);
        } catch (err) {
          console.error('[WS-Global] Error parsing message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[WS-Global] Disconnected, reconnecting in ${delay / 1000}s...`);
        
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => connectRef.current?.(), delay);
      };

      ws.onerror = (error) => {
        console.error('[WS-Global] WebSocket error:', error);
        ws.close();
      };
    } catch (error) {
      console.error('[WS-Global] Connection failed:', error);
      // Trigger reconnect on failure
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = setTimeout(() => connectRef.current?.(), delay);
    }
  }, [store]);

  // Store connect in ref to avoid circular dependency
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ isConnected, sendEvent }}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}
