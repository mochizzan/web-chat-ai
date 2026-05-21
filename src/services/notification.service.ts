import { WSEvent } from '@/lib/ws-events';

export const NotificationService = {
  /**
   * Broadcasts an event to the WebSocket server.
   * The WS server is expected to be running on the port defined in WS_PORT.
   */
  async broadcast(event: WSEvent): Promise<void> {
    const wsPort = process.env.WS_PORT || '8080';
    const wsKey = process.env.WS_KEY || '';
    const wsBaseUrl = process.env.WS_BROADCAST_URL || `http://localhost:${wsPort}`;
    const url = `${wsBaseUrl}/broadcast`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': wsKey,
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WS Broadcast failed with status ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('[NotificationService] Broadcast Error:', error);
      // We don't throw here to avoid breaking the main business flow 
      // just because a notification failed, but we log it.
    }
  },
};
