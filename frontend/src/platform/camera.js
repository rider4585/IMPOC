/**
 * Camera helpers shared by PhotoCapture (R-55).
 */

export const CAMERA_CONSTRAINTS = {
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
  audio: false,
};

export const cameraAvailable = () =>
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices &&
  typeof navigator.mediaDevices.getUserMedia === 'function';

/** Plain-English wording for the common getUserMedia failures. */
export function cameraErrorMessage(err) {
  const name = err?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was blocked. Allow the camera for this site, or choose a photo from the gallery.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device. Choose a photo from the gallery instead.';
  if (name === 'NotReadableError') return 'The camera is in use by another app. Close it and try again.';
  return 'Could not start the camera. Choose a photo from the gallery instead.';
}
