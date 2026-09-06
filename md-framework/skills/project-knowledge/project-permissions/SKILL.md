---
name: project-permissions
version: 1.0.0
description: |
  Recover and document the access control model of an existing system: roles,
  permissions, guards, tenancy scoping, and the entitlement matrix that results.
  Produces docs/project-knowledge/permissions.md. Use when asked "who can do
  what", "document the roles", "how does authorisation work", "map permissions",
  or when starting Phase 0 discovery. Required reading before any change to auth,
  roles, or multi-tenant data access.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Project Permissions Discovery

Access control is usually spread across a role table, some middleware, a
decorator or two, and a great deal of implicit assumption. Document the model
that is actually enforced — which is frequently narrower than the one people
believe exists.

### Confidence marking (mandatory)

`[verified]` (read the enforcing code, cited) · `[inferred]` · `[assumed]`.

**Hard rule:** every entry in the entitlement matrix must be `[verified]`. An
authorisation claim you did not read in code is not a claim, it is a hope. If you
cannot verify a cell, mark it `?` and raise it — do not fill it in optimistically.

### Method

1. **Find the identity model.** Where users live, what identifies them, and what
   fields carry authority (`role`, `is_admin`, `permissions`, `shop_id`). Read the
   table definition, not just the model class.

2. **Enumerate the roles.** From an enum, a table, or a constants file. Record
   the complete list, including any role that exists only in data and not in code.

3. **Find every enforcement point.** Authorisation is enforced in more places than
   anyone remembers:
   ```bash
   grep -rnE "@(Roles|UseGuards|RequirePermission|Authorized)" src/ --include=*.js
   grep -rnE "req\.user|currentUser|ctx\.user" src/ --include=*.js | head -40
   grep -rnE "(isAdmin|hasRole|can|ability|policy)" src/ --include=*.js | head -40
   ```
   Include route middleware, service-layer checks, and any row-level filtering.

4. **Separate the two questions.** They fail independently:
   - **Function-level:** may this role call this operation at all?
   - **Object-level:** may this specific user act on *this specific record*?

   A system can enforce the first perfectly and the second not at all. Document
   them in separate columns.

5. **Determine the tenancy boundary.** If data is scoped to a shop, tenant, or
   organisation, find the scoping column and then verify — per query, not per
   assumption — that the scope is applied. Record every query path that does not
   apply it. These are cross-tenant exposure risks.

6. **Check where enforcement happens in the stack.** A check performed only in
   the UI is not enforcement. A check performed only at the route is bypassed by
   any internal caller. Record the layer for each control.

7. **Find the privileged escapes.** Admin overrides, service accounts, internal
   API keys, seed scripts, and debug flags. Every bypass is part of the model and
   must be documented, including what audit trail it leaves.

8. **Build the entitlement matrix.** Roles as rows, protected operations as
   columns. This is the deliverable everything else supports.

### Output

Write `docs/project-knowledge/permissions.md`:

```markdown
# Permissions

## 1. Identity Model     — user storage, authority-bearing fields
## 2. Roles              — complete list, with intended meaning
## 3. Enforcement Points — where checks run, and at which layer
## 4. Entitlement Matrix

| Operation | owner | manager | cashier | Object check | Enforced at |
|-----------|-------|---------|---------|--------------|-------------|
| Void sale | ✅ | ✅ | ❌ | own shop only | `sale.service.ts:88` |
| View cost price | ✅ | ✅ | ❌ | — | `product.dto.ts:31` |

## 5. Tenancy            — scoping column, and every unscoped query path ⚠️
## 6. Privileged Escapes — overrides, service accounts, audit trail
## 7. Gaps               — operations with no verifiable control
## Open Questions
```

### Finishing

- Append durable facts to `$AGENT_DIR/memory.md`.
- `propose` Open Questions to `god`, flagging unscoped tenancy paths as the
  highest priority — those are live cross-tenant exposure.
- This skill documents; it never changes permissions. Any change to the model is
  a separate work item requiring human approval.

## References

- **OWASP Application Security Verification Standard (ASVS) 4.0, V4 Access
  Control** — the function-level / object-level separation in step 4 and the
  "enforce server-side" requirement in step 6
  <https://owasp.org/www-project-application-security-verification-standard/>
- **OWASP API Security Top 10 (2023)** — API1 (Broken Object Level Authorization)
  and API5 (Broken Function Level Authorization) informing steps 4–5
  <https://owasp.org/API-Security/editions/2023/en/0x11-t10/>
- **NIST RBAC model (INCITS 359)** — role/operation matrix structure in step 8
- **Munder Difflin `PROTOCOL.md`** — memory write-back and `propose` handoff

**Not sourced — added deliberately:** the confidence marking, the requirement
that every matrix cell be `[verified]` or marked `?`, and the read-only
restriction in *Finishing*.
