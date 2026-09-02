/**
 * Centralized API route constants for barcode and stock intake endpoints
 *
 * ALL paths here are WITHOUT the /api prefix because apiClient.baseURL already includes /api.
 * When adding new endpoints, follow this pattern to prevent doubled-prefix bugs.
 */

// Barcode endpoints
export const BARCODE_ROUTES = {
  /** GET /barcodes/generate - Generate a barcode PDF sheet */
  GENERATE: '/barcodes/generate',
};

// Stock intake endpoints
export const STOCK_INTAKE_ROUTES = {
  /**
   * Build the URL path for scanning a barcode into a stock intake line.
   * POST /stock-intake-lines/{uuid}/scan - Scan a barcode into a stock intake line
   *
   * @param {string} stockIntakeLineUuid - UUID of the stock intake line (lot)
   *                                       Must be a valid UUID string, e.g., "550e8400-e29b-41d4-a716-446655440000"
   * @returns {string} The URL path with the UUID properly encoded, e.g., "/stock-intake-lines/550e8400-e29b-41d4-a716-446655440000/scan"
   * @throws {Error} If stockIntakeLineUuid is not a non-empty string
   */
  SCAN: (stockIntakeLineUuid) => {
    // Check type first
    if (typeof stockIntakeLineUuid !== 'string') {
      throw new Error('stockIntakeLineUuid must be a non-empty string');
    }

    // Trim and validate that it's not empty or whitespace-only
    const trimmedUuid = stockIntakeLineUuid.trim();
    if (trimmedUuid.length === 0) {
      throw new Error('stockIntakeLineUuid must not be empty or whitespace-only');
    }

    // Encode the UUID to prevent URL injection and handle special characters
    const encodedUuid = encodeURIComponent(trimmedUuid);
    return `/stock-intake-lines/${encodedUuid}/scan`;
  },
};
