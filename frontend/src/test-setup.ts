import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver, which recharts' ResponsiveContainer
// relies on. Provide a no-op mock so chart components render in tests.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
