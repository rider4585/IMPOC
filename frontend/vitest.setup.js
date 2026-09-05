import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom does not implement ResizeObserver — cmdk's CommandList observes its
// sizer to track the list height.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom does not implement Element.scrollIntoView — cmdk scrolls the active item.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn();
}
