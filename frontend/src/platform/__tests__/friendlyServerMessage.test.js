import { describe, it, expect } from 'vitest';
import {
  friendlyServerMessage,
  SERVER_UNREACHABLE_MESSAGE,
  SERVER_NOT_RESPONDING_MESSAGE,
  SERVER_ERROR_MESSAGE,
} from '../apiClient';
import { buildError } from '../buildError';

const axiosError = (overrides) => ({ isAxiosError: true, message: 'Request failed with status code 502', ...overrides });

describe('friendlyServerMessage', () => {
  it('maps a backend crash / proxy failure (502/503/504) to "not responding"', () => {
    for (const status of [502, 503, 504]) {
      expect(friendlyServerMessage(axiosError({ response: { status, data: '<html>Bad Gateway</html>' } }))).toBe(
        SERVER_NOT_RESPONDING_MESSAGE
      );
    }
  });

  it('maps no response at all (connection refused / timeout) to "cannot reach"', () => {
    expect(friendlyServerMessage(axiosError({ message: 'Network Error' }))).toBe(SERVER_UNREACHABLE_MESSAGE);
    expect(friendlyServerMessage(axiosError({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' }))).toBe(
      SERVER_UNREACHABLE_MESSAGE
    );
  });

  it('maps an unhandled 500 to a generic server error', () => {
    expect(
      friendlyServerMessage(axiosError({ response: { status: 500, data: { message: 'Internal server error' } } }))
    ).toBe(SERVER_ERROR_MESSAGE);
  });

  it('leaves 4xx and non-axios errors to the caller', () => {
    expect(friendlyServerMessage(axiosError({ response: { status: 404, data: { message: 'Stock not found' } } }))).toBeNull();
    expect(friendlyServerMessage(new TypeError('x is undefined'))).toBeNull();
    expect(friendlyServerMessage(null)).toBeNull();
  });
});

describe('buildError with a server-unavailable error', () => {
  it('surfaces the friendly text and never the 5xx body or axios wording', () => {
    const err = buildError(
      {
        isAxiosError: true,
        isServerUnavailable: true,
        message: SERVER_NOT_RESPONDING_MESSAGE,
        response: { status: 502, data: { message: 'Internal server error' } },
      },
      'Failed to load stocks'
    );
    expect(err.message).toBe(SERVER_NOT_RESPONDING_MESSAGE);
    expect(err.statusCode).toBe(502);
    expect(err.isServerUnavailable).toBe(true);
  });
});
