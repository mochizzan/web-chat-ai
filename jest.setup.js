// Polyfill Response for environments that don't have it (jsdom < Node 18)
if (typeof Response === 'undefined') {
  global.Response = class MockResponse {
    constructor(body, init = {}) {
      this._body = body;
      this.status = init.status || 200;
      this.statusText = init.statusText || '';
      this._headers = init.headers || {};
      this.ok = this.status >= 200 && this.status < 300;
      this.headers = {
        get: (name) => this._headers[name] || null,
        has: (name) => name in this._headers,
      };
    }
    async json() {
      return JSON.parse(this._body);
    }
    async text() {
      return String(this._body);
    }
  };
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
});

// Mock IntersectionObserver for testing
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    return null;
  }
  unobserve() {
    return null;
  }
  disconnect() {
    return null;
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {
    return null;
  }
  unobserve() {
    return null;
  }
  disconnect() {
    return null;
  }
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock window.alert
global.alert = jest.fn();

// Mock window.confirm
global.confirm = jest.fn(() => true);

// Mock window.scrollTo
global.scrollTo = jest.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.cancelAnimationFrame = (id) => clearTimeout(id);

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }))
});

// Polyfill TextEncoder/TextDecoder for jsdom environment
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Polyfill ReadableStream for jsdom environments (Node < 18)
if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = class MockReadableStream {
    constructor(underlyingSource) {
      this._buffer = [];
      this._closed = false;
      this._startPromise = Promise.resolve();

      const controller = {
        enqueue: (chunk) => {
          if (!this._closed) {
            this._buffer.push(chunk);
          }
        },
        close: () => {
          this._closed = true;
        },
        error: () => {
          this._closed = true;
        },
      };

      if (underlyingSource?.start) {
        try {
          const result = underlyingSource.start(controller);
          if (result?.then) {
            this._startPromise = result.then(() => {
              if (!this._closed) this._closed = true;
            }).catch(() => {
              this._closed = true;
            });
          }
        } catch (e) {
          this._closed = true;
        }
      }
    }

    getReader() {
      const stream = this;
      return {
        read: jest.fn().mockImplementation(async () => {
          await stream._startPromise;
          if (stream._buffer.length > 0) {
            return { value: stream._buffer.shift(), done: false };
          }
          return { value: undefined, done: stream._closed };
        }),
        cancel: jest.fn(),
        releaseLock: jest.fn(),
      };
    }
  };
}
