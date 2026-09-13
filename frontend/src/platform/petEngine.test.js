import { describe, it, expect, vi } from 'vitest';
import {
  PET_SHEET,
  PET_ANIMATIONS,
  validatePetConfig,
  pickWeighted,
  pickHoldMs,
  createPetScheduler,
  PET_POKE,
} from './petEngine.js';

describe('pet config (R-53)', () => {
  it('matches the pixel-measured sheet: 8x9 grid of 192x208, frames [6,8,8,4,5,8,6,6,6]', () => {
    expect(validatePetConfig()).toEqual([]);
    expect(PET_SHEET.frameWidth * PET_SHEET.columns).toBe(1536);
    expect(PET_SHEET.frameHeight * PET_SHEET.rows).toBe(1872);
    const byRow = Object.values(PET_ANIMATIONS).sort((a, b) => a.row - b.row).map((a) => a.frames);
    expect(byRow).toEqual([6, 8, 8, 4, 5, 8, 6, 6, 6]);
  });

  it('holds the last three rows (blink / coding / reading) far longer than the rest', () => {
    const settled = ['blink', 'coding', 'reading'].map((n) => PET_ANIMATIONS[n].holdMs[0]);
    const others = Object.entries(PET_ANIMATIONS)
      .filter(([n, a]) => !['blink', 'coding', 'reading'].includes(n) && a.loop)
      .map(([, a]) => a.holdMs[1]);
    expect(Math.min(...settled)).toBeGreaterThan(Math.max(...others));
    expect(new Set(['blink', 'coding', 'reading'].map((n) => PET_ANIMATIONS[n].row))).toEqual(new Set([6, 7, 8]));
  });

  it('flags a sheet whose grid does not match', () => {
    expect(validatePetConfig({ ...PET_SHEET, frameWidth: 232 })).toContain('columns x frameWidth != sheet width');
    expect(validatePetConfig(PET_SHEET, { bad: { row: 9, frames: 9, weight: 0, holdMs: [5, 1], loop: true } })).toHaveLength(4);
  });
});

describe('per-animation fps (chosen from the sheet)', () => {
  it('runs the smooth locomotion cycles fast and the key-pose rows slow', () => {
    expect(PET_ANIMATIONS.fly.fps).toBeGreaterThanOrEqual(10);
    expect(PET_ANIMATIONS.walk.fps).toBeGreaterThanOrEqual(10);
    for (const name of ['sleepy', 'coding', 'worried', 'reading']) {
      expect(PET_ANIMATIONS[name].fps).toBeLessThanOrEqual(5);
    }
    expect(PET_POKE.animation).toBe('idle');
    expect(PET_ANIMATIONS.idle.row).toBe(0);
  });
});

describe('pickWeighted / pickHoldMs', () => {
  const anims = { a: { weight: 1 }, b: { weight: 3 } };

  it('respects weights', () => {
    expect(pickWeighted(anims, null, () => 0.1)).toBe('a'); // 0.4 of 4 -> a
    expect(pickWeighted(anims, null, () => 0.5)).toBe('b'); // 2.0 of 4 -> b
    expect(pickWeighted(anims, null, () => 0.999)).toBe('b');
  });

  it('never returns the excluded (previous) animation when another exists', () => {
    for (let i = 0; i < 50; i += 1) expect(pickWeighted(anims, 'b')).toBe('a');
    expect(pickWeighted({ only: { weight: 1 } }, 'only')).toBe('only');
  });

  it('picks a hold inside the range', () => {
    expect(pickHoldMs({ holdMs: [1000, 3000] }, () => 0)).toBe(1000);
    expect(pickHoldMs({ holdMs: [1000, 3000] }, () => 1)).toBe(3000);
    expect(pickHoldMs({ holdMs: [1000, 3000] }, () => 0.5)).toBe(2000);
  });
});

describe('createPetScheduler', () => {
  const makeEngine = () => ({
    animations: {
      loopA: { loop: true, weight: 1, holdMs: [500, 500] },
      shot: { loop: false, weight: 1, holdMs: [0, 0] },
      loopB: { loop: true, weight: 1, holdMs: [900, 900] },
    },
    play: vi.fn(),
  });

  it('plays a looping animation, holds it for its duration, then moves to a different one', () => {
    const engine = makeEngine();
    const timers = [];
    const setT = vi.fn((fn, ms) => { timers.push({ fn, ms }); return timers.length; });
    const clearT = vi.fn();
    const changes = [];
    // RNG: first pick loopA (0.1 of 3 -> loopA), then loopB (exclude loopA -> pool [shot, loopB], 0.9 -> loopB)
    const rolls = [0.1, 0, 0.9, 0];
    const random = () => rolls.shift() ?? 0;

    const s = createPetScheduler(engine, { setTimeout: setT, clearTimeout: clearT, random, onChange: (n, ms) => changes.push([n, ms]) });
    s.start();

    expect(engine.play).toHaveBeenCalledWith('loopA');
    expect(changes).toEqual([['loopA', 500]]);
    expect(timers[0].ms).toBe(500);

    timers[0].fn(); // hold elapsed
    expect(engine.play).toHaveBeenLastCalledWith('loopB');
    expect(changes[1]).toEqual(['loopB', 900]);
    expect(s.current()).toBe('loopB');

    s.stop();
    expect(clearT).toHaveBeenCalled();
    timers[1].fn(); // late timer after stop does nothing
    expect(engine.play).toHaveBeenCalledTimes(2);
  });

  it('poke snaps to the attention pose, holds it, then resumes the random cycle', () => {
    const engine = makeEngine();
    engine.animations.idle = { loop: true, weight: 1, holdMs: [500, 500] };
    const timers = [];
    const setT = vi.fn((fn, ms) => { timers.push({ fn, ms }); return timers.length; });
    const clearT = vi.fn();
    const rolls = [0.05, 0, 0.99, 0]; // loopA first; after the poke, pool excludes idle -> loopB
    const random = () => rolls.shift() ?? 0;
    const s = createPetScheduler(engine, { setTimeout: setT, clearTimeout: clearT, random });

    s.poke(); // ignored before start
    expect(engine.play).not.toHaveBeenCalled();

    s.start();
    expect(engine.play).toHaveBeenLastCalledWith('loopA');

    s.poke();
    expect(clearT).toHaveBeenCalledWith(1); // the loopA hold is cancelled
    expect(engine.play).toHaveBeenLastCalledWith('idle');
    expect(s.current()).toBe('idle');
    expect(timers[timers.length - 1].ms).toBe(PET_POKE.holdMs);

    timers[timers.length - 1].fn(); // attention hold over -> random cycle resumes, not idle again
    expect(engine.play).toHaveBeenLastCalledWith('loopB');
  });

  it('lets a one-shot animation finish (onComplete) before moving on', () => {
    const engine = makeEngine();
    const rolls = [0.5, 0.1]; // 1.5 of 3 -> shot; then exclude shot -> [loopA, loopB], 0.2 -> loopA
    const random = () => rolls.shift() ?? 0;
    const s = createPetScheduler(engine, { setTimeout: vi.fn(() => 1), clearTimeout: vi.fn(), random });
    s.start();

    expect(engine.play.mock.calls[0][0]).toBe('shot');
    const { onComplete } = engine.play.mock.calls[0][1];
    expect(typeof onComplete).toBe('function');

    onComplete();
    expect(engine.play).toHaveBeenLastCalledWith('loopA');
  });
});
