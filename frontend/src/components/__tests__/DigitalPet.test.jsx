import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';

const instances = [];
vi.mock('../../platform/petEngine.js', async () => {
  const actual = await vi.importActual('../../platform/petEngine.js');
  class FakeEngine {
    constructor(canvas, src, config) {
      this.canvas = canvas; this.src = src; this.config = config; this.animations = config.animations;
      this.play = vi.fn(); this.stop = vi.fn(); this.resume = vi.fn(); this.destroy = vi.fn();
      instances.push(this);
    }
  }
  return { ...actual, SpriteEngine: FakeEngine };
});

import DigitalPet from '../DigitalPet.jsx';
import { PET_SHEET_SRC } from '../../platform/petEngine.js';

describe('DigitalPet (R-53)', () => {
  beforeEach(() => {
    instances.length = 0;
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });

  it('mounts the engine on a canvas with the shop sheet and starts cycling once loaded', () => {
    render(<DigitalPet scale={2} />);
    const canvas = screen.getByTestId('digital-pet');
    expect(canvas.tagName).toBe('CANVAS');
    expect(instances).toHaveLength(1);
    expect(instances[0].src).toBe(PET_SHEET_SRC);
    expect(instances[0].config.scale).toBe(2);

    act(() => instances[0].onReady());
    expect(instances[0].play).toHaveBeenCalledTimes(1);
    expect(canvas.dataset.animation).toBe(instances[0].play.mock.calls[0][0]);
  });

  it('holds the calm idle pose under prefers-reduced-motion', () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<DigitalPet />);
    act(() => instances[0].onReady());
    expect(instances[0].play).toHaveBeenCalledWith('idle', { fps: 2 });
  });

  it('snaps to the attention pose when the screen is clicked or touched', () => {
    render(<DigitalPet />);
    act(() => instances[0].onReady());
    const before = instances[0].play.mock.calls.length;

    act(() => { fireEvent.pointerDown(document.body); });
    expect(instances[0].play).toHaveBeenCalledTimes(before + 1);
    expect(instances[0].play).toHaveBeenLastCalledWith('idle');
    expect(screen.getByTestId('digital-pet').dataset.animation).toBe('idle');
  });

  it('tears the engine down on unmount', () => {
    const { unmount } = render(<DigitalPet />);
    unmount();
    expect(instances[0].destroy).toHaveBeenCalled();
  });
});
