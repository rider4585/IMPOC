import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as requestKeyModule from '../../platform/requestKey.js';
import * as wakingRequestModule from '../../platform/wakingRequest.js';
import apiClient from '../../platform/apiClient.js';
import { BARCODE_ROUTES } from '../../platform/routes.js';
import { ToastProvider } from '../../components/ui/index.js';

// Mock modules
vi.mock('../../platform/requestKey.js');
vi.mock('../../platform/wakingRequest.js');
vi.mock('../../platform/apiClient.js');
// The embedded sheet configurator (R-50) needs auth + its API; keep both inert here
vi.mock('../../auth/useAuth.js', () => ({ useAuth: () => ({ permissions: ['inventory.barcode_generate'] }) }));
vi.mock('../../services/barcodeLayoutApi.js', () => ({
  getBarcodeLayout: vi.fn(async () => ({})),
  saveBarcodeLayout: vi.fn(),
  fetchLayoutPreviewPdf: vi.fn(),
  getBarcodeLayoutTemplates: vi.fn(async () => []),
  createBarcodeLayoutTemplate: vi.fn(),
  deleteBarcodeLayoutTemplate: vi.fn(),
}));

// Import after mocking
import { BarcodePrintScreen } from '../BarcodePrintScreen.jsx';

// Toasts render through ToastProvider (R-49), so every render needs the provider
const renderScreen = () => render(React.createElement(ToastProvider, null, React.createElement(BarcodePrintScreen)));

describe('BarcodePrintScreen (Story 1.17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestKeyModule.createRequestKey.mockReturnValue('test-request-key-uuid');
    wakingRequestModule.wakingRequest.mockImplementation(async (fn) => fn());
  });

  describe('Initial render and form validation', () => {
    it('renders barcode print screen with title and form', () => {
      renderScreen();
      expect(screen.getByRole('heading', { name: /print labels/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/number of pages/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request sheet/i })).toBeInTheDocument();
    });

    it('mints a request key on mount', () => {
      renderScreen();
      expect(requestKeyModule.createRequestKey).toHaveBeenCalledTimes(1);
    });

    it('submit button is disabled when pages is empty', () => {
      renderScreen();
      expect(screen.getByRole('button', { name: /request sheet/i })).toBeDisabled();
    });

    it('submit button is disabled when pages is zero or negative', () => {
      renderScreen();
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '0' } });
      expect(button).toBeDisabled();

      fireEvent.change(input, { target: { value: '-5' } });
      expect(button).toBeDisabled();
    });

    it('submit button is enabled when pages is valid', () => {
      renderScreen();
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

      renderScreen();
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

      renderScreen();
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/^sheet generated$/i)).toBeInTheDocument();
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

      renderScreen();
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/sheet already generated/i)).toBeInTheDocument();
      });
    });

    it('keeps the form visible and mints a fresh request key after a PDF download (R-49)', async () => {
      const mockResponse = {
        data: new ArrayBuffer(100),
        headers: { 'content-type': 'application/pdf' },
      };
      apiClient.get.mockResolvedValue(mockResponse);

      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      renderScreen();
      // The mount key is already minted; every mint from here on is the "next sheet" key
      requestKeyModule.createRequestKey.mockReturnValue('second-request-key-uuid');

      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/^sheet generated$/i)).toBeInTheDocument();
      });
      expect(apiClient.get).toHaveBeenLastCalledWith(
        BARCODE_ROUTES.GENERATE,
        expect.objectContaining({ params: { pages: 5, requestUuid: 'test-request-key-uuid' } })
      );

      // Form stays usable for the next sheet - no page refresh needed
      const nextInput = screen.getByLabelText(/number of pages/i);
      expect(nextInput.value).toBe('');
      expect(screen.getByRole('button', { name: /request sheet/i })).toBeInTheDocument();

      // A completed request consumes its key: mount key + one fresh key
      expect(requestKeyModule.createRequestKey).toHaveBeenCalledTimes(2);

      // The next request carries the NEW key, so the server does not replay
      fireEvent.change(nextInput, { target: { value: '2' } });
      fireEvent.click(screen.getByRole('button', { name: /request sheet/i }));
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenLastCalledWith(
          BARCODE_ROUTES.GENERATE,
          expect.objectContaining({ params: { pages: 2, requestUuid: 'second-request-key-uuid' } })
        );
      });
    });
  });

  describe('Sheet configurator (R-50)', () => {
    it('is hidden by default and expands below the form on "Configure barcode sheet"', async () => {
      renderScreen();
      expect(screen.queryByTestId('label-layout')).not.toBeInTheDocument();

      const toggle = screen.getByRole('button', { name: /configure barcode sheet/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      fireEvent.click(toggle);

      expect(await screen.findByTestId('label-layout')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /configure barcode sheet/i })).toBeInTheDocument();
      // The print form stays available above it
      expect(screen.getByLabelText(/number of pages/i)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /hide sheet configuration/i }));
      expect(screen.queryByTestId('label-layout')).not.toBeInTheDocument();
    });
  });

  describe('Cold-start waking and retry behavior', () => {
    // Waking is signalled via the onStatus callback (the promise itself stays
    // pending until the real response arrives or it times out).
    const wakeAtAnyDelay = () =>
      wakingRequestModule.wakingRequest.mockImplementationOnce((fn, options) => {
        options?.onStatus?.('waking', options?.requestKey);
        return new Promise(() => {});
      });

    it('displays waking banner when wakingRequest signals waking', async () => {
      wakeAtAnyDelay();

      renderScreen();
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '5' } });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/waking the system up/i)).toBeInTheDocument();
      });
    });

    it('keeps form interactive during waking state', async () => {
      wakeAtAnyDelay();

      renderScreen();
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

      renderScreen();
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

      renderScreen();
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

      renderScreen();
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

      renderScreen();
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

      renderScreen();
      const input = screen.getByLabelText(/number of pages/i);
      const button = screen.getByRole('button', { name: /request sheet/i });

      fireEvent.change(input, { target: { value: '7' } });
      fireEvent.click(button);

      // Verify the success toast description contains the page count
      await waitFor(() => {
        expect(screen.getByText(/7 page\(s\) downloaded/i)).toBeInTheDocument();
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
