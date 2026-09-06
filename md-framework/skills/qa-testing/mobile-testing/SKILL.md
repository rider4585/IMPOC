---
name: mobile-testing
version: 1.0.0
description: |
  Test on phones, tablets, and touch-based till terminals — viewport and device
  emulation, touch interaction, camera and scanner access, and the constraints
  real devices impose. Use when testing responsive behaviour, touch flows,
  barcode scanning, or when asked "does this work on the shop floor".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
---

## Mobile & Device Testing

"Mobile" is the wrong mental model for a retail system. The devices are a phone
for stock-taking, a tablet as a mobile till, and a **large touch terminal** at the
counter — wide viewport, touch interaction. Testing by width alone gets the till
exactly wrong.

Establish the **real hardware** before designing the test matrix; record it in
`project-design-system`.

### The matrix

| Device | Viewport | Input | Test priority |
|---|---|---|---|
| Till terminal | 1280×1024 – 1920×1080, landscape | Touch | **Highest** — the revenue path |
| Tablet till | 1024×768, both orientations | Touch | High |
| Phone (stock take) | 390×844 | Touch, one-handed | High |
| Back-office desktop | 1440×900+ | Mouse, keyboard | Medium |
| Narrowest supported | 320×568 | Touch | Layout only |

Test the till at its **actual resolution**, not a laptop approximation.

### Emulation gets you most of the way

```js
// playwright.config.js
projects: [
  { name: 'phone',  use: { ...devices['Pixel 7'] } },
  { name: 'tablet', use: { ...devices['iPad (gen 7) landscape'] } },
  { name: 'till',   use: { viewport: { width: 1920, height: 1080 },
                           hasTouch: true, isMobile: false } },
]
```

The `till` project is the important one and has no preset: wide viewport **with**
touch. Emulating it as a desktop misses touch-target and hover-dependency
defects; emulating it as a phone misses layout defects.

### What emulation cannot tell you

Verify these on real hardware before rollout:

- Actual touch accuracy and target size in use
- Camera behaviour and autofocus for barcode scanning
- Hardware scanner input timing
- Real network conditions in the shop
- On-screen keyboard covering inputs
- Screen readability under shop lighting
- Performance on the actual device CPU
- Battery and thermal behaviour over a shift

Emulation is a filter, not a substitute. At minimum, run the checkout journey on
the real terminal before release.

### Touch interaction

```js
await page.getByRole('button', { name: 'Complete sale' }).tap();
```

Test specifically:

- **Target size** — 44×44 px minimum, larger for primary checkout actions. Verify
  by tapping, not by measuring, on the real device.
- **Adjacent targets** — can a fast tap hit the wrong one? Voiding a line when
  aiming for quantity is a real failure.
- **No hover-only information.** Anything revealed only on hover is invisible to
  touch users — a functional defect, not a styling one.
- **Scroll versus tap** — a tap during a scroll should not activate.
- **Double-tap zoom** must not fire on rapid till interactions.

### Keyboard and input

- The on-screen keyboard covers roughly half the viewport — does it hide the
  field being typed into, or the confirm button?
- `inputMode="numeric"` on quantity and money fields so the numeric keypad
  appears.
- Autocorrect and autocapitalise must be off for SKUs and barcodes.
- Focus should move sensibly between fields.

### Barcode scanning

The distinctive part of this system, and worth explicit charters:

- **Camera scanning** (`@zxing`) — permission prompt, denial, focus, poor
  lighting, damaged and partial barcodes.
- **Hardware scanners** type extremely fast and end with Enter. Test that rapid
  input is not dropped and that the trailing Enter lands on the intended form —
  see `forms`.
- Scanning while a modal is open, or while the field is unfocused.
- Scanning an unknown barcode — a first-class "not found" state, not an error.
- Scanning the same item repeatedly at speed.

```js
await page.keyboard.type('8901234567890', { delay: 5 });   // scanner speed
await page.keyboard.press('Enter');
```

### Orientation and interruption

- Rotate mid-flow — a tablet till gets turned; state must survive.
- Backgrounding the app and returning, with an open sale.
- Screen lock and unlock mid-transaction.
- Incoming call on a phone during stock-take.

### Network conditions

Shop wifi is not office wifi. Test on a throttled connection and offline — see
`network-testing`.

### Accessibility on touch

- Zoom to 200% must keep content usable (WCAG 1.4.10)
- Pinch zoom not disabled
- Screen reader navigation on the till
- Contrast sufficient under bright lighting

### Checklist

- [ ] Real target devices confirmed, not assumed
- [ ] Till tested at actual resolution with touch enabled
- [ ] Both orientations tested on tablets
- [ ] Touch targets verified by tapping on real hardware
- [ ] Adjacent-target mis-taps checked on destructive actions
- [ ] No information available only on hover
- [ ] On-screen keyboard does not obscure fields or confirm buttons
- [ ] `inputMode` correct; autocorrect off for codes
- [ ] Camera scanning tested including permission denial and poor conditions
- [ ] Hardware scanner speed and trailing Enter tested
- [ ] Unknown barcode handled as a defined state
- [ ] Rotation, backgrounding, and lock tested mid-flow
- [ ] Throttled and offline conditions tested
- [ ] 200% zoom usable; pinch zoom enabled
- [ ] Checkout journey run on real hardware before release

## References

- **Playwright documentation — Emulation and device descriptors**
  <https://playwright.dev/docs/emulation>
- **WCAG 2.2 — SC 2.5.8 Target Size, 1.4.10 Reflow, 1.4.4 Resize Text**
  <https://www.w3.org/TR/WCAG22/>
- **MDN — `inputmode`, touch events, Permissions API**
  <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/inputmode>
- **@zxing/browser** — the camera scanning library under test
  <https://github.com/zxing-js/browser>

**Not sourced — written for this framework:** the retail device matrix and the
till-as-touch-terminal emulation profile, the barcode scanning test list, the
interruption scenarios, and the real-hardware requirement before release.
