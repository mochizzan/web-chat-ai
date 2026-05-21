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
  })),
});

// Mock ReadableStream for testing streaming responses
if (typeof ReadableStream === 'undefined') {
  global.ReadableStream = class {
    constructor(underlyingSource) {
      this.underlyingSource = underlyingSource;
    }
    getReader() {
      const underlyingSource = this.underlyingSource;
      const chunks = [];
      let isClosed = false;
      
      const controller = {
        enqueue(chunk) {
          chunks.push(chunk);
        },
        close() {
          isClosed = true;
        },
        error(err) {
          throw err;
        }
      };

      if (underlyingSource && underlyingSource.start) {
        underlyingSource.start(controller);
      }

      return {
        read() {
          if (chunks.length > 0) {
            return Promise.resolve({ value: chunks.shift(), done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
        releaseLock() {}
      };
    }
  };
}

// Mock TextEncoder for testing
if (typeof TextEncoder === 'undefined') {
  class TextEncoder {
    encode(str) {
      return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
    }
  }
  global.TextEncoder = TextEncoder;
}

// Mock TextDecoder for testing
if (typeof TextDecoder === 'undefined') {
  class TextDecoder {
    decode(buffer) {
      return String.fromCharCode(...buffer);
    }
  }
  global.TextDecoder = TextDecoder;
}
