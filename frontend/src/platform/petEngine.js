/**
 * Digital pet sprite engine (R-53).
 *
 * A grid spritesheet where each ROW is one animation and each COLUMN one
 * frame. `SpriteEngine` draws frames onto a <canvas>; `createPetScheduler`
 * picks animations at random (weighted, never the same twice in a row) and
 * holds each one for a per-animation duration, so the pet looks alive on the
 * customer display's idle screen without any input.
 *
 * Sheet: /pet/pet-sheet.png — 1536x1872, 8 columns x 9 rows => 192x208 cells
 * (pixel-measured; every sprite sits inside its cell). Frames per row:
 * [6, 8, 8, 4, 5, 8, 6, 6, 6].
 */

export const PET_SHEET_SRC = '/pet/pet-sheet.png';

/** Sheet geometry — change together with the PNG. */
export const PET_SHEET = Object.freeze({
  width: 1536,
  height: 1872,
  columns: 8,
  rows: 9,
  frameWidth: 192,
  frameHeight: 208,
});

/**
 * Animations, one per row.
 *  - fps:          playback speed, chosen per row from the sheet itself
 *                  (measured mean pixel change between consecutive frames):
 *                    in-between style rows (small, even steps: fly/walk ~0.12,
 *                    idle 0.07, blink 0.10) run fast so motion is smooth;
 *                    key-pose rows (big jumps: sleepy 0.22, coding 0.22,
 *                    worried 0.21, reading 0.15) run slow so each pose reads
 *                    instead of flickering.
 *  - loop:         looping cycle vs one-shot
 *  - weight:       relative chance of being picked by the scheduler
 *  - holdMs:       [min, max] how long the scheduler stays on it (looping
 *                  anims); a one-shot anim plays once, then the scheduler
 *                  moves on regardless of hold.
 * The last three rows (blink / coding / reading) are the "settled" states the
 * user wants to see for much longer than the rest.
 */
export const PET_ANIMATIONS = Object.freeze({
  idle:    { row: 0, frames: 6, fps: 6,  loop: true,  weight: 3, holdMs: [4000, 8000] },   // calm standing, breathing/blink — also the "poke" reaction
  fly:     { row: 1, frames: 8, fps: 12, loop: true,  weight: 2, holdMs: [3000, 6000] },   // wing-flap cycle, facing right — fast for smooth flapping
  walk:    { row: 2, frames: 8, fps: 12, loop: true,  weight: 2, holdMs: [3000, 6000] },   // walk cycle, facing left — fast for smooth stepping
  cheer:   { row: 3, frames: 4, fps: 8,  loop: false, weight: 2, holdMs: [0, 0] },         // wing wave — one shot
  sleepy:  { row: 4, frames: 5, fps: 3,  loop: true,  weight: 2, holdMs: [4000, 7000] },   // nod / stretch key poses — slow
  worried: { row: 5, frames: 8, fps: 5,  loop: false, weight: 1, holdMs: [0, 0] },         // sweat, shake, turn away — one shot, unhurried
  blink:   { row: 6, frames: 6, fps: 4,  loop: true,  weight: 3, holdMs: [12000, 20000] }, // relaxed eyes-closed idle (long)
  coding:  { row: 7, frames: 6, fps: 4,  loop: true,  weight: 3, holdMs: [15000, 25000] }, // typing / sparkle / wave key poses (long)
  reading: { row: 8, frames: 6, fps: 5,  loop: true,  weight: 3, holdMs: [15000, 25000] }, // paper + magnifier (long)
});

/** What the pet does when someone pokes the screen: first row, held briefly. */
export const PET_POKE = Object.freeze({ animation: 'idle', holdMs: 4000 });

/** Full engine config for the shop pet. */
export const PET_CONFIG = Object.freeze({
  frameWidth: PET_SHEET.frameWidth,
  frameHeight: PET_SHEET.frameHeight,
  animations: PET_ANIMATIONS,
});

/**
 * Sanity checks the config against the sheet — used by tests so a re-exported
 * PNG with a different grid fails loudly instead of drawing garbage.
 */
export function validatePetConfig(sheet = PET_SHEET, animations = PET_ANIMATIONS) {
  const problems = [];
  if (sheet.columns * sheet.frameWidth !== sheet.width) problems.push('columns x frameWidth != sheet width');
  if (sheet.rows * sheet.frameHeight !== sheet.height) problems.push('rows x frameHeight != sheet height');
  for (const [name, a] of Object.entries(animations)) {
    if (a.row < 0 || a.row >= sheet.rows) problems.push(`${name}: row ${a.row} outside the sheet`);
    if (a.frames < 1 || a.frames > sheet.columns) problems.push(`${name}: ${a.frames} frames exceed ${sheet.columns} columns`);
    if (!(a.weight > 0)) problems.push(`${name}: weight must be > 0`);
    if (!Array.isArray(a.holdMs) || a.holdMs.length !== 2 || a.holdMs[0] > a.holdMs[1]) problems.push(`${name}: holdMs must be [min, max]`);
    if (a.loop && a.holdMs[1] <= 0) problems.push(`${name}: looping anim needs a positive hold`);
  }
  return problems;
}

/* ---------------------------------------------------------------------- */

/**
 * Canvas sprite player. Pure browser code, no React.
 * Call `destroy()` to stop the rAF loop.
 */
