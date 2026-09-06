import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../../components/ui/index.js';
import * as authModule from '../../auth/useAuth.js';
import * as tripsService from '../../services/tripsApi.js';
import * as templatesService from '../../services/templatesApi.js';
import * as vendorsService from '../../services/vendorsApi.js';

vi.mock('../../auth/useAuth.js');
vi.mock('../../services/tripsApi.js');
vi.mock('../../services/templatesApi.js');
vi.mock('../../services/vendorsApi.js');
vi.mock('../../services/picklistsApi.js', () => ({
  getProductTypes: vi.fn(),
  getColours: vi.fn().mockResolvedValue([]),
  getSizes: vi.fn().mockResolvedValue([]),
}));

import { getProductTypes, getSizes } from '../../services/picklistsApi.js';
import { StockForm } from '../inventory/StockForm.jsx';
import { TemplateForm } from '../inventory/TemplateForm.jsx';

const CREATOR = ['inventory.view', 'inventory.create'];

const PRODUCT_TYPES = [
  { uuid: 'pt1', name: 'Sari', parentUuid: null, isActive: true },
  { uuid: 'pt2', name: 'Paithani', parentUuid: 'pt1', isActive: true },
  { uuid: 'pt3', name: 'Banarasi', parentUuid: 'pt1', isActive: true },
  { uuid: 'pt4', name: 'Kurti', parentUuid: null, isActive: true },
  { uuid: 'pt5', name: 'Round Neck', parentUuid: 'pt4', isActive: true },
];

const TRIP = {
  uuid: 't1',
  name: 'Delhi run',
  purchasedOn: '2026-09-05',
  notes: null,
  trip_vendors: undefined,
  vendors: [{ uuid: 'tv1', vendorUuid: 'v1', vendorName: 'Sharma Fabrics' }],
  stocks: [],
};

const TEMPLATE = {
  uuid: 'tmp1',
  name: 'Paithani lot',
  productTypeUuid: 'pt1',
  subTypeUuid: 'pt2',
  buyingPricePaise: 30000,
  wholeBuyingPricePaise: 6000000,
  defaultQuantity: 5,
  defaultSellingPricePaise: 50000,
  defaultFloorPricePaise: 40000,
};

function renderStockForm(initialEntries) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={initialEntries || ['/trips/t1/stocks/new']}>
        <Routes>
          <Route path="/trips/:tripUuid/stocks/new" element={<StockForm />} />
          <Route path="/trips/:tripUuid/templates" element={<TemplateForm />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

function renderTemplateForm() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[{ pathname: '/trips/t1/templates', state: { vendorUuid: 'v1' } }]}>
        <Routes>
          <Route path="/trips/:tripUuid/templates" element={<TemplateForm />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Drive a SearchableSelect combobox: click the trigger, type into the search
// input, then click the matching option row. (Modeled on tripsFlow.test.jsx.)
async function selectCombo(label, optionName, queryText) {
  fireEvent.click(screen.getByLabelText(label));
  const search = await screen.findByRole('combobox', { name: new RegExp(`^${escapeRegExp(label)}$`, 'i') });
  if (queryText != null) fireEvent.change(search, { target: { value: queryText } });
  fireEvent.click(await screen.findByRole('option', { name: optionName }));
}

async function fillStockBasics({ typeUuid = 'pt1', quantity = '1', buying = '500', selling = '800', floor = '600' } = {}) {
  const typeName = { pt1: 'Sari', pt4: 'Kurti' }[typeUuid] || typeUuid;
  await selectCombo('Type', typeName, typeName);
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: quantity } });
  fireEvent.change(screen.getByLabelText('Buying price (₹)'), { target: { value: buying } });
  fireEvent.change(screen.getByLabelText('Selling price (₹)'), { target: { value: selling } });
  fireEvent.change(screen.getByLabelText('Floor price (₹)'), { target: { value: floor } });
}

async function expectCreateStockPayload(payload) {
  await waitFor(() => expect(tripsService.createStock).toHaveBeenCalledTimes(1));
  expect(tripsService.createStock).toHaveBeenCalledWith('t1', payload);
}

