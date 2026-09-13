import React, { useEffect, useRef, useState } from 'react';
import { SpriteEngine, PET_CONFIG, PET_SHEET, PET_SHEET_SRC, createPetScheduler } from '../platform/petEngine.js';

/**
 * DigitalPet (R-53) — the shop's blue-bird mascot, playing random animations
 * for defined durations (see platform/petEngine.js). Used on the customer
 * display's idle screen.
 *
 * - `scale` multiplies the 192x208 source frame for the canvas bitmap (2 =>
 *   384x416); on screen it is capped to the viewport (`maxWidth`/`maxHeight`)
 *   with the aspect ratio kept, so no frame is ever clipped on small displays
 * - pauses while the tab is hidden (no work on an unseen screen)
 * - with prefers-reduced-motion the pet holds the calm idle pose instead of cycling
 * - a click / touch anywhere on the page "pokes" the pet: it snaps to the
 *   attention pose (row 0) for a few seconds, then resumes the random cycle
 */
export function DigitalPet({ scale = 2, maxWidth = '88vw', maxHeight = '50vh', className = '' }) {
  const canvasRef = useRef(null);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const engine = new SpriteEngine(canvas, PET_SHEET_SRC, { ...PET_CONFIG, scale });
    const scheduler = createPetScheduler(engine, { onChange: (name) => setCurrent(name) });

    engine.onReady = () => {
      if (reduceMotion) {
        engine.play('idle', { fps: 2 });
        setCurrent('idle');
      } else {
        scheduler.start();
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        scheduler.stop();
        engine.stop();
      } else if (!reduceMotion) {
        engine.resume();
        scheduler.start();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // pointerdown covers mouse, touch and pen with one listener. No hidden-tab
    // guard here: the scheduler is already stopped while hidden and poke() is
    // a no-op when it is not running (and some embedded/kiosk webviews report
    // hidden while clearly on screen).
    const onPoke = () => {
      if (!reduceMotion) scheduler.poke();
    };
    window.addEventListener('pointerdown', onPoke);

    return () => {
      window.removeEventListener('pointerdown', onPoke);
      document.removeEventListener('visibilitychange', onVisibility);
      scheduler.stop();
      engine.destroy();
    };
  }, [scale]);

  return (
    <canvas
      ref={canvasRef}
      className={`pet-canvas ${className}`}
      style={{
        imageRendering: 'pixelated',
        // Never larger than the bitmap, never wider/taller than the viewport allows;
        // height follows width so the 192:208 frame is always shown whole.
        width: `min(${PET_SHEET.frameWidth * scale}px, ${maxWidth}, calc(${maxHeight} * ${PET_SHEET.frameWidth} / ${PET_SHEET.frameHeight}))`,
        height: 'auto',
        maxWidth: '100%',
      }}
      role="img"
      aria-label="Shop mascot"
      data-testid="digital-pet"
      data-animation={current || ''}
    />
  );
}

export default DigitalPet;
