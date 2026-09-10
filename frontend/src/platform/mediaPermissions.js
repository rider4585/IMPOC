/**
 * Post-login permission primer.
 *
 * Requests the browser permissions the app needs (currently the camera, for
 * Code 128 barcode scanning) ONCE, right after the user signs in — so the
 * grant is already in place before they reach the Intake/POS scanner instead
 * of a permission prompt appearing mid-scan.
 *
 * Notes:
 * - getUserMedia only works in a secure context (HTTPS / localhost). The dev
 *   server uses basic-ssl, so this is satisfied.
 * - If the user denies (or the browser blocks), we swallow the error; the
 *   scanner surfaces its own guidance when it later fails to open the camera.
 * - Runs at most once per page load (module-level guard); once the user has
 *   granted camera access the browser remembers it per origin, so there is no
 *   repeat prompt on later logins/reloads.
 */

let primed = false;

export async function primeMediaPermissions() {
  if (primed) return;
  primed = true;

  // Only meaningful where camera capture exists and is allowed.
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return;
  }

  // If the Permissions API reports the camera is already granted, don't
  // re-open a stream — nothing to prompt for.
  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const status = await navigator.permissions.query({ name: 'camera' });
      if (status && status.state === 'granted') return;
      // 'denied' -> the browser won't prompt again; requesting is a no-op but harmless.
    }
  } catch {
    // Permissions API not supported for 'camera' (e.g. Firefox) — fall through
    // and let getUserMedia trigger the prompt.
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
    // We only wanted the grant — release the camera immediately.
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // User denied / no camera / blocked — ignore; the scanner handles the
    // failure path when it is actually opened.
  }
}

export default primeMediaPermissions;
