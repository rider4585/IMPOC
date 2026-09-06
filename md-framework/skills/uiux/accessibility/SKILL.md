---
name: accessibility
version: 1.0.0
description: |
  Build and verify accessible interfaces — semantics, keyboard operation, focus,
  contrast, screen reader support, and testing. Shared by UI/UX and design-system
  agents. Use when building or reviewing any interface, when an element cannot be
  reached by keyboard, or when asked "is this accessible". WCAG 2.2 AA.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Accessibility

Target **WCAG 2.2 Level AA**. Accessibility is not a late-stage audit — most
failures are decided at design time and cost far more to retrofit.

In a retail context this is not hypothetical: staff work under glare, at speed,
sometimes one-handed, and around 5% have a colour vision deficiency. The
accessible design is the one that works on the shop floor.

### Semantics first

Most accessibility comes free from using the right element.

```jsx
// ❌ not focusable, not announced, no keyboard activation
<div onClick={handleVoid}>Void sale</div>

// ✅ everything works by default
<button type="button" onClick={handleVoid}>Void sale</button>
```

| Need | Element |
|---|---|
| Action | `<button>` |
| Navigation | `<a href>` |
| Form control | `<input>` with a real `<label>` |
| Structure | `<h1>`–`<h6>` in order, `<main>`, `<nav>` |
| Tabular data | `<table>` with `<th scope>` |

**ARIA is a fallback, not an upgrade.** `<div role="button" tabindex="0">` plus
key handlers reimplements what `<button>` already does, badly. The first rule of
ARIA is not to use ARIA when a native element will do.

### Keyboard

Everything operable by mouse or touch must be operable by keyboard.

- Logical tab order following visual order
- No keyboard traps — you can always tab out
- `Enter`/`Space` activate; `Escape` closes
- Focus moved deliberately: into a modal on open, back to the trigger on close
- Skip link to main content
- **Never remove focus outlines** without an equivalent replacement

```css
:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

```bash
grep -rn "outline: *none\|outline: *0" src/ --include=*.css
grep -rnE "<div[^>]*onClick" src/ --include=*.jsx
```

Keyboard operation matters here beyond assistive technology: a fast operator on a
till keyboard is faster than one reaching for the screen.

### Contrast

| Element | Minimum |
|---|---|
| Body text | 4.5:1 |
| Large text (≥ 18.66px bold / 24px) | 3:1 |
| UI boundaries, icons, focus indicators | 3:1 |

Verify with a tool, not by eye. Then check on the **actual terminal under shop
lighting** — glare eats contrast that passes on a desk. Treat AA as a floor.

### Never rely on colour alone

```jsx
// ❌ invisible to colour-blind staff, and to anyone at a glance
<span className="text-red">Low</span>

// ✅ colour plus icon plus text
<span className="status status--low"><WarnIcon aria-hidden="true" /> Low stock</span>
```

Stock status, validation errors, and chart series all need a second channel —
icon, text, pattern, or position.

### Forms

```jsx
<label htmlFor="qty">Quantity</label>
<input id="qty" type="number" inputMode="numeric"
       aria-invalid={!!error} aria-describedby={error ? 'qty-err' : undefined} />
{error && <p id="qty-err" role="alert">{error}</p>}
```

Real labels (a placeholder is not a label), errors linked and announced, and
errors identified by text rather than colour. See `forms`.

### Dynamic content

Screen readers do not announce silent DOM changes.

```jsx
<div role="status" aria-live="polite">{`${lineCount} items, total ${total}`}</div>
<div role="alert">{error}</div>          {/* assertive: interrupts */}
```

Announce what changed when a line is added, a sale completes, or a scan fails.
Use `polite` for routine updates and `alert` only for genuine interruptions.

### Modals

Focus moves in on open, is trapped inside, and returns to the trigger on close.
`Escape` closes. Background content is inert.

### Images and icons

- Meaningful images: descriptive `alt`
- Decorative images and icons: `alt=""` or `aria-hidden="true"`
- Icon-only buttons: an accessible name via `aria-label`

### Zoom and reflow

Content must be usable at **200% zoom** without horizontal scrolling (WCAG
1.4.10). Use `rem`, never disable pinch zoom, and never fix layouts to pixel
widths.

### Testing

```bash
npx @axe-core/cli http://localhost:5173      # catches ~30–40% automatically
```

Automated tools find a minority of issues. The rest need manual checks:

1. **Unplug the mouse.** Complete a full sale with the keyboard alone.
2. **Tab through** — is focus always visible and in a sensible order?
3. **Zoom to 200%** — still usable?
4. **Greyscale** — is any meaning lost?
5. **Screen reader** — VoiceOver or NVDA through the checkout flow.

The keyboard-only checkout is the single most revealing test in this system.

### Checklist

- [ ] Native semantic elements used; ARIA only where necessary
- [ ] Everything keyboard-operable, no traps
- [ ] Tab order matches visual order
- [ ] Focus visible everywhere; outlines never removed bare
- [ ] Focus managed into and out of modals
- [ ] Contrast meets AA, verified with a tool and on the real device
- [ ] Nothing conveyed by colour alone
- [ ] Every input has a real label
- [ ] Errors linked with `aria-describedby` and announced
- [ ] Dynamic updates announced via live regions
- [ ] Images and icons have correct alt or are hidden
- [ ] Icon-only buttons have accessible names
- [ ] Usable at 200% zoom; pinch zoom enabled
- [ ] Automated scan run
- [ ] Keyboard-only checkout completed successfully
- [ ] Screen reader pass on the critical flow

## References

- **WCAG 2.2 (Level AA)** — the conformance target
  <https://www.w3.org/TR/WCAG22/>
- **WAI-ARIA Authoring Practices Guide** — patterns and the "no ARIA is better
  than bad ARIA" rule <https://www.w3.org/WAI/ARIA/apg/>
- **MDN — Accessibility** <https://developer.mozilla.org/en-US/docs/Web/Accessibility>
- **WebAIM — Keyboard accessibility and contrast checker**
  <https://webaim.org/techniques/keyboard/>
- **Deque axe-core** — automated testing and its documented coverage limits
  <https://github.com/dequelabs/axe-core>
- **Agente Studio — POS design principles** — visual impairment prevalence and
  variable store lighting
  <https://agentestudio.com/blog/design-principles-pos-interface>

**Not sourced — written for this framework:** the retail framing (glare, speed,
one-handed use), the keyboard-only checkout as the primary manual test, and the
detection commands.
