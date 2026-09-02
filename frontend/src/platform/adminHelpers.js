/**
 * Admin screen data-munging helpers.
 * Pure functions shared by the T-03/T-04/T-05 admin screens. Unit-tested.
 */

/**
 * Build a nested tree from a flat list of product types.
 * Cycle-safe: if a parent/child cycle exists, the cycle head is treated as a root
 * so the tree never recurses infinitely.
 *
 * @param {Array<{uuid, name, parentUuid, isActive}>} types - flat list
 * @returns {Array<{uuid, name, parentUuid, isActive, children}>} top-level roots with nested children
 */
export function buildProductTypeTree(types = []) {
  const nodeMap = new Map();
  types.forEach((t) => {
    nodeMap.set(t.uuid, {
      uuid: t.uuid,
      name: t.name,
      parentUuid: t.parentUuid ?? null,
      isActive: t.isActive,
      children: [],
    });
  });

  const roots = [];
  const attached = new Set();

  for (const node of nodeMap.values()) {
    if (attached.has(node.uuid)) continue;

    // Walk up the parent chain. Terminates by: reaching an already-placed node,
    // hitting a cycle (step cap + seen set), or a node whose parent is not present.
    const chain = [];
    const seen = new Set();
    const maxSteps = nodeMap.size + 1;
    let cursor = node;
    let step = 0;
    let attachTarget = null;
    let cycle = false;

    while (cursor && step <= maxSteps) {
      if (attached.has(cursor.uuid)) {
        attachTarget = cursor;
        break;
      }
      if (seen.has(cursor.uuid)) {
        cycle = true;
        break;
      }
      seen.add(cursor.uuid);
      chain.push(cursor);
      const parent = cursor.parentUuid ? nodeMap.get(cursor.parentUuid) : null;
      cursor = parent;
      step += 1;
    }

    if (cycle) {
      // Break the cycle: make the topmost chain node a root and attach the rest downwards.
      const rootNode = chain[chain.length - 1];
      roots.push(rootNode);
      let current = rootNode;
      for (let i = chain.length - 2; i >= 0; i -= 1) {
        current.children.push(chain[i]);
        current = chain[i];
      }
      for (const c of chain) attached.add(c.uuid);
      continue;
    }

    if (attachTarget) {
      // Chain resolves under an already-placed node.
      let current = attachTarget;
      for (let i = chain.length - 1; i >= 0; i -= 1) {
        current.children.push(chain[i]);
        current = chain[i];
      }
      for (const c of chain) attached.add(c.uuid);
      continue;
    }

    // Normal root chain: the topmost chain node has no parent present in the data.
    const rootNode = chain[chain.length - 1];
    roots.push(rootNode);
    let current = rootNode;
    for (let i = chain.length - 2; i >= 0; i -= 1) {
      current.children.push(chain[i]);
      current = chain[i];
    }
    for (const c of chain) attached.add(c.uuid);
  }

  return roots;
}

/**
 * Collect the uuid of a node plus all of its descendants (recursively).
 * Used to keep the "parent" picker cycle-safe when editing a product type.
 *
 * @param {Array<{uuid, parentUuid}>} types - flat list
 * @param {string} rootUuid - the node being edited
 * @returns {Set<string>} uuids that must be excluded from the parent options
 */
export function collectDescendantUuids(types = [], rootUuid) {
  const result = new Set();

  // If the node itself isn't in the data, there are no descendants.
  if (!types.some((t) => t.uuid === rootUuid)) {
    return result;
  }

  const childrenByParent = new Map();
  types.forEach((t) => {
    const key = t.parentUuid ?? null;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(t.uuid);
  });

  const stack = [rootUuid];
  while (stack.length) {
    const u = stack.pop();
    if (result.has(u)) continue;
    result.add(u);
    (childrenByParent.get(u) || []).forEach((c) => stack.push(c));
  }
  return result;
}

/**
 * Group a flat list of permissions into modules by their name prefix (e.g. "users.view" -> "users").
 *
 * @param {Array<{uuid, name, description}>} permissions
 * @returns {Array<{module: string, permissions: Array}>}
 */
export function groupPermissionsByModule(permissions = []) {
  const groups = new Map();
  permissions.forEach((p) => {
    const parts = (p.name || '').split('.');
    const module = parts.length >= 2 && parts[0] ? parts[0] : 'misc';
    if (!groups.has(module)) groups.set(module, []);
    groups.get(module).push(p);
  });
  return [...groups.entries()].map(([module, items]) => ({ module, permissions: items }));
}
