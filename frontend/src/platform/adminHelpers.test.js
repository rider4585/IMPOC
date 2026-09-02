import { describe, it, expect } from 'vitest';
import {
  buildProductTypeTree,
  collectDescendantUuids,
  groupPermissionsByModule,
} from './adminHelpers.js';

const types = [
  { uuid: 'a', name: 'Root A', parentUuid: null, isActive: true },
  { uuid: 'b', name: 'Child B', parentUuid: 'a', isActive: true },
  { uuid: 'c', name: 'Grandchild C', parentUuid: 'b', isActive: true },
  { uuid: 'd', name: 'Sibling D', parentUuid: 'a', isActive: false },
  { uuid: 'e', name: 'Root E', parentUuid: null, isActive: true },
];

describe('buildProductTypeTree', () => {
  it('builds nested tree from flat list', () => {
    const tree = buildProductTypeTree(types);
    expect(tree).toHaveLength(2);

    const a = tree.find((n) => n.uuid === 'a');
    expect(a.children.map((c) => c.uuid)).toEqual(['b', 'd']);
    const b = a.children.find((n) => n.uuid === 'b');
    expect(b.children.map((c) => c.uuid)).toEqual(['c']);
    expect(b.children[0].children).toEqual([]);
  });

  it('handles empty input', () => {
    expect(buildProductTypeTree([])).toEqual([]);
    expect(buildProductTypeTree()).toEqual([]);
  });

  it('breaks a parent cycle safely (does not infinitely recurse)', () => {
    const cyclic = [
      { uuid: 'x', name: 'X', parentUuid: 'y', isActive: true },
      { uuid: 'y', name: 'Y', parentUuid: 'x', isActive: true },
    ];
    const tree = buildProductTypeTree(cyclic);
    // A 2-cycle breaks into a single root with the other node as its child.
    expect(tree).toHaveLength(1);
    const uuids = JSON.stringify(tree).match(/"uuid":"([^"]+)"/g).join(',');
    expect(uuids).toContain('x');
    expect(uuids).toContain('y');
  });

  it('keeps isActive and parentUuid fields', () => {
    const tree = buildProductTypeTree(types);
    const d = tree.find((n) => n.uuid === 'a').children.find((n) => n.uuid === 'd');
    expect(d.isActive).toBe(false);
    expect(d.parentUuid).toBe('a');
  });
});

describe('collectDescendantUuids', () => {
  it('collects the node and all its descendants', () => {
    const set = collectDescendantUuids(types, 'a');
    expect([...set].sort()).toEqual(['a', 'b', 'c', 'd'].sort());
  });

  it('returns only the node when it has no children', () => {
    const set = collectDescendantUuids(types, 'e');
    expect([...set]).toEqual(['e']);
  });

  it('returns empty set for missing node', () => {
    expect(collectDescendantUuids(types, 'missing').size).toBe(0);
  });

  it('is cycle-safe', () => {
    const cyclic = [
      { uuid: 'x', parentUuid: 'y' },
      { uuid: 'y', parentUuid: 'x' },
    ];
    const set = collectDescendantUuids(cyclic, 'x');
    expect(set.has('x')).toBe(true);
    expect(set.has('y')).toBe(true);
  });
});

describe('groupPermissionsByModule', () => {
  const perms = [
    { uuid: '1', name: 'users.view', description: 'View users' },
    { uuid: '2', name: 'users.create', description: 'Create users' },
    { uuid: '3', name: 'inventory.view', description: 'View inventory' },
    { uuid: '4', name: 'standalone', description: 'No prefix' },
  ];

  it('groups by module prefix', () => {
    const groups = groupPermissionsByModule(perms);
    const users = groups.find((g) => g.module === 'users');
    expect(users.permissions.map((p) => p.name)).toEqual(['users.view', 'users.create']);
    const inventory = groups.find((g) => g.module === 'inventory');
    expect(inventory.permissions.map((p) => p.name)).toEqual(['inventory.view']);
  });

  it('falls back to misc for names without a dot', () => {
    const groups = groupPermissionsByModule(perms);
    const misc = groups.find((g) => g.module === 'misc');
    expect(misc.permissions.map((p) => p.name)).toEqual(['standalone']);
  });

  it('handles empty input', () => {
    expect(groupPermissionsByModule([])).toEqual([]);
    expect(groupPermissionsByModule()).toEqual([]);
  });
});
