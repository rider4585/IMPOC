import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Zoom on the scanner: default 2x, applied only when the camera reports a
 * zoom capability, clamped to its range; a `zoom` prop overrides the default.
 */
const applyConstraints = vi.fn(async () => {});
const makeTrack = (capabilities) => ({
  getCapabilities: () => capabilities,
  getSettings: () => ({}),
  applyConstraints,
  stop: vi.fn(),
  readyState: 'live',
});
const makeStream = (track) => ({ getVideoTracks: () => [track], getTracks: () => [track] });

vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class { decodeFromVideoElement() {} reset() {} },
  HTMLCanvasElementLuminanceSource: class {},
}));
vi.mock('@zxing/library', () => {
  class BrowserMultiFormatReader { decodeFromVideoElement() {} reset() {} }
  return { BrowserMultiFormatReader, MultiFormatReader: class { setHints() {} decode() { throw new Error('none'); } }, BarcodeFormat: { CODE_128: 1 }, DecodeHintType: { POSSIBLE_FORMATS: 2 }, HTMLCanvasElementLuminanceSource: class {}, HybridBinarizer: class {}, BinaryBitmap: class {}, NotFoundException: class extends Error {} };
});

import BarcodeScanner from '../BarcodeScanner.jsx';

describe('BarcodeScanner zoom', () => {
  beforeEach(() => {
    applyConstraints.mockClear();
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLMediaElement.prototype.pause = vi.fn();
    delete window.BarcodeDetector; // force the getUserMedia path
  });

  const withCamera = (capabilities) => {
    const track = makeTrack(capabilities);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(async () => makeStream(track)) },
      configurable: true,
    });
    return track;
  };

  it('applies 2x by default when the camera supports zoom', async () => {
    withCamera({ zoom: { min: 1, max: 8, step: 0.1 } });
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] }));
    await waitFor(() => expect(screen.getByText('2×')).toBeInTheDocument());
  });

  it('clamps the requested zoom to the camera range and honours the zoom prop', async () => {
    withCamera({ zoom: { min: 1, max: 3, step: 0.5 } });
    render(<BarcodeScanner onDetected={() => {}} zoom={5} />);
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] }));
  });

  it('does not touch zoom and shows no stepper when the camera has no zoom capability', async () => {
    withCamera({});
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(applyConstraints.mock.calls.some((c) => JSON.stringify(c).includes('zoom'))).toBe(false);
    expect(screen.queryByText(/×$/)).not.toBeInTheDocument();
  });
});
