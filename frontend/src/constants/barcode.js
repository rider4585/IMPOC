/**
 * Barcode value shape (R-48): 'SHREE' + 6-char timestamp + 4-char counter = 15
 * chars, uppercase A-Z0-9. The backend accepts up to 32 (older 12-digit labels
 * still exist), so inputs cap at the storage limit, not the current length.
 */
export const BARCODE_MAX_LENGTH = 32;
