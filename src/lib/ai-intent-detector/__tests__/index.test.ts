// src/lib/ai-intent-detector/__tests__/index.test.ts
// Unit tests for IntentDetector fallback keyword matching

import { detectIntentWithAI } from '../index';

// Mock fetch untuk OmniRouter
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('IntentDetector - Fallback Keyword Matching', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('Fallback: Search Keywords (Indonesia)', () => {
    it('should detect "cari" keyword', async () => {
      // Simulasi OmniRouter error 502
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('tolong carikan berita terbaru', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.reasoning).toContain('cari');
    });

    it('should detect "berita" keyword', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('ada berita apa hari ini?', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(true);
      expect(result.reasoning).toContain('berita');
    });

    it('should detect "harga" keyword', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('berapa harga bitcoin sekarang?', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(true);
      expect(result.reasoning).toContain('harga');
    });

    it('should detect "siapa presiden" keyword', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('siapa presiden RI saat ini?', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(true);
      expect(result.reasoning).toContain('siapa presiden');
    });
  });

  describe('Fallback: No Search Keywords', () => {
    it('should NOT search for "halo"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('halo, apa kabar?', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(false);
      expect(result.reasoning).toContain('halo');
    });

    it('should NOT search for "buatkan kode"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('buatkan kode python untuk sorting', {
        webSearchEnabled: true,
        category: 'coding',
      });

      expect(result.shouldSearch).toBe(false);
      expect(result.reasoning).toContain('buatkan kode');
    });

    it('should NOT search for "terima kasih"', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('terima kasih banyak', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(false);
      expect(result.reasoning).toContain('terima kasih');
    });
  });

  describe('Fallback: Toggle OFF with Search Needed', () => {
    it('should recommend toggle when webSearchEnabled=false and search keyword found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('tolong carikan berita terbaru', {
        webSearchEnabled: false,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(true);
      expect(result.recommendToggle).toBe(true);
      expect(result.reasoning).toContain('cari');
    });
  });

  describe('Fallback: Default Behavior', () => {
    it('should default to no search for unknown messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve('Bad Gateway'),
      });

      const result = await detectIntentWithAI('xyz abc def', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(false);
      expect(result.confidence).toBe('low');
      expect(result.reasoning).toContain('tidak ada kata kunci');
    });
  });

  describe('Network Error Fallback', () => {
    it('should fallback to keyword matching on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await detectIntentWithAI('tolong carikan berita terbaru', {
        webSearchEnabled: true,
        category: 'chat',
      });

      expect(result.shouldSearch).toBe(true);
      expect(result.reasoning).toContain('Fallback');
    });
  });
});
