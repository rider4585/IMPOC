---
name: design-tokens
version: 1.0.0
description: |
  Define and structure design tokens — primitive versus semantic layers, naming,
  theming, and how tokens survive a change of CSS tooling. Use when setting up or
  extending a token system, when hard-coded values are spreading, or when asked
  "where should this value live".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Design Tokens

Tokens are named design decisions. They exist so a value is defined once and
changed once — and so the design system can survive a change of tooling.

> **Stack neutrality.** Tokens live in CSS custom properties, which every stack
> can read. A utility framework or component library adopted later should be
> configured to **point at these tokens**, not to define a parallel scale.

### Two layers, and the distinction matters

**Primitives** are raw values with no meaning. **Semantic tokens** say what a
value is *for*. Components use semantic tokens only.

```css
:root {
  /* Layer 1 — primitives. Never used directly in a component. */
  --gray-0:  #ffffff;  --gray-1: #f7f8f9;  --gray-6: #6b7280;  --gray-9: #111318;
  --blue-6:  #2563eb;  --red-6:  #d92d20;  --green-6: #12b76a; --amber-6: #f79009;

  /* Layer 2 — semantic. This is the component-facing API. */
  --color-surface:        var(--gray-0);
  --color-surface-raised: var(--gray-1);
  --color-text:           var(--gray-9);
  --color-text-muted:     var(--gray-6);
  --color-border:         var(--gray-1);
  --color-action:         var(--blue-6);
  --color-danger:         var(--red-6);
  --color-success:        var(--green-6);
  --color-warning:        var(--amber-6);
  --color-focus:          var(--blue-6);
}
```

Without the semantic layer, dark mode means editing every component. With it,
theming is one block:

```css
[data-theme='dark'] {
  --color-surface: var(--gray-9);
  --color-text:    var(--gray-0);
  --color-border:  #2a2f3a;
}
```

**The rule:** a component that references `--gray-6` or `#d92d20` has bypassed
the system. Only `--color-*` semantic names belong in component CSS.

### Naming

Name by **role**, never by appearance. Appearance names go stale the first time
the value changes.

```
❌ --color-red          becomes wrong when danger turns orange
❌ --color-blue-button  encodes both value and usage
❌ --spacing-8px        encodes the value in the name
✅ --color-danger
✅ --space-3
✅ --font-size-body
```

A consistent pattern helps: `--<category>-<role>-<variant>-<state>`, e.g.
`--color-action-hover`, `--color-text-muted`.

### What to tokenise

| Category | Tokens |
|---|---|
| Colour | surface, text, border, action, danger, success, warning, focus |
| Spacing | a single scale, used for padding, margin, and gap |
| Typography | family, size scale, weight, line height, letter spacing |
| Radius | none, sm, md, lg, full |
| Shadow | sm, md, lg |
| Border width | hairline, thin, thick |
| Breakpoints | sm, md, lg, xl |
| Z-index | base, dropdown, sticky, modal, toast |
| Motion | duration and easing |

**Tokenise the z-index scale.** Arbitrary `z-index: 9999` values are one of the
most common sources of layering bugs, and a named scale eliminates the class.

Do **not** tokenise one-off values. A token used once is a value with extra
indirection.

### Component tokens, where they earn it

For a widely reused component, a third layer can help:

```css
--button-height-md:     2.5rem;
--button-padding-x-md:  var(--space-4);
--button-bg-primary:    var(--color-action);
```

Only for genuinely shared primitives. A component token per component is
bureaucracy.

### Theming rules

- Define the **complete** palette on bare `:root`
- Redefine only what changes in a theme block
- **Never define a colour only inside a theme block** — it will be undefined in
  the other theme
- Give `body` an explicit token background and colour

### Adopting a framework later

When Tailwind or a component library arrives, wire it to these tokens:

```js
// tailwind.config — the token layer stays authoritative
theme: { extend: { colors: {
  surface: 'var(--color-surface)',
  danger:  'var(--color-danger)',
} } }
```

For shadcn/ui, map its CSS variables to your semantic tokens on day one — before
components accumulate against a second, divergent scale. Two sources of truth for
colour is worse than either alone.

### Measuring adoption

Tokens only work if they are used.

```bash
grep -rn "var(--" src/ --include=*.css | wc -l                      # token usage
grep -rnE "#[0-9a-fA-F]{3,8}\b|\brgba?\(" src/ --include=*.css --include=*.jsx | wc -l
grep -rnE ":\s*[0-9]+px" src/ --include=*.css | wc -l
grep -rn "z-index" src/ --include=*.css | grep -v "var(--"
```

The ratio of the first to the rest is the health metric — see
`design-system-audit`.

### Checklist

- [ ] Primitive and semantic layers separated
- [ ] Components reference semantic tokens only
- [ ] Tokens named by role, never by appearance or value
- [ ] Full palette defined on bare `:root`
- [ ] Theme blocks redefine only what changes
- [ ] No colour defined solely inside a theme block
- [ ] Spacing, radius, shadow, z-index, and motion tokenised
- [ ] No single-use tokens
- [ ] Component tokens only for shared primitives
- [ ] Any adopted framework points at these tokens
- [ ] Adoption measured; hard-coded values tracked

## References

- **W3C Design Tokens Community Group — format specification** — the
  primitive/semantic (alias) distinction
  <https://tr.designtokens.org/format/>
- **MDN — Using CSS custom properties** — the stack-independent token layer
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties>
- **Tailwind CSS — Theme configuration** — mapping a utility framework onto
  existing tokens <https://tailwindcss.com/docs/theme>
- **shadcn/ui — Theming** — the CSS-variable convention
  <https://ui.shadcn.com/docs/theming>
- **Nathan Curtis — Naming Tokens in Design Systems** — role-based naming
  <https://medium.com/eightshapes-llc/naming-tokens-in-design-systems-9e86c7444676>

**Not sourced — written for this framework:** the z-index tokenisation argument,
the no-single-use-token rule, the adopt-by-pointing-at-existing-tokens guidance,
and the adoption measurement commands.
