import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog } from './ui';
import { resizeImageToDataUrl } from '../platform/imageResize.js';
import { CAMERA_CONSTRAINTS, cameraAvailable, cameraErrorMessage } from '../platform/camera.js';

/**
 * PhotoCapture (R-55) — "Take photo" / "Choose from gallery" with a review
 * step (Use photo / Retake / Cancel) before anything reaches the form.
 *
 * - Take photo: in-app camera via getUserMedia (rear camera on phones,
 *   webcam on laptops). If the camera API is unavailable (plain http on the
 *   LAN, no camera, permission denied) the button falls back to the native
 *   file input with `capture="environment"`, which opens the phone's camera.
 * - Choose from gallery: plain file input (no capture) → same review step.
 * - Every image (camera or gallery) is downscaled client-side before it is
 *   handed back, so the stored base64 stays small.
 *
 * Props: onPhoto(dataUrl), disabled, maxBytes (post-resize guard), labels.
 */

export function PhotoCapture({ onPhoto, disabled = false, maxBytes = 5 * 1024 * 1024, takeLabel = 'Take photo', galleryLabel = 'Choose from gallery' }) {
  const [step, setStep] = useState('idle'); // idle | camera | review
  const [shot, setShot] = useState(null); // data-URL under review
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [useNativeCapture, setUseNativeCapture] = useState(!cameraAvailable());
  // The <video> lives inside a portalled Dialog, so it may not exist yet when
  // getUserMedia resolves; attach the stream from an effect once both are there.
  const [stream, setStream] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const galleryInputRef = useRef(null);
  const nativeCaptureRef = useRef(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  useEffect(() => {
    const video = videoRef.current;
    if (step !== 'camera' || !stream || !video) return;
    video.srcObject = stream;
    const playing = video.play?.();
    if (playing && typeof playing.catch === 'function') playing.catch(() => {});
  }, [step, stream]);

  const close = useCallback(() => {
    stopCamera();
    setShot(null);
    setStep('idle');
    setBusy(false);
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError('');
    if (!cameraAvailable()) {
      setUseNativeCapture(true);
      nativeCaptureRef.current?.click();
      return;
    }
    setStep('camera');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      streamRef.current = mediaStream;
      setStream(mediaStream);
    } catch (err) {
      stopCamera();
      setStep('idle');
      setError(cameraErrorMessage(err));
      // Next tap goes straight to the device's own camera app instead.
      setUseNativeCapture(true);
    }
  }, [stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setError('The camera is still starting — try again in a moment.');
      return;
    }
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      const dataUrl = await resizeImageToDataUrl(blob);
      stopCamera();
      setShot(dataUrl);
      setStep('review');
    } catch {
      setError('Could not capture the photo. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [stopCamera]);

  const reviewFile = useCallback(async (file) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      if (dataUrl.length > maxBytes * 1.4) {
        setError('That photo is too large even after resizing. Try a smaller one.');
        return;
      }
      setShot(dataUrl);
      setStep('review');
    } catch (err) {
      setError(err?.message || 'Could not read the image file.');
    } finally {
      setBusy(false);
    }
  }, [maxBytes]);

  const onFileInput = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    reviewFile(file);
  };

  const usePhoto = () => {
    if (shot) onPhoto(shot);
    close();
  };

  const retake = () => {
    setShot(null);
    startCamera();
  };

  return (
    <div className="flex flex-col gap-2" data-testid="photo-capture">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={startCamera} data-testid="take-photo">
          {takeLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => galleryInputRef.current?.click()} data-testid="choose-gallery">
          {galleryLabel}
        </Button>
      </div>

      {/* Hidden inputs: gallery (no capture) and the native-camera fallback (capture) */}
      <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={onFileInput} data-testid="gallery-input" />
      {useNativeCapture && (
        <input ref={nativeCaptureRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileInput} data-testid="native-capture-input" />
      )}

      {error && (
        <p className="text-xs font-medium text-[var(--danger)]" role="alert">{error}</p>
      )}

      <Dialog
        open={step !== 'idle'}
        onClose={close}
        title={step === 'review' ? 'Review photo' : 'Take photo'}
        footer={
          step === 'review' ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="button" variant="outline" onClick={retake} data-testid="retake-photo">Retake</Button>
              <Button type="button" onClick={usePhoto} data-testid="use-photo">Use photo</Button>
            </div>
          ) : (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
              <Button type="button" onClick={capture} disabled={busy} data-testid="shutter">
                {busy ? 'Capturing…' : 'Capture'}
              </Button>
            </div>
          )
        }
      >
        {step === 'camera' && (
          <div className="flex flex-col items-center gap-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="max-h-[60vh] w-full rounded-md bg-black object-contain"
              data-testid="camera-preview"
            />
            <p className="text-xs text-[var(--ink-muted)]">Hold the bill flat and fill the frame, then tap Capture.</p>
          </div>
        )}
        {step === 'review' && shot && (
          <div className="flex flex-col items-center gap-2">
            <img src={shot} alt="Photo under review" className="max-h-[60vh] w-full rounded-md object-contain" data-testid="review-image" />
            <p className="text-xs text-[var(--ink-muted)]">Is the whole bill readable? If not, retake it.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

export default PhotoCapture;
