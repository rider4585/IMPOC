import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// The suite runs many jsdom workers in parallel; a 1 s waitFor budget is too
// tight under that load for screens with real timers (POS thank-you delay,
// blob + window.open in the label-layout preview). Raise it suite-wide.
configure({ asyncUtilTimeout: 5000 });

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
