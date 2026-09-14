import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

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

import { SCANNER_ZOOM_STORAGE_KEY } from '../../platform/scannerZoom.js';

describe('BarcodeScanner zoom presets (R-61)', () => {
  beforeEach(() => {
    applyConstraints.mockClear();
    localStorage.clear();
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

  it('applies 2x by default, offers only 1x / 2x / 3x, and never asks again', async () => {
    withCamera({ zoom: { min: 1, max: 8, step: 0.1 } });
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] }));
    const group = await screen.findByRole('group', { name: /camera zoom/i });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['1×', '2×', '3×']);
    expect(screen.getByRole('button', { name: /zoom 2x/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('a chosen preset is applied, saved on the device, and used when the scanner opens again', async () => {
    withCamera({ zoom: { min: 1, max: 8, step: 0.1 } });
    const first = render(<BarcodeScanner onDetected={() => {}} />);
    await screen.findByRole('group', { name: /camera zoom/i });
    fireEvent.click(screen.getByRole('button', { name: /zoom 3x/i }));
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] }));
    expect(localStorage.getItem(SCANNER_ZOOM_STORAGE_KEY)).toBe('3');
    first.unmount();

    applyConstraints.mockClear();
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 3 }] }));
    expect(await screen.findByRole('button', { name: /zoom 3x/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('clamps a stored preset to the camera range and ignores junk in storage', async () => {
    localStorage.setItem(SCANNER_ZOOM_STORAGE_KEY, '3');
    withCamera({ zoom: { min: 1, max: 2.5, step: 0.5 } });
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2.5 }] }));

    localStorage.setItem(SCANNER_ZOOM_STORAGE_KEY, '7'); // not a preset -> default 2
    applyConstraints.mockClear();
    withCamera({ zoom: { min: 1, max: 8, step: 0.1 } });
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ zoom: 2 }] }));
  });

  it('shows no zoom control and sets no constraint when the camera cannot zoom', async () => {
    withCamera({});
    render(<BarcodeScanner onDetected={() => {}} />);
    await waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(applyConstraints.mock.calls.some((c) => JSON.stringify(c).includes('zoom'))).toBe(false);
    expect(screen.queryByRole('group', { name: /camera zoom/i })).not.toBeInTheDocument();
  });
});
