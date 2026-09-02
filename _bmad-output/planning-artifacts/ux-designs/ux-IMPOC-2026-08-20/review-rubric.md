# Spine Pair Review — IMPOC

Run 2026-08-20, inline (Pass 1 mechanical only). Raviraj selected the rubric walker but also selected *skip*; read as "run the coverage pass, don't dispatch parallel reviewer subagents". Pass 2 judgment lenses and the consolidated `validation-report.html` were **not** produced.

## Overall verdict

The pair is structurally complete and mechanically clean. Every canonical DESIGN.md section is present and in order; every required EXPERIENCE.md section is present, plus four invented sections that each carry a product-specific concern the defaults do not reach. All 23 live capabilities and every cited architecture decision are referenced. Two real gaps were found and fixed in this pass; nothing outstanding is mechanical.

## 1. Flow coverage — strong

Eight key flows, each with a named protagonist, numbered steps, and a climax beat. Coverage against the brief: lot intake with the `8 of 12` counter (Flow 1), clone-last-lot (Flow 2), size-run (Flow 3), POS cart and checkout (Flow 4), rental booking (Flow 5), hand-over and scan-to-return settlement (Flow 6), the owner dashboard (Flow 7), exchange (Flow 8).

### Findings
- **medium** Flows 2, 3 and 7 shipped without a failure path (§ Key Flows). *Fixed in this pass:* clone now carries the CAP-6 validation refusal, the size run carries the deactivated-picklist-entry case, and the dashboard carries empty-range and cold-start-inside-a-drill.

## 2. Token completeness — strong

54 colour tokens, every one a valid 6-digit hex, and **every** base token has a `-dark` pair (checked mechanically, zero misses). 12 typography roles, 5 radii, 15 spacing tokens, 18 component specs. Every `{path.to.token}` reference inside DESIGN.md's own prose and component objects resolves.

Contrast targets are stated for the load-bearing combinations in `EXPERIENCE.md → Accessibility Floor`; the harder claim — that all six status tokens hold contrast against both `surface-base` and `surface-raised` in both themes — is asserted, not measured. Worth a real check before build.

## 3. Component coverage — strong (after fix)

18 components, each now carrying both a visual spec in `DESIGN.md.Components` and a behavioural row in `EXPERIENCE.md.Component Patterns`.

### Findings
- **medium** Five components had a visual spec and no behavioural rules — `button-primary`, `button-secondary`, `button-danger`, `thumb-action-bar`, `deposit-figure`. *Fixed:* three behavioural rows added (Thumb action bar, Buttons, Deposit figure).
- **medium** Two components had behavioural rules and no visual spec — *Date range control* and *Customer sheet*. *Fixed:* `date-range-control` and `customer-sheet` added to the DESIGN.md frontmatter and Components prose.

## 4. State coverage — strong

24 rows in State Patterns, walked against the 26-surface IA. Covers the generic set (empty, filtered-empty, loading, permission-denied, focus) and — more valuably — the domain's own failure vocabulary: barcode already used, lot full, wrong channel, not in stock, duplicate scan, below floor, lost the checkout race, window unavailable, window too long, overdue, sibling still out, beyond repair, outside the exchange window.

Cold start (AD-19.1) is not a row but a section, which is the right altitude — it is cross-cutting, not per-surface.

Notable: `permission absent` resolves to *the surface is not in the navigation at all*, which matches Raviraj's stated role-gating and avoids visible-but-forbidden entries.

## 5. Visual reference coverage — not applicable

`mockups/`, `wireframes/` absent; `imports/` and `.working/` empty. Raviraj declined mocks at the Finalize gate and supplied no Figma, sketches, or brand assets. **All 26 IA surfaces are spine-only by explicit choice** — logged in `.memlog.md`. No orphans, no unspecific references, and no spines-win-on-conflict statement needed since there is nothing to conflict with.

## Mechanical notes

- Both frontmatter blocks parse as YAML. DESIGN.md: 11 keys. EXPERIENCE.md: 6 keys.
- Cross-spine token references: 18 distinct, all resolving.
- No Mermaid diagrams in either spine; nothing to syntax-check.
- Capability IDs, entity names, and status values match `SPEC.md` and its companions verbatim. CAP-16 (retired) is correctly absent.
- CAP-2 initially had no surface; now anchored to the barcode-sheet surface and to the *barcode already used* state, which is the visible floor under AD-17's restore semantics.

## Not run

Pass 2 (bloat & overspecification, inheritance discipline, shape fit judgment) and the accessibility and spec-fidelity lenses were offered and skipped. Re-runnable at any time via `bmad-ux` Validate intent.
