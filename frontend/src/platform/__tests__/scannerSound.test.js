import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  VALID_SCAN_SOUND_URL,
  INVALID_SCAN_SOUND_URL,
  playValidScanSound,
  playInvalidScanSound,
  vibrateValidScan,
  vibrateInvalidScan,
  playSynthValidSound,
  playSynthInvalidSound,
} from '../scannerSound.js';

describe('scannerSound platform module', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exposes correct sound asset URLs', () => {
    expect(VALID_SCAN_SOUND_URL).toBe('/sounds/valid-scan.mp3');
    expect(INVALID_SCAN_SOUND_URL).toBe('/sounds/invalid-scan.mp3');
  });

  it('triggers haptics for valid and invalid scans', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateSpy,
      configurable: true,
      writable: true,
    });

    vibrateValidScan();
    expect(vibrateSpy).toHaveBeenCalledWith(100);

    vibrateInvalidScan();
    expect(vibrateSpy).toHaveBeenCalledWith([100, 50, 100]);
  });

  it('synthesizes valid sound via AudioContext', () => {
    const mockOsc = {
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const mockCtx = {
      currentTime: 10,
      destination: {},
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
    };

    playSynthValidSound(mockCtx);
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(mockOsc.start).toHaveBeenCalledWith(10);
    expect(mockOsc.stop).toHaveBeenCalledWith(10.15);
  });

  it('synthesizes invalid error sound via AudioContext', () => {
    const mockOsc = {
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const mockGain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };
    const mockCtx = {
      currentTime: 20,
      destination: {},
      createOscillator: vi.fn(() => mockOsc),
      createGain: vi.fn(() => mockGain),
    };

    playSynthInvalidSound(mockCtx);
    expect(mockCtx.createOscillator).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(mockOsc.type).toBe('sawtooth');
    expect(mockOsc.start).toHaveBeenCalledWith(20);
    expect(mockOsc.stop).toHaveBeenCalledWith(20.22);
  });

  it('plays valid sound using HTMLAudioElement if available', () => {
    const playMock = vi.fn().mockReturnValue(Promise.resolve());
    window.Audio = vi.fn().mockImplementation(() => ({
      play: playMock,
      currentTime: 0,
      preload: 'auto',
    }));

    playValidScanSound();
    expect(playMock).toHaveBeenCalled();
  });

  it('plays invalid sound using HTMLAudioElement if available', () => {
    const playMock = vi.fn().mockReturnValue(Promise.resolve());
    window.Audio = vi.fn().mockImplementation(() => ({
      play: playMock,
      currentTime: 0,
      preload: 'auto',
    }));

    playInvalidScanSound();
    expect(playMock).toHaveBeenCalled();
  });
});
