import { describe, it, expect, beforeEach, vi } from 'vitest';
import apiClient from '../../platform/apiClient.js';
import { SALES_ROUTES, RENTAL_ROUTES, EXPENSE_ROUTES } from '../../platform/routes.js';

// Automock the shared axios instance (see BarcodePrintScreen.test.js for the convention)
vi.mock('../../platform/apiClient.js');

// Import after mocking
import {
  createSale,
  cancelSale,
  refundSale,
} from '../salesApi.js';
import {
  createRental,
  processRentalReturn,
  cancelRental,
} from '../rentalsApi.js';
import {
  createExpense,
  cancelExpense,
} from '../expensesApi.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIXED_UUID = '11111111-2222-4333-8444-555555555555';

const okResponse = (data = { uuid: 'r1' }) => ({ data: { success: true, data } });

function requestBodyOf() {
  return apiClient.post.mock.calls[0][1];
}

describe('money-write APIs send a valid requestUuid (SEC-M-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('salesApi', () => {
    it('createSale mints a valid v4 requestUuid and echoes the rest of the payload', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      const payload = { customerName: 'A', paymentMethod: 'Cash', items: [{ unitUuid: 'u1' }] };

      const result = await createSale(payload);

      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(apiClient.post).toHaveBeenCalledWith(
        SALES_ROUTES.CREATE,
        expect.objectContaining({ ...payload, requestUuid: expect.stringMatching(UUID_V4_REGEX) })
      );
      const body = requestBodyOf();
      expect(body.customerName).toBe('A');
      expect(body.items).toEqual(payload.items);
      expect(body.requestUuid).toMatch(UUID_V4_REGEX);
      expect(result.uuid).toBe('r1');
    });

    it('createSale keeps a caller-supplied requestUuid instead of minting', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await createSale({ requestUuid: FIXED_UUID, items: [] });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });

    it('cancelSale mints a valid v4 requestUuid and keeps the reason', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await cancelSale('sale-1', 'wrong item');
      expect(apiClient.post).toHaveBeenCalledWith(
        SALES_ROUTES.CANCEL('sale-1'),
        { reason: 'wrong item', requestUuid: expect.stringMatching(UUID_V4_REGEX) }
      );
    });

    it('cancelSale honors options.requestUuid for retry reuse', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await cancelSale('sale-1', 'reason', { requestUuid: FIXED_UUID });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });

    it('refundSale mints a valid v4 requestUuid and keeps the reason', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await refundSale('sale-1', 'refund it');
      expect(apiClient.post).toHaveBeenCalledWith(
        SALES_ROUTES.REFUND('sale-1'),
        { reason: 'refund it', requestUuid: expect.stringMatching(UUID_V4_REGEX) }
      );
    });

    it('refundSale honors options.requestUuid for retry reuse', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await refundSale('sale-1', 'reason', { requestUuid: FIXED_UUID });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });
  });

  describe('rentalsApi', () => {
    it('createRental mints a valid v4 requestUuid and echoes the payload', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      const payload = { customerName: 'B', rentalDays: 3, items: [{ unitUuid: 'u1' }] };

      await createRental(payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        RENTAL_ROUTES.CREATE,
        expect.objectContaining({ ...payload, requestUuid: expect.stringMatching(UUID_V4_REGEX) })
      );
      expect(requestBodyOf().requestUuid).toMatch(UUID_V4_REGEX);
    });

    it('createRental keeps a caller-supplied requestUuid', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await createRental({ requestUuid: FIXED_UUID, items: [] });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });

    it('processRentalReturn mints a valid v4 requestUuid with the return payload', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      const payload = { actualReturnDate: '2026-01-02', items: [{ unitUuid: 'u1' }] };

      await processRentalReturn('rental-1', payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        RENTAL_ROUTES.RETURN('rental-1'),
        expect.objectContaining({ ...payload, requestUuid: expect.stringMatching(UUID_V4_REGEX) })
      );
      expect(requestBodyOf().requestUuid).toMatch(UUID_V4_REGEX);
    });

    it('processRentalReturn keeps a caller-supplied requestUuid', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await processRentalReturn('rental-1', { requestUuid: FIXED_UUID, items: [] });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });

    it('cancelRental mints a valid v4 requestUuid and keeps the reason', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await cancelRental('rental-1', 'no longer needed');
      expect(apiClient.post).toHaveBeenCalledWith(
        RENTAL_ROUTES.CANCEL('rental-1'),
        { reason: 'no longer needed', requestUuid: expect.stringMatching(UUID_V4_REGEX) }
      );
    });

    it('cancelRental honors options.requestUuid for retry reuse', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await cancelRental('rental-1', 'reason', { requestUuid: FIXED_UUID });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });
  });

  describe('expensesApi', () => {
    it('createExpense mints a valid v4 requestUuid and echoes the payload', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      const payload = { amountPaise: 5000, category: 'Electricity' };

      await createExpense(payload);

      expect(apiClient.post).toHaveBeenCalledWith(
        EXPENSE_ROUTES.CREATE,
        expect.objectContaining({ ...payload, requestUuid: expect.stringMatching(UUID_V4_REGEX) })
      );
      expect(requestBodyOf().requestUuid).toMatch(UUID_V4_REGEX);
    });

    it('createExpense keeps a caller-supplied requestUuid', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await createExpense({ requestUuid: FIXED_UUID, amountPaise: 1, category: 'X' });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });

    it('cancelExpense mints a valid v4 requestUuid and keeps the reason', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await cancelExpense('expense-1', 'entered twice');
      expect(apiClient.post).toHaveBeenCalledWith(
        EXPENSE_ROUTES.CANCEL('expense-1'),
        { reason: 'entered twice', requestUuid: expect.stringMatching(UUID_V4_REGEX) }
      );
    });

    it('cancelExpense honors options.requestUuid for retry reuse', async () => {
      apiClient.post.mockResolvedValueOnce(okResponse());
      await cancelExpense('expense-1', 'reason', { requestUuid: FIXED_UUID });
      expect(requestBodyOf().requestUuid).toBe(FIXED_UUID);
    });
  });
});