export class SpriteEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {string} imageSrc
   * @param {{frameWidth:number, frameHeight:number, animations:object, scale?:number}} config
   */
  constructor(canvas, imageSrc, config) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frameW = config.frameWidth;
    this.frameH = config.frameHeight;
    this.animations = config.animations;
    this.scale = config.scale || 1;

    this.current = null;
    this.frameIndex = 0;
    this.playing = false;
    this.fps = 8;
    this.loop = true;
    this.onComplete = null;
    this.onPlay = null;
    this.onReady = null;
    this.ready = false;
    this._destroyed = false;
    this._raf = 0;
    this._lastTime = 0;

    this.image = new Image();
    this.image.onload = () => {
      if (this._destroyed) return;
      this.ready = true;
      this._draw();
      if (this.onReady) this.onReady();
    };
    this.image.src = imageSrc;

    this._resizeCanvas();
    this._tick = this._tick.bind(this);
    this._raf = requestAnimationFrame(this._tick);
  }

  _resizeCanvas() {
    this.canvas.width = Math.round(this.frameW * this.scale);
    this.canvas.height = Math.round(this.frameH * this.scale);
  }

  setScale(scale) {
    this.scale = scale;
    this._resizeCanvas();
    this._draw();
  }

  list() {
    return Object.keys(this.animations);
  }

  /**
   * @param {string} name
   * @param {{fps?:number, loop?:boolean, onComplete?:function}} [opts]
   */
  play(name, opts = {}) {
    const anim = this.animations[name];
    if (!anim) {
      console.warn(`[SpriteEngine] Unknown animation "${name}". Available: ${this.list().join(', ')}`);
      return this;
    }
    this.current = name;
    this.frameIndex = 0;
    this.fps = opts.fps ?? anim.fps ?? 8;
    this.loop = opts.loop ?? anim.loop ?? true;
    this.onComplete = opts.onComplete || null;
    this.playing = true;
    this._lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.onPlay) this.onPlay(name);
    this._draw();
    return this;
  }

  stop() {
    this.playing = false;
    return this;
  }

  resume() {
    if (this.current) this.playing = true;
    return this;
  }

  destroy() {
    this._destroyed = true;
    this.playing = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
  }

  _tick(time) {
    if (this._destroyed) return;
    this._raf = requestAnimationFrame(this._tick);
    if (this.playing && this.ready && this.current) {
      const elapsed = time - this._lastTime;
      const frameDuration = 1000 / this.fps;
      if (elapsed >= frameDuration) {
        this._lastTime = time - (elapsed % frameDuration);
        const anim = this.animations[this.current];
        this.frameIndex += 1;
        if (this.frameIndex >= anim.frames) {
          if (this.loop) {
            this.frameIndex = 0;
          } else {
            this.frameIndex = anim.frames - 1;
            this.playing = false;
            if (this.onComplete) {
              const cb = this.onComplete;
              this.onComplete = null;
              cb();
            }
          }
        }
        this._draw();
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.ready || !this.current) return;
    const anim = this.animations[this.current];
    ctx.drawImage(
      this.image,
      this.frameIndex * this.frameW,
      anim.row * this.frameH,
      this.frameW,
      this.frameH,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );
  }
}

/* ---------------------------------------------------------------------- */

/** Weighted random pick, excluding `exclude` when more than one option exists. */
export function pickWeighted(animations, exclude = null, random = Math.random) {
  const entries = Object.entries(animations).filter(([name]) => name !== exclude);
  const pool = entries.length > 0 ? entries : Object.entries(animations);
  const total = pool.reduce((sum, [, a]) => sum + a.weight, 0);
  let roll = random() * total;
  for (const [name, a] of pool) {
    roll -= a.weight;
    if (roll < 0) return name;
  }
  return pool[pool.length - 1][0];
}

/** Random hold between [min, max]. */
export function pickHoldMs(anim, random = Math.random) {
  const [min, max] = anim.holdMs;
  return Math.round(min + (max - min) * random());
}

/**
 * Drives an engine through random animations for defined durations.
 *
 * - looping anim: play, hold for a random time in its holdMs range, move on
 * - one-shot anim: play once (onComplete), then move on
 * - never repeats the animation that just finished
 *
 * @param {SpriteEngine|{play:function, animations:object}} engine
 * @param {object} [opts]
 * @param {object} [opts.animations]   defaults to engine.animations
 * @param {function} [opts.random]     injectable RNG for tests
 * @param {function} [opts.setTimeout] injectable timers for tests
 * @param {function} [opts.clearTimeout]
 * @param {function} [opts.onChange]   (name, holdMs) => void
 * @returns {{start:function, stop:function, poke:function, current:function}}
 */
export function createPetScheduler(engine, opts = {}) {
  const animations = opts.animations || engine.animations;
  const random = opts.random || Math.random;
  const setT = opts.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearT = opts.clearTimeout || ((id) => clearTimeout(id));

  let current = null;
  let timer = null;
  let running = false;

  const next = () => {
    if (!running) return;
    const name = pickWeighted(animations, current, random);
    const anim = animations[name];
    current = name;

    if (anim.loop) {
      const holdMs = pickHoldMs(anim, random);
      engine.play(name);
      if (opts.onChange) opts.onChange(name, holdMs);
      timer = setT(next, holdMs);
    } else {
      engine.play(name, { onComplete: () => { if (running) next(); } });
      if (opts.onChange) opts.onChange(name, 0);
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      next();
    },
    stop() {
      running = false;
      if (timer) clearT(timer);
      timer = null;
    },
    /**
     * Someone tapped/clicked: snap to the attention pose for `holdMs`, then
     * carry on with the random cycle. Repeated pokes restart the hold.
     */
    poke(name = PET_POKE.animation, holdMs = PET_POKE.holdMs) {
      if (!running || !animations[name]) return;
      if (timer) clearT(timer);
      current = name;
      engine.play(name);
      if (opts.onChange) opts.onChange(name, holdMs);
      timer = setT(next, holdMs);
    },
    current() {
      return current;
    },
  };
}
