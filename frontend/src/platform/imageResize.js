/**
 * Client-side photo downscaling (R-55).
 *
 * Phone photos are 3–8 MB; the vendor bill only needs to be readable. Resize
 * to `maxSide` on the longest edge and re-encode as JPEG so what we store in
 * trip_vendors.receipt_image (base64 text) stays a few hundred KB.
 */

export const RESIZE_DEFAULTS = Object.freeze({ maxSide: 1600, quality: 0.82, mimeType: 'image/jpeg' });

/** Decode a File/Blob into something drawable, honouring EXIF orientation where the browser can. */
async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Older browsers reject the options bag or the format; fall through.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not read the image file.'));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Target size that keeps the aspect ratio and fits `maxSide`. */
export function fitWithin(width, height, maxSide) {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const ratio = maxSide / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

/**
 * @param {Blob} blob - the picked/captured image
 * @param {{maxSide?:number, quality?:number, mimeType?:string}} [opts]
 * @returns {Promise<string>} JPEG data-URL
 */
export async function resizeImageToDataUrl(blob, opts = {}) {
  const { maxSide, quality, mimeType } = { ...RESIZE_DEFAULTS, ...opts };
  const source = await decode(blob);
  const srcW = source.naturalWidth ?? source.width;
  const srcH = source.naturalHeight ?? source.height;
  const { width, height } = fitWithin(srcW, srcH, maxSide);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);
  if (typeof source.close === 'function') source.close();

  return canvas.toDataURL(mimeType, quality);
}

/** Rough byte size of a base64 data-URL payload (for size checks/labels). */
export function dataUrlBytes(dataUrl) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}
