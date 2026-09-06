---
name: insecure-deserialization
version: 1.0.0
description: |
  Detect and remediate unsafe reconstruction of untrusted data — prototype
  pollution, unsafe YAML loading, dynamic evaluation, and object injection — in
  Node.js/TypeScript. Use when reviewing code that parses, merges, clones, or
  deserialises client-supplied data, or when asked "check deserialization
  safety". CWE-502, CWE-1321.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Insecure Deserialization (CWE-502)

Reconstructing objects from untrusted input lets an attacker influence what type
of thing gets created and what code runs during construction. In Node the
dominant variant is **prototype pollution** rather than classic gadget chains.

### Prototype pollution (CWE-1321)

A merge, clone, or property-set driven by attacker-controlled keys can write to
`Object.prototype`, changing behaviour application-wide — including flipping
authorisation flags that default to undefined.

```bash
grep -rnE "__proto__|prototype\[|constructor\[" src/ --include=*.js
grep -rnE "(merge|deepMerge|extend|assign|set)\(" src/ --include=*.js
grep -rnE "JSON\.parse\(" src/ --include=*.js | head -30
```

```js
// ❌ attacker sends { "__proto__": { "isAdmin": true } }
function merge(target, source) {
  for (const k in source) {
    if (typeof source[k] === 'object') merge(target[k] ??= {}, source[k]);
    else target[k] = source[k];
  }
}

// ✅ reject the dangerous keys outright
const BLOCKED = new Set(['__proto__', 'constructor', 'prototype']);
for (const k of Object.keys(source)) {
  if (BLOCKED.has(k)) continue;
  // …
}
```

Better still: parse through a **Zod schema that strips or rejects unknown keys**
rather than merging raw input at all. A schema that strips unknown keys removes
the entire class.

### Other unsafe reconstruction

| Pattern | Risk | Safe form |
|---|---|---|
| `yaml.load()` (js-yaml < 4 default) | Arbitrary type instantiation | `yaml.load(s, { schema: JSON_SCHEMA })` or v4+ default |
| `eval` / `new Function` | Direct code execution | Never on input |
| `node-serialize`, `funcster` | Function deserialisation → RCE | Do not use |
| `require(userValue)` | Arbitrary module load | Allow-list |
| `JSON.parse` with a reviver that sets keys | Pollution via reviver | Validate after parse |
| Signed cookie/session objects | Tampering if unsigned or weakly signed | Verify signature before deserialising |

`JSON.parse` alone is safe — it produces plain data. The risk begins with what
you do with the result.

### Remediation principles

1. **Never deserialise untrusted data into a type the input can choose.**
2. **Validate with a schema at the boundary**, and strip unknown properties.
3. **Sign and verify** any object that leaves your trust boundary and comes back
   (cookies, tokens, callbacks) before reconstructing it.
4. **Freeze prototypes** in high-risk services: `Object.freeze(Object.prototype)`
   as defence in depth, not as the primary control.

### Severity

`CRITICAL` where it reaches code execution or sets an authorisation property.
`HIGH` for pollution that alters application behaviour. Assess by what the
polluted property actually controls.

### Checklist

- [ ] No recursive merge/clone over unvalidated input
- [ ] `__proto__`, `constructor`, `prototype` keys blocked or stripped
- [ ] Boundary schemas strip unknown properties
- [ ] YAML loaded with a safe schema
- [ ] No `eval`, `new Function`, or dynamic `require` on input
- [ ] Round-tripped objects signature-verified before reconstruction
- [ ] Regression test added per finding

## References

- **OWASP Deserialization Cheat Sheet** — the do-not-deserialise-untrusted-types
  principle and language-specific guidance
  <https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html>
- **CWE-502** (deserialization of untrusted data) and **CWE-1321** (prototype
  pollution) <https://cwe.mitre.org/data/definitions/1321.html>
- **OWASP Top 10 (2021) A08 Software and Data Integrity Failures**
  <https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/>
- **js-yaml documentation** — `load` schema behaviour and the v4 default change
  <https://github.com/nodeca/js-yaml>

**Not sourced — written for this framework:** the Node-specific pattern table,
the merge-function contrast, the detection commands, and the schema-first
recommendation.
