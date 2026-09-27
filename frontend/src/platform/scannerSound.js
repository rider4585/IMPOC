/**
 * Barcode scanner sound & haptic feedback module.
 *
 * Uses custom audio files placed in /sounds:
 * - /sounds/valid-scan.mp3   (Successful / valid scan)
 * - /sounds/invalid-scan.mp3 (Error / invalid / rejected scan)
 *
 * Features:
 * - Pre-loads and caches Audio instances for instant zero-latency playback.
 * - Resets currentTime = 0 on each trigger so rapid consecutive scans sound sharp.
 * - Resilient Web Audio API oscillator fallback if HTML5 Audio fails, is blocked
 *   by autoplay policy, or if the audio files are not accessible.
 * - Dual tactile haptics via navigator.vibrate:
 *   - Valid: single pulse (100ms)
 *   - Invalid: double buzz ([100ms, 50ms, 100ms])
 */

export const VALID_SCAN_SOUND_URL = '/sounds/valid-scan.mp3';
export const INVALID_SCAN_SOUND_URL = '/sounds/invalid-scan.mp3';

let validAudioInstance = null;
let invalidAudioInstance = null;
let sharedAudioContext = null;

function getSharedAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    try {
      sharedAudioContext = new AudioCtx();
    } catch {
      return null;
    }
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

/**
 * Fallback Web Audio synth for valid scan: crisp rising chime (1000Hz -> 1400Hz).
 */
export function playSynthValidSound(ctx = getSharedAudioContext()) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.setValueAtTime(1400, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    /* sound is optional */
  }
}

/**
 * Fallback Web Audio synth for invalid scan: dual-tone descending error buzz (320Hz -> 180Hz).
 */
export function playSynthInvalidSound(ctx = getSharedAudioContext()) {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.setValueAtTime(180, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  } catch {
    /* sound is optional */
  }
}

function getAudioElement(src) {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  try {
    const audio = new Audio(src);
    audio.preload = 'auto';
    return audio;
  } catch {
    return null;
  }
}

/**
 * Play the custom valid scan sound (/sounds/valid-scan.mp3).
 * Falls back to Web Audio oscillator if audio cannot be played.
 */
export function playValidScanSound() {
  if (typeof window === 'undefined') return;
  try {
    if (!validAudioInstance) {
      validAudioInstance = getAudioElement(VALID_SCAN_SOUND_URL);
    }
    if (validAudioInstance) {
      validAudioInstance.currentTime = 0;
      const playPromise = validAudioInstance.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => playSynthValidSound());
      }
      return;
    }
  } catch {
    // fallback
  }
  playSynthValidSound();
}

/**
 * Play the custom invalid scan sound (/sounds/invalid-scan.mp3).
 * Falls back to Web Audio oscillator if audio cannot be played.
 */
export function playInvalidScanSound() {
  if (typeof window === 'undefined') return;
  try {
    if (!invalidAudioInstance) {
      invalidAudioInstance = getAudioElement(INVALID_SCAN_SOUND_URL);
    }
    if (invalidAudioInstance) {
      invalidAudioInstance.currentTime = 0;
      const playPromise = invalidAudioInstance.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => playSynthInvalidSound());
      }
      return;
    }
  } catch {
    // fallback
  }
  playSynthInvalidSound();
}

/**
 * Tactile vibration for valid scan.
 */
export function vibrateValidScan() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(100);
    }
  } catch {
    /* no haptics */
  }
}

/**
 * Tactile vibration for invalid scan (double pulse).
 */
export function vibrateInvalidScan() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([100, 50, 100]);
    }
  } catch {
    /* no haptics */
  }
}