describe('StockForm — two-level type/subtype + whole/per-unit buying price (R-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: CREATOR });
    tripsService.getTrip.mockResolvedValue(TRIP);
    tripsService.createStock.mockResolvedValue({ uuid: 'S1', name: 'New stock' });
    templatesService.getTemplates.mockResolvedValue([]);
    getProductTypes.mockResolvedValue(PRODUCT_TYPES);
    getSizes.mockResolvedValue([]);
  });

  it('cascades Type → Subtype: subtype shows only children of the selected type and clears when type changes', async () => {
    renderStockForm();

    const typeSelect = await screen.findByLabelText('Type');
    const subSelect = screen.getByLabelText('Subtype (optional)');

    // Type combobox lists only parent nodes (no parentUuid).
    fireEvent.click(typeSelect);
    expect(await screen.findByRole('option', { name: /Sari/ })).toBeInTheDocument();
    const typeOptions = screen.getAllByRole('option').map((o) => o.textContent.trim());
    expect(typeOptions).toEqual(['Sari', 'Kurti']);

    // Subtype is disabled until a Type is chosen.
    expect(subSelect).toBeDisabled();

    // Select "Sari" (pt1): subtypes now expose its children plus the null option.
    fireEvent.click(screen.getByRole('option', { name: /Sari/ }));
    fireEvent.click(subSelect);
    expect(screen.getAllByRole('option').map((o) => o.textContent.trim()))
      .toEqual(['No subtype', 'Paithani', 'Banarasi']);

    fireEvent.click(screen.getByRole('option', { name: /Paithani/ }));
    expect(subSelect).toHaveTextContent('Paithani');

    // Switch to "Kurti" (pt4): subtype resets and lists only Round Neck.
    fireEvent.click(typeSelect);
    fireEvent.click(screen.getByRole('option', { name: /Kurti/ }));
    fireEvent.click(subSelect);
    expect(screen.getAllByRole('option').map((o) => o.textContent.trim()))
      .toEqual(['No subtype', 'Round Neck']);
    expect(subSelect).toHaveTextContent('No subtype');
  });

  it('sends wholeBuyingPricePaise as null when the whole input is blank', async () => {
    renderStockForm();
    await screen.findByLabelText('Type');
    await fillStockBasics();
    // Whole input untouched (blank).
    fireEvent.click(screen.getByRole('button', { name: 'Save stock' }));

    await expectCreateStockPayload({
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: null,
      name: undefined,
      quantity: 1,
      buyingPricePaise: 50000,
      wholeBuyingPricePaise: null,
      sellingPricePaise: 80000,
      floorPricePaise: 60000,
      channel: 'RETAIL',
    });
  });

  it('sends integer paise for a filled whole buying price', async () => {
    renderStockForm();
    await screen.findByLabelText('Type');
    await fillStockBasics();
    fireEvent.change(screen.getByLabelText('Whole stock buying price (₹)'), { target: { value: '1500.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save stock' }));

    await expectCreateStockPayload({
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: null,
      name: undefined,
      quantity: 1,
      buyingPricePaise: 50000,
      wholeBuyingPricePaise: 150050,
      sellingPricePaise: 80000,
      floorPricePaise: 60000,
      channel: 'RETAIL',
    });
  });

  it('sends the selected subtype with the stock', async () => {
    renderStockForm();
    await screen.findByLabelText('Type');
    await fillStockBasics();
    await selectCombo('Subtype (optional)', /Paithani/, 'Paithani');
    fireEvent.click(screen.getByRole('button', { name: 'Save stock' }));

    await expectCreateStockPayload({
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: 'pt2',
      name: undefined,
      quantity: 1,
      buyingPricePaise: 50000,
      wholeBuyingPricePaise: null,
      sellingPricePaise: 80000,
      floorPricePaise: 60000,
      channel: 'RETAIL',
    });
  });

  it('pre-fills subtype + whole price (and the parent type) when a buying template is applied', async () => {
    templatesService.getTemplates.mockResolvedValue([TEMPLATE]);
    renderStockForm();

    await screen.findByLabelText('Type');
    await selectCombo('Vendor (on this trip)', /Sharma Fabrics/, 'Sharma');

    await screen.findByLabelText('Template');
    await selectCombo('Template', /Paithani lot/, 'Paithani');

    expect(screen.getByLabelText('Type')).toHaveTextContent('Sari');
    expect(screen.getByLabelText('Subtype (optional)')).toHaveTextContent('Paithani');
    expect(screen.getByLabelText('Buying price (₹)').value).toBe('300.00');
    expect(screen.getByLabelText('Whole stock buying price (₹)').value).toBe('60000.00');
    expect(screen.getByLabelText('Selling price (₹)').value).toBe('500.00');
    expect(screen.getByLabelText('Floor price (₹)').value).toBe('400.00');
    expect(screen.getByLabelText('Quantity').value).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: 'Save stock' }));

    await expectCreateStockPayload({
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: 'pt2',
      name: 'Paithani lot',
      quantity: 5,
      buyingPricePaise: 30000,
      wholeBuyingPricePaise: 6000000,
      sellingPricePaise: 50000,
      floorPricePaise: 40000,
      channel: 'RETAIL',
    });
  });

  it('carries subtype + whole price through clone pre-fill (location.state.prefill)', async () => {
    const prefill = {
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: 'pt2',
      name: 'Cloned stock',
      quantity: 4,
      buyingPricePaise: 25000,
      wholeBuyingPricePaise: 5000000,
      sellingPricePaise: 60000,
      floorPricePaise: 50000,
      channel: 'RETAIL',
    };
    renderStockForm([{ pathname: '/trips/t1/stocks/new', state: { prefill } }]);

    expect(await screen.findByRole('heading', { name: 'Add stock (cloned)' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Type')).toHaveTextContent('Sari'));
    await waitFor(() => expect(screen.getByLabelText('Subtype (optional)')).toHaveTextContent('Paithani'));
    expect(screen.getByLabelText('Whole stock buying price (₹)').value).toBe('50000.00');
    expect(screen.getByLabelText('Quantity').value).toBe('4');

    fireEvent.click(screen.getByRole('button', { name: 'Save stock' }));

    await expectCreateStockPayload({
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: 'pt2',
      name: 'Cloned stock',
      quantity: 4,
      buyingPricePaise: 25000,
      wholeBuyingPricePaise: 5000000,
      sellingPricePaise: 60000,
      floorPricePaise: 50000,
      channel: 'RETAIL',
    });
  });

  it('links to the templates screen carrying the selected vendor', async () => {
    renderStockForm();
    await screen.findByLabelText('Type');
    fireEvent.click(await screen.findByTestId('manage-templates'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Buying templates' })).toBeInTheDocument();
    });
    expect(templatesService.getTemplates).toHaveBeenCalledWith('v1');
  });
});

describe('TemplateForm — buying template list + create/edit (R-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authModule.useAuth.mockReturnValue({ permissions: CREATOR });
    templatesService.getTemplates.mockResolvedValue([]);
    templatesService.createTemplate.mockResolvedValue(TEMPLATE);
    templatesService.updateTemplate.mockResolvedValue(TEMPLATE);
    templatesService.deleteTemplate.mockResolvedValue({ ok: true });
    vendorsService.getVendors.mockResolvedValue([]);
    getProductTypes.mockResolvedValue(PRODUCT_TYPES);
  });

  it('creates a template with the correct payload (type, subtype, per-unit + whole price, defaults)', async () => {
    renderTemplateForm();
    await screen.findByRole('button', { name: 'New template' });

    fireEvent.click(screen.getByRole('button', { name: 'New template' }));

    await selectCombo('Type', /Sari/, 'Sari');
    await selectCombo('Subtype (optional)', /Paithani/, 'Paithani');
    fireEvent.change(screen.getByLabelText('Template name (optional)'), { target: { value: 'Paithani weekly' } });
    fireEvent.change(screen.getByLabelText('Buying price per unit (₹)'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Whole stock buying price (₹)'), { target: { value: '60000' } });
    fireEvent.change(screen.getByLabelText('Default quantity'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Default selling price (₹)'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Default floor price (₹)'), { target: { value: '400' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create template' }));

    await waitFor(() => expect(templatesService.createTemplate).toHaveBeenCalledTimes(1));
    expect(templatesService.createTemplate).toHaveBeenCalledWith({
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: 'pt2',
      name: 'Paithani weekly',
      buyingPricePaise: 30000,
      wholeBuyingPricePaise: 6000000,
      defaultQuantity: 5,
      defaultSellingPricePaise: 50000,
      defaultFloorPricePaise: 40000,
    });
  });

  it('lists templates with name/type/subtype/prices and edits a template with the correct payload', async () => {
    templatesService.getTemplates.mockResolvedValue([TEMPLATE]);
    renderTemplateForm();

    expect(await screen.findByText('Paithani lot')).toBeInTheDocument();
    expect(screen.getByText('Sari', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/Paithani/).length).toBeGreaterThan(0);
    expect(screen.getByText(/₹300.00\/unit/)).toBeInTheDocument();
    expect(screen.getByText(/Whole ₹60,000.00/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    fireEvent.change(screen.getByLabelText('Template name (optional)'), { target: { value: 'Paithani weekly' } });
    fireEvent.change(screen.getByLabelText('Whole stock buying price (₹)'), { target: { value: '70000' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(templatesService.updateTemplate).toHaveBeenCalledTimes(1));
    expect(templatesService.updateTemplate).toHaveBeenCalledWith('tmp1', {
      vendorUuid: 'v1',
      productTypeUuid: 'pt1',
      subTypeUuid: 'pt2',
      name: 'Paithani weekly',
      buyingPricePaise: 30000,
      wholeBuyingPricePaise: 7000000,
      defaultQuantity: 5,
      defaultSellingPricePaise: 50000,
      defaultFloorPricePaise: 40000,
    });
  });

  it('deletes a template only after confirmation', async () => {
    templatesService.getTemplates.mockResolvedValue([TEMPLATE]);
    renderTemplateForm();

    expect(await screen.findByText('Paithani lot')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(templatesService.deleteTemplate).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(templatesService.deleteTemplate).toHaveBeenCalledWith('tmp1'));
  });
});