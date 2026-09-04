/**
 * Centralized API route constants for barcode, stock, trip, and template endpoints
 *
 * ALL paths here are WITHOUT the /api prefix because apiClient.baseURL already includes /api.
 * When adding new endpoints, follow this pattern to prevent doubled-prefix bugs.
 */

// Barcode endpoints
export const BARCODE_ROUTES = {
  /** GET /barcodes/generate - Generate a barcode PDF sheet */
  GENERATE: '/barcodes/generate',
};

// Trip endpoints
export const TRIP_ROUTES = {
  /** GET /trips - List trips (with vendor summaries) */
  LIST: '/trips',
  /** POST /trips - Create a trip */
  CREATE: '/trips',
  /** GET /trips/{uuid} - Get a single trip (with trip_vendors[] and stocks[]) */
  GET: (uuid) => `/trips/${encodeURIComponent(uuid)}`,
  /** POST /trips/{uuid}/vendors - Add a vendor to a trip (bill_reference + total_paid) */
  ADD_VENDOR: (uuid) => `/trips/${encodeURIComponent(uuid)}/vendors`,
  /** GET /trips/{tripUuid}/clone-last-stock - Clone the pre-fill data of the last stock */
  CLONE_LAST_STOCK: (tripUuid) =>
    `/trips/${encodeURIComponent(tripUuid)}/clone-last-stock`,
};

// Stock endpoints (the per-vendor buying unit of a trip), mounted under /trips/:tripUuid/stocks
export const STOCK_ROUTES = {
  /** GET /trips/{tripUuid}/stocks - List stocks for a trip */
  LIST: (tripUuid) => `/trips/${encodeURIComponent(tripUuid)}/stocks`,
  /** POST /trips/{tripUuid}/stocks - Create a stock (for one of the trip's vendors) */
  CREATE: (tripUuid) => `/trips/${encodeURIComponent(tripUuid)}/stocks`,
  /** GET /stocks/{uuid} - Get a single stock */
  GET: (uuid) => `/stocks/${encodeURIComponent(uuid)}`,
  /** PATCH /trips/{tripUuid}/stocks/{uuid} - Update a stock */
  UPDATE: (tripUuid, uuid) =>
    `/trips/${encodeURIComponent(tripUuid)}/stocks/${encodeURIComponent(uuid)}`,
  /** POST /stocks/{uuid}/scan - Scan a barcode into a stock (creates a unit) */
  SCAN: (uuid) => `/stocks/${encodeURIComponent(uuid)}/scan`,
};

// Per-vendor buying template endpoints
export const TEMPLATE_ROUTES = {
  /** GET /templates - List buying templates (filter with ?vendorUuid=) */
  LIST: '/templates',
  /** POST /templates - Create a buying template */
  CREATE: '/templates',
  /** GET /templates/{uuid} - Get a single template */
  GET: (uuid) => `/templates/${encodeURIComponent(uuid)}`,
  /** PATCH /templates/{uuid} - Update a template */
  UPDATE: (uuid) => `/templates/${encodeURIComponent(uuid)}`,
  /** DELETE /templates/{uuid} - Soft-delete a template */
  DELETE: (uuid) => `/templates/${encodeURIComponent(uuid)}`,
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

// Rental agreement endpoints
export const RENTAL_ROUTES = {
  /** GET /rentals - List rental agreements */
  LIST: '/rentals',
  /** POST /rentals - Create (checkout / hand-out) a rental */
  CREATE: '/rentals',
  /** GET /rentals/{uuid} - Get a single agreement */
  GET: (uuid) => `/rentals/${encodeURIComponent(uuid)}`,
  /** POST /rentals/{uuid}/return - Process a return */
  RETURN: (uuid) => `/rentals/${encodeURIComponent(uuid)}/return`,
  /** POST /rentals/{uuid}/cancel - Cancel an active agreement */
  CANCEL: (uuid) => `/rentals/${encodeURIComponent(uuid)}/cancel`,
};

// Expense endpoints
export const EXPENSE_ROUTES = {
  /** GET /expenses - List expenses */
  LIST: '/expenses',
  /** POST /expenses - Create an expense */
  CREATE: '/expenses',
  /** GET /expenses/{uuid} - Get a single expense */
  GET: (uuid) => `/expenses/${encodeURIComponent(uuid)}`,
  /** PATCH /expenses/{uuid} - Update pre-completion */
  UPDATE: (uuid) => `/expenses/${encodeURIComponent(uuid)}`,
  /** POST /expenses/{uuid}/cancel - Cancel a completed expense (reversal) */
  CANCEL: (uuid) => `/expenses/${encodeURIComponent(uuid)}/cancel`,
};

// Unit endpoints
export const UNIT_ROUTES = {
  /** GET /units/by-barcode/{barcode} - Get a unit by its barcode */
  BY_BARCODE: (barcode) => `/units/by-barcode/${encodeURIComponent(barcode)}`,
  /** GET /units/{uuid} - Get a unit by uuid */
  GET: (uuid) => `/units/${encodeURIComponent(uuid)}`,
};

// Customer endpoints (Schema V2 customers entity with contact + consent)
export const CUSTOMER_ROUTES = {
  /** GET /customers - List or search customers (?search=phone-or-name-partial) */
  LIST: '/customers',
  /** POST /customers - Create a customer */
  CREATE: '/customers',
  /** GET /customers/{uuid} - Get a single customer */
  GET: (uuid) => `/customers/${encodeURIComponent(uuid)}`,
  /** PATCH /customers/{uuid} - Update a customer */
  UPDATE: (uuid) => `/customers/${encodeURIComponent(uuid)}`,
  /** PATCH /customers/{uuid}/consent - Toggle a single consent channel */
  CONSENT: (uuid) => `/customers/${encodeURIComponent(uuid)}/consent`,
};

// Receipt endpoints (self-contained payload + plain-text print format)
export const RECEIPT_ROUTES = {
  /** GET /receipts/preview - Structured digital receipt payload */
  PREVIEW: '/receipts/preview',
  /** GET /receipts/print - Plain-text monospace receipt ready for a printer */
  PRINT: '/receipts/print',
};