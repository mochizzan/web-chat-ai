import { NotificationService } from '../notification.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('broadcast', () => {
    it('should send event to WebSocket broadcast endpoint', async () => {
      const event = {
        type: 'credit:update',
        userId: 'user-123',
        newBalance: 150,
      };
      const mockResponse = { ok: true };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await NotificationService.broadcast(event);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/broadcast',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ws-key': '',
          },
          body: JSON.stringify(event),
        }
      );
    });

    it('should use custom WS_BROADCAST_URL if provided', async () => {
      process.env.WS_BROADCAST_URL = 'http://custom-host:9000';
      const event = { type: 'test' };
      const mockResponse = { ok: true };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await NotificationService.broadcast(event);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://custom-host:9000/broadcast',
        expect.any(Object)
      );

      delete process.env.WS_BROADCAST_URL;
    });

    it('should use WS_PORT and WS_KEY from environment', async () => {
      process.env.WS_PORT = '9000';
      process.env.WS_KEY = 'secret-key';
      const event = { type: 'test' };
      const mockResponse = { ok: true };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await NotificationService.broadcast(event);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:9000/broadcast',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ws-key': 'secret-key',
          },
          body: JSON.stringify(event),
        }
      );

      delete process.env.WS_PORT;
      delete process.env.WS_KEY;
    });

    it('should handle non-ok response without throwing', async () => {
      const event = { type: 'test' };
      const mockResponse = {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      // Should not throw - errors are caught and logged
      await expect(NotificationService.broadcast(event)).resolves.not.toThrow();
    });

    it('should handle network errors gracefully without throwing', async () => {
      const event = { type: 'test' };
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Should not throw - errors are caught and logged
      await expect(NotificationService.broadcast(event)).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        '[NotificationService] Broadcast Error:',
        expect.any(Error)
      );
    });

    it('should handle fetch throwing immediately', async () => {
      const event = { type: 'test' };
      (global.fetch as jest.Mock).mockImplementation(() => {
        throw new Error('Fetch not available');
      });

      await expect(NotificationService.broadcast(event)).resolves.not.toThrow();
    });
  });
});
