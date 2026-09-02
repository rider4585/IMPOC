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

// Stock intake (trip) endpoints
export const STOCK_INTAKE_ROUTES = {
  /** GET /stock-intakes - List all trips */
  LIST: '/stock-intakes',
  /** POST /stock-intakes - Create a trip */
  CREATE: '/stock-intakes',
  /** GET /stock-intakes/{uuid} - Get a single trip */
  GET: (uuid) => `/stock-intakes/${encodeURIComponent(uuid)}`,
  /** GET /stock-intakes/{tripUuid}/clone-last-lot - Clone the last lot of a trip */
  CLONE_LAST_LOT: (tripUuid) =>
    `/stock-intakes/${encodeURIComponent(tripUuid)}/clone-last-lot`,
};

// Stock intake line (lot) endpoints, mounted under /stock-intakes/:tripUuid/lines
export const STOCK_INTAKE_LINE_ROUTES = {
  /** GET /stock-intakes/{tripUuid}/lines - List lots for a trip */
  LIST: (tripUuid) => `/stock-intakes/${encodeURIComponent(tripUuid)}/lines`,
  /** POST /stock-intakes/{tripUuid}/lines - Create a lot */
  CREATE: (tripUuid) => `/stock-intakes/${encodeURIComponent(tripUuid)}/lines`,
  /** GET /stock-intakes/{tripUuid}/lines/{uuid} - Get a single lot */
  GET: (tripUuid, uuid) =>
    `/stock-intakes/${encodeURIComponent(tripUuid)}/lines/${encodeURIComponent(uuid)}`,
  /** PATCH /stock-intakes/{tripUuid}/lines/{uuid} - Update a lot */
  UPDATE: (tripUuid, uuid) =>
    `/stock-intakes/${encodeURIComponent(tripUuid)}/lines/${encodeURIComponent(uuid)}`,
  /**
   * POST /stock-intakes/{tripUuid}/lines/{uuid}/scan - Scan a barcode into a lot
   * (creates a unit). The stock-intake-line router is mounted with mergeParams, so
   * both :tripUuid and :uuid are required in the path.
   */
  SCAN: (tripUuid, uuid) =>
    `/stock-intakes/${encodeURIComponent(tripUuid)}/lines/${encodeURIComponent(uuid)}/scan`,
};

// Sales / POS endpoints
export const SALES_ROUTES = {
  /** GET /sales - List sales */
  LIST: '/sales',
  /** POST /sales - Checkout a RETAIL sale */
  CREATE: '/sales',
  /** GET /sales/{uuid} - Get a single sale (receipt) */
  GET: (uuid) => `/sales/${encodeURIComponent(uuid)}`,
  /** POST /sales/{uuid}/cancel - Cancel a completed sale */
  CANCEL: (uuid) => `/sales/${encodeURIComponent(uuid)}/cancel`,
  /** POST /sales/{uuid}/refund - Refund a completed sale */
  REFUND: (uuid) => `/sales/${encodeURIComponent(uuid)}/refund`,
};

// Unit endpoints
export const UNIT_ROUTES = {
  /** GET /units/by-barcode/{barcode} - Get a unit by its barcode */
  BY_BARCODE: (barcode) => `/units/by-barcode/${encodeURIComponent(barcode)}`,
  /** GET /units/{uuid} - Get a unit by uuid */
  GET: (uuid) => `/units/${encodeURIComponent(uuid)}`,
};
