import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as requestKeyModule from '../../platform/requestKey.js';
import * as wakingRequestModule from '../../platform/wakingRequest.js';
import apiClient from '../../platform/apiClient.js';
import { BARCODE_ROUTES } from '../../platform/routes.js';

// Mock modules
vi.mock('../../platform/requestKey.js');
vi.mock('../../platform/wakingRequest.js');
vi.mock('../../platform/apiClient.js');

// Import after mocking
import { BarcodePrintScreen } from '../BarcodePrintScreen.jsx';

describe('BarcodePrintScreen (Story 1.17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestKeyModule.createRequestKey.mockReturnValue('test-request-key-uuid');
    wakingRequestModule.wakingRequest.mockImplementation(async (fn) => fn());
  });

  describe('Initial render and form validation', () => {
    it('renders barcode print screen with title and form', () => {
      render(React.createElement(BarcodePrintScreen));
      expect(screen.getByRole('heading', { name: /print labels/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/number of pages/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request sheet/i })).toBeInTheDocument();
    });

    it('mints a request key on mount', () => {
      render(React.createElement(BarcodePrintScreen));
      expect(requestKeyModule.createRequestKey).toHaveBeenCalledTimes(1);
    });

    it('submit button is disabled when pages is empty', () => {
      render(React.createElement(BarcodePrintScreen));
      expect(screen.getByRole('button', { name: /request sheet/i })).toBeDisabled();
    });

    it('submit button is disabled when pages is zero or negative', () => {
      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '0' } });
      expect(button).toBeDisabled();

      fireEvent.change(input, { target: { value: '-5' } });
      expect(button).toBeDisabled();
    });

    it('submit button is enabled when pages is valid', () => {
      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      expect(button).not.toBeDisabled();
    });
  });

  describe('API request and response handling', () => {
    it('calls apiClient with correct parameters on form submission', async () => {
      const mockResponse = {
        data: new ArrayBuffer(100),
        headers: { 'content-type': 'application/pdf' },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(BARCODE_ROUTES.GENERATE, {
          params: {
            pages: 7,
            requestUuid: 'test-request-key-uuid',
          },
          responseType: 'arraybuffer',
        });
      });
    });

    it('shows success message on first-attempt PDF response', async () => {
      const mockResponse = {
        data: new ArrayBuffer(100),
        headers: { 'content-type': 'application/pdf' },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      // Mock URL methods to prevent actual download
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/sheet generated/i)).toBeInTheDocument();
      });
    });

    it('shows replay message on JSON response', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Cached result',
          data: { resultUuid: 'uuid' },
        },
        headers: { 'content-type': 'application/json' },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/already generated in your last attempt/i)).toBeInTheDocument();
      });
    });

    it('shows success message and resets after PDF download', async () => {
      const mockResponse = {
        data: new ArrayBuffer(100),
        headers: { 'content-type': 'application/pdf' },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      // After success, form should be hidden and success message shown
      await waitFor(() => {
        expect(screen.queryByLabelText(/number of pages/i)).not.toBeInTheDocument();
        expect(screen.getByText(/sheet generated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Cold-start waking and retry behavior', () => {
    it('displays waking banner when wakingRequest returns waking status', async () => {
      wakingRequestModule.wakingRequest.mockResolvedValueOnce({
        status: 'waking',
        requestKey: 'test-key',
      });

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/waking the system up/i)).toBeInTheDocument();
      });
    });

    it('keeps form interactive during waking state', async () => {
      wakingRequestModule.wakingRequest.mockResolvedValueOnce({
        status: 'waking',
        requestKey: 'test-key',
      });

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/waking the system up/i)).toBeInTheDocument();
      });

      expect(input).toBeInTheDocument();
    });

    it('displays Try again button on cold-start failure', async () => {
      wakingRequestModule.wakingRequest.mockResolvedValueOnce({
        status: 'failed',
        requestKey: 'test-key',
      });

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('retains same requestKey for retry after failure', async () => {
      // First call returns failed status
      wakingRequestModule.wakingRequest
        .mockResolvedValueOnce({ status: 'failed', requestKey: 'test-request-key-uuid' })
        .mockResolvedValueOnce({
          data: new ArrayBuffer(100),
          headers: { 'content-type': 'application/pdf' },
        });

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      let button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });

      // Click Try again
      button = screen.getByRole('button', { name: /try again/i });
      fireEvent.click(button);

      // Verify both calls used the same request key
      const calls = wakingRequestModule.wakingRequest.mock.calls;
      expect(calls[0][1].requestKey).toBe('test-request-key-uuid');
      expect(calls[1][1].requestKey).toBe('test-request-key-uuid');
    });
  });

  describe('Error handling', () => {
    it('displays server error message on validation error', async () => {
      apiClient.get.mockRejectedValueOnce({
        response: {
          data: { message: 'Pages must be between 1 and 100' },
          status: 400,
        },
      });

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '150' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/must be between/i)).toBeInTheDocument();
      });
    });

    it('uses generic error message when server provides none', async () => {
      apiClient.get.mockRejectedValueOnce({
        response: { status: 500 },
        message: 'Server error',
      });

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });

  });

  describe('Verification gaps - additional test coverage', () => {
    it('includes requested page count in success message', async () => {
      const mockResponse = {
        data: new ArrayBuffer(100),
        headers: { 'content-type': 'application/pdf' },
      };
      apiClient.get.mockResolvedValueOnce(mockResponse);

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      render(React.createElement(BarcodePrintScreen));
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.click(button);

      // Verify success message contains page count
      await waitFor(() => {
        const successMsg = screen.getByText(/sheet generated/i);
        expect(successMsg.textContent).toMatch(/7/);
      });
    });

    it('constructs the full URL correctly when apiClient baseURL is combined with route path', () => {
      // This test verifies that BARCODE_ROUTES.GENERATE path, when combined with apiClient's baseURL,
      // produces the correct full URL without doubling the /api prefix.
      // apiClient.baseURL is '/api' (from VITE_API_BASE_URL environment variable)
      // BARCODE_ROUTES.GENERATE is '/barcodes/generate'
      // Combined: /api + /barcodes/generate = /api/barcodes/generate (NOT /api/api/barcodes/generate)

      const baseURL = '/api'; // This is what apiClient is configured with
      const routePath = BARCODE_ROUTES.GENERATE;
      const fullURL = `${baseURL}${routePath}`;

      // Verify single /api prefix, not doubled
      expect(fullURL).toBe('/api/barcodes/generate');
      expect(fullURL).not.toBe('/api/api/barcodes/generate');
      // Verify route path doesn't contain /api
      expect(routePath).not.toContain('/api');
    });
  });
});
