import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../platform/imageResize.js', () => ({
  resizeImageToDataUrl: vi.fn(async () => 'data:image/jpeg;base64,SHOT'),
  dataUrlBytes: () => 4,
}));

import PhotoCapture from '../PhotoCapture.jsx';
import { cameraErrorMessage } from '../../platform/camera.js';

const makeStream = () => { const track = { stop: vi.fn() }; return { getTracks: () => [track] }; };

describe('PhotoCapture (R-55)', () => {
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['x'], { type: 'image/jpeg' })));
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: originalMediaDevices, configurable: true });
  });

  const withCamera = (getUserMedia) =>
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia }, configurable: true });

  it('take photo → capture → review → Use photo hands back the resized shot and stops the camera', async () => {
    const stream = makeStream();
    const stop = stream.getTracks()[0].stop;
    withCamera(vi.fn(async () => stream));
    const onPhoto = vi.fn();

    render(<PhotoCapture onPhoto={onPhoto} />);
    fireEvent.click(screen.getByTestId('take-photo'));

    const video = await screen.findByTestId('camera-preview');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
    Object.defineProperty(video, 'videoWidth', { value: 1280, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 720, configurable: true });

    await act(async () => { fireEvent.click(screen.getByTestId('shutter')); });

    expect(await screen.findByTestId('review-image')).toHaveAttribute('src', 'data:image/jpeg;base64,SHOT');
    expect(onPhoto).not.toHaveBeenCalled(); // nothing attached until confirmed

    fireEvent.click(screen.getByTestId('use-photo'));
    expect(onPhoto).toHaveBeenCalledWith('data:image/jpeg;base64,SHOT');
    await waitFor(() => expect(screen.queryByTestId('review-image')).not.toBeInTheDocument());
    expect(stop.mock.calls.length).toBeGreaterThan(0);
  });

  it('Retake reopens the camera instead of attaching', async () => {
    withCamera(vi.fn(async () => makeStream()));
    const onPhoto = vi.fn();
    render(<PhotoCapture onPhoto={onPhoto} />);

    fireEvent.click(screen.getByTestId('take-photo'));
    const video = await screen.findByTestId('camera-preview');
    Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
    await act(async () => { fireEvent.click(screen.getByTestId('shutter')); });
    await screen.findByTestId('review-image');

    fireEvent.click(screen.getByTestId('retake-photo'));
    await screen.findByTestId('camera-preview');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it('gallery pick goes through the same review step', async () => {
    withCamera(vi.fn());
    const onPhoto = vi.fn();
    render(<PhotoCapture onPhoto={onPhoto} />);

    const file = new File(['png'], 'bill.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('gallery-input'), { target: { files: [file] } });
    await screen.findByTestId('review-image');
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('use-photo'));
    expect(onPhoto).toHaveBeenCalledWith('data:image/jpeg;base64,SHOT');
  });

  it('rejects non-image files with a plain message', async () => {
    withCamera(vi.fn());
    render(<PhotoCapture onPhoto={vi.fn()} />);
    fireEvent.change(screen.getByTestId('gallery-input'), { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/choose an image file/i);
  });

  it('falls back to the native capture input when the camera is blocked or missing', async () => {
    withCamera(vi.fn(async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); }));
    render(<PhotoCapture onPhoto={vi.fn()} />);

    expect(screen.queryByTestId('native-capture-input')).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByTestId('take-photo')); });

    expect(await screen.findByRole('alert')).toHaveTextContent(/camera access was blocked/i);
    const native = screen.getByTestId('native-capture-input');
    expect(native).toHaveAttribute('capture', 'environment');
    expect(native).toHaveAttribute('accept', 'image/*');
  });

  it('uses the native capture input straight away when getUserMedia does not exist', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    render(<PhotoCapture onPhoto={vi.fn()} />);
    expect(screen.getByTestId('native-capture-input')).toBeInTheDocument();
  });

  it('maps camera errors to plain wording', () => {
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toMatch(/no camera/i);
    expect(cameraErrorMessage({ name: 'NotReadableError' })).toMatch(/in use/i);
    expect(cameraErrorMessage({})).toMatch(/could not start/i);
  });
});
