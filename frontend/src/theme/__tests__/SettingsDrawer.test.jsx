import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

vi.mock('../../services/brandingApi.js', () => ({
  getBranding: vi.fn(async () => ({ shopName: 'Shree Fashion Store', logoDataUrl: null })),
  saveBranding: vi.fn(async (p) => ({ shopName: p.shopName, logoDataUrl: p.logoDataUrl === undefined ? null : p.logoDataUrl })),
}));
vi.mock('../../platform/imageResize.js', () => ({ resizeImageToDataUrl: vi.fn(async () => 'data:image/png;base64,LOGO') }));
const authState = { permissions: ['branding.manage'] };
vi.mock('../../auth/useAuth.js', () => ({ useAuth: () => authState }));

import * as api from '../../services/brandingApi.js';
import { ThemeProvider } from '../ThemeProvider.jsx';
import { BrandingProvider } from '../BrandingProvider.jsx';
import { SettingsDrawer } from '../SettingsDrawer.jsx';
import { ShopLogo } from '../../components/ShopLogo.jsx';

const renderDrawer = () =>
  render(
    <ThemeProvider>
      <BrandingProvider>
        <SettingsDrawer open onClose={() => {}} />
        <ShopLogo />
      </BrandingProvider>
    </ThemeProvider>
  );

describe('SettingsDrawer (R-58)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authState.permissions = ['branding.manage'];
  });

  it('offers a colour picker next to the presets and applies a custom accent', () => {
    renderDrawer();
    const input = screen.getByTestId('custom-accent-input');
    expect(input).toHaveAttribute('type', 'color');
    fireEvent.change(input, { target: { value: '#1e90ff' } });
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#1E90FF');
    expect(screen.getByText(/custom #1e90ff/i)).toBeInTheDocument();
  });

  it('lets an admin rename the shop and upload a logo; the header lockup follows', async () => {
    renderDrawer();
    await waitFor(() => expect(api.getBranding).toHaveBeenCalled());
    const nameInput = screen.getByTestId('shop-name-input');
    await waitFor(() => expect(nameInput).toHaveValue('Shree Fashion Store'));

    fireEvent.change(screen.getByTestId('shop-name-input'), { target: { value: 'Shree Fashion Hub' } });
    const file = new File(['png'], 'logo.png', { type: 'image/png' });
    await act(async () => { fireEvent.change(screen.getByTestId('shop-logo-input'), { target: { files: [file] } }); });
    expect(await screen.findByTestId('shop-logo-preview')).toHaveAttribute('src', 'data:image/png;base64,LOGO');

    fireEvent.click(screen.getByTestId('shop-save'));
    await waitFor(() => expect(api.saveBranding).toHaveBeenCalledWith({ shopName: 'Shree Fashion Hub', logoDataUrl: 'data:image/png;base64,LOGO' }));
    await waitFor(() => expect(screen.getAllByText('Shree Fashion Hub').length).toBeGreaterThan(0));
    expect(JSON.parse(localStorage.getItem('impoc-branding'))).toMatchObject({ shopName: 'Shree Fashion Hub' });
  });

  it('is read-only without branding.manage', async () => {
    authState.permissions = ['inventory.view'];
    renderDrawer();
    await waitFor(() => expect(screen.getByTestId('shop-name-input')).toBeDisabled());
    expect(screen.queryByTestId('shop-save')).not.toBeInTheDocument();
    expect(screen.getByText(/only an admin/i)).toBeInTheDocument();
  });
});
