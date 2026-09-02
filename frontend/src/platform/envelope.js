/**
 * Parses a collection envelope from the API response.
 * Unwraps the collection structure and validates it.
 *
 * Expected input shape: { success: true, data: { items, page, pageSize, total } }
 *
 * @param {any} response - The API response envelope
 * @returns {Object} Unwrapped collection: { items, page, pageSize, total }
 * @throws {Error} If the response is not a valid collection envelope
 */
export function parseEnvelope(response) {
  // Check if response is an array (forbidden)
  if (Array.isArray(response)) {
    throw new Error('Collection response must not be a bare array');
  }

  // Check if response has the expected shape
  if (!response || typeof response !== 'object') {
    throw new Error('Collection response must be an object');
  }

  // Verify success flag is true
  if (response.success !== true) {
    throw new Error('Collection response must have success: true');
  }

  // Verify the data field exists and is an object
  if (!response.data || typeof response.data !== 'object' || Array.isArray(response.data)) {
    throw new Error('Collection response must have a data object containing items, page, pageSize, and total');
  }

  const { data } = response;

  // Verify required collection fields
  if (
    !('items' in data) ||
    !('page' in data) ||
    !('pageSize' in data) ||
    !('total' in data)
  ) {
    throw new Error('Collection data must contain items, page, pageSize, and total fields');
  }

  // items must be an array
  if (!Array.isArray(data.items)) {
    throw new Error('Collection items must be an array');
  }

  // Validate page, pageSize, and total are numbers
  if (typeof data.page !== 'number' || typeof data.pageSize !== 'number' || typeof data.total !== 'number') {
    throw new Error('Collection page, pageSize, and total must be numbers');
  }

  return {
    items: data.items,
    page: data.page,
    pageSize: data.pageSize,
    total: data.total,
  };
}
