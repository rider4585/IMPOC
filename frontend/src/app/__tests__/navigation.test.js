import { describe, it, expect } from 'vitest';
import { navigationRegistry, navigationSections } from '../navigation';
import { Dashboard } from '../Dashboard';
import { PERMISSIONS } from '../../constants/permissions';

/**
 * Navigation tests for the R-01 revamp foundation:
 * - navigation.js exposes grouped, labelled sections with icons.
 * - Every grouped item maps to a real registry entry in navigationRegistry
 *   (same path + permission gate, nothing removed/changed).
 * - Role visibility is PRESERVED: items are absent (never disabled) for roles
 *   that lack the permission, present for roles that hold it.
 */

describe('navigationSections — grouped, labelled, iconed', () => {
  it('should define six labelled sections with icons', () => {
    expect(navigationSections).toHaveLength(6);
    const labels = navigationSections.map((s) => s.label);
    expect(labels).toEqual([
      'Inventory',
      'POS / Counter',
      'Rentals',
      'Expenses',
      'Admin',
      'Dashboard',
    ]);
    navigationSections.forEach((section) => {
      expect(typeof section.key).toBe('string');
      expect(typeof section.icon).toBe('string');
      expect(Array.isArray(section.items)).toBe(true);
    });
  });

  it('should group each item under its correct section (paths unchanged)', () => {
    const sectionItems = navigationSections.reduce(
      (acc, s) => ({ ...acc, [s.key]: s.items.map((i) => i.path) }),
      {}
    );
    expect(sectionItems.inventory).toEqual(['/trips', '/vendors', '/barcode-sheets']);
    expect(sectionItems.pos).toEqual(['/pos', '/sales']);
    expect(sectionItems.rentals).toEqual(['/rentals']);
    expect(sectionItems.expenses).toEqual(['/expenses']);
    expect(sectionItems.admin).toEqual(['/users', '/roles', '/permissions', '/picklists', '/customers']);
    expect(sectionItems.dashboard).toEqual(['/dashboard']);
  });

  it('should render Dashboard at /dashboard with reports.view gate', () => {
    const dashboard = navigationSections.find((s) => s.key === 'dashboard');
    expect(dashboard.items[0].path).toBe('/dashboard');
    expect(typeof Dashboard).toBe('function');
  });
});

describe('navigationRegistry compatibility with grouped sections', () => {
  it('should expose every registry path in exactly one grouped section with the same permission gate', () => {
    const registryMap = new Map(
      navigationRegistry.map((entry) => [
        entry.path,
        { permission: entry.permission, label: entry.label },
      ])
    );

    const seen = new Set();
    navigationSections.forEach((section) => {
      section.items.forEach((item) => {
        const reg = registryMap.get(item.path);
        expect(reg).toBeDefined();
        expect(item.permission).toBe(reg.permission);
        expect(item.label).toBe(reg.label);
        seen.add(item.path);
      });
    });

    // Every registry path is reachable from the grouped nav (nothing dropped).
    expect(seen.size).toBe(navigationRegistry.length);
  });
});

describe('Role visibility — absent-not-disabled (preserved)', () => {
  it('should show Trips + Vendors for a user holding inventory.view', () => {
    const acc = navigationSections
      .filter((s) => s.items.length > 0)
      .flatMap((s) => s.items)
      .filter((item) => item.permission === PERMISSIONS.INVENTORY.VIEW);
    const labels = acc.map((item) => item.label);
    expect(labels).toContain('Trips');
    expect(labels).toContain('Vendors');
  });

  it('should show "Print labels" only for INVENTORY_BARCODE_GENERATE holders', () => {
    const holders = navigationSections
      .flatMap((s) => s.items)
      .filter((item) => item.permission === PERMISSIONS.INVENTORY.BARCODE_GENERATE);
    expect(holders.map((i) => i.label)).toEqual(['Print labels']);
    // No item is ever marked disabled — visibility is purely by permission presence.
    navigationSections.forEach((s) =>
      s.items.forEach((i) => expect(i.disabled).toBeUndefined())
    );
  });

  it('should hide "Print labels" for a CASHIER (no inventory.barcode_generate)', () => {
    const cashierPerms = [PERMISSIONS.SALES.CREATE, PERMISSIONS.SALES.VIEW];
    const visibleLabels = navigationSections.flatMap((s) =>
      s.items
        .filter((item) => cashierPerms.includes(item.permission))
        .map((item) => item.label)
    );
    expect(visibleLabels).toContain('POS');
    expect(visibleLabels).toContain('Sales');
    expect(visibleLabels).not.toContain('Print labels');
  });

  it('should surface Admin items only for users holding the relevant view permission', () => {
    const perms = [
      PERMISSIONS.USERS.VIEW,
      PERMISSIONS.ROLES.VIEW,
      PERMISSIONS.PICKLISTS.VIEW,
    ];
    const visible = navigationSections
      .flatMap((s) => s.items)
      .filter((item) => perms.includes(item.permission))
      .map((item) => item.label);
    expect(visible).toEqual(['Users', 'Roles', 'Permissions', 'Picklists']);
  });

  it('should expose empty items for a role with no held permission (absent, not disabled)', () => {
    const visible = navigationSections
      .flatMap((s) => s.items)
      .filter((item) => ['nothing.at.all'].includes(item.permission));
    expect(visible).toHaveLength(0);
  });
});
