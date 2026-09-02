---
name: IMPOC
description: Barcode-driven inventory, POS and rental for SHREE Fashion Store. Warm-retail identity on a phone-first operating surface, with a wide reading surface for the owner's dashboard.
status: final
created: '2026-08-20'
updated: '2026-08-23'
sources:
  - _bmad-output/specs/spec-impoc-core/SPEC.md
  - _bmad-output/planning-artifacts/architecture/architecture-IMPOC-2026-08-20/ARCHITECTURE-SPINE.md
  - frontend/AGENTS.md
colors:
  # Warm neutral surfaces (light)
  surface-base: '#FBF7F3'
  surface-raised: '#FFFFFF'
  surface-sunken: '#F1E9E0'
  surface-scan: '#1C1512'
  ink: '#2A211C'
  ink-muted: '#6B5D54'
  ink-faint: '#9C8E83'
  border: '#E4D9CD'
  border-strong: '#CBBBAA'
  # Warm neutral surfaces (dark)
  surface-base-dark: '#191411'
  surface-raised-dark: '#231C18'
  surface-sunken-dark: '#100C0A'
  surface-scan-dark: '#0B0807'
  ink-dark: '#F4EDE5'
  ink-muted-dark: '#B3A497'
  ink-faint-dark: '#7C6E64'
  border-dark: '#382E28'
  border-strong-dark: '#4E4139'
  # Brand: jewel primary, warm gold accent
  primary: '#7B2D4E'
  primary-foreground: '#FFF7F9'
  primary-dark: '#E48BAB'
  primary-foreground-dark: '#2A0E1B'
  accent: '#B8791F'
  accent-foreground: '#201404'
  accent-dark: '#E9AE55'
  accent-foreground-dark: '#241703'
  # Unit status: load-bearing semantics, never decorative
  status-in-stock: '#2F6E4F'
  status-in-stock-dark: '#6FC49A'
  status-rented: '#2B5C8A'
  status-rented-dark: '#7FB5E4'
  status-overdue: '#B3261E'
  status-overdue-dark: '#F58C85'
  status-sold: '#6B5D54'
  status-sold-dark: '#B3A497'
  status-maintenance: '#8A5A1F'
  status-maintenance-dark: '#DDA55A'
  status-terminal: '#5E4A46'
  status-terminal-dark: '#A08A85'
  # Money semantics: three kinds, never two
  money-in: '#2F6E4F'
  money-in-dark: '#6FC49A'
  money-out: '#B3261E'
  money-out-dark: '#F58C85'
  money-held: '#5B4B8A'
  money-held-dark: '#A99BD8'
  money-reversed: '#9C8E83'
  money-reversed-dark: '#7C6E64'
  # System feedback
  waking: '#8A5A1F'
  waking-dark: '#DDA55A'
  success: '#2F6E4F'
  success-dark: '#6FC49A'
  danger: '#B3261E'
  danger-dark: '#F58C85'
  focus-ring: '#7B2D4E'
  focus-ring-dark: '#E48BAB'
typography:
  display:
    fontFamily: 'Bricolage Grotesque'
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.01em
    note: 'A variable grotesque, not a serif. Weight and tracking re-judged for Bricolage rather than carried over from the old Fraunces values — see Typography below.'
  heading:
    fontFamily: 'Instrument Sans'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  subheading:
    fontFamily: 'Instrument Sans'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: 'Instrument Sans'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: 'Instrument Sans'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  label:
    fontFamily: 'Instrument Sans'
    fontSize: 13px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.02em
  money:
    fontFamily: 'Instrument Sans'
    fontSize: 17px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0
    note: 'font-variant-numeric: tabular-nums lining-nums. Mandatory on every rupee figure without exception. One step above {typography.body} on purpose — see Typography below.'
  money-lg:
    fontFamily: 'Instrument Sans'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.1'
    note: 'Dashboard headline figures. tabular-nums.'
  money-sm:
    fontFamily: 'Instrument Sans'
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    note: 'Line-level figures inside carts, drills, receipts. tabular-nums.'
  counter:
    fontFamily: 'Instrument Sans'
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.02em
    note: 'The intake progress counter. tabular-nums so 8 of 12 does not shift to 9 of 12.'
  barcode:
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.3'
    letterSpacing: 0.02em
    note: 'font-variant-numeric: tabular-nums lining-nums. System mono stack, not a webfont.'
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  '12': 48px
  '16': 64px
  gutter-phone: 16px
  gutter-wide: 24px
  thumb-bar-height: 72px
  thumb-safe-bottom: 88px
  receipt-margin: 14mm
components:
  surface-flat:
    background: '{colors.surface-raised}'
    background-dark: '{colors.surface-raised-dark}'
    border: '1px solid {colors.border}'
    border-dark: '1px solid {colors.border-dark}'
    shadow: 'none'
    note: 'The default. Solid surface, real border, full contrast — no lowered-contrast trick anywhere. Most of the app is this.'
  surface-soft:
    background: '{colors.surface-raised}'
    background-dark: '{colors.surface-raised-dark}'
    border: '1px solid {colors.border}'
    border-dark: '1px solid {colors.border-dark}'
    radius: '{rounded.lg}'
    shadow: '0 2px 8px rgba(42,33,28,0.10), 0 1px 2px rgba(42,33,28,0.06)'
    shadow-dark: '0 2px 10px rgba(0,0,0,0.38), 0 1px 2px rgba(0,0,0,0.24)'
    note: 'Neumorphism''s softness without its same-colour-on-same-colour method — the real border is what keeps this legible once the shadow all but disappears in dark mode.'
  surface-glass:
    background: 'rgba(255,255,255,0.60)'
    background-dark: 'rgba(35,28,24,0.55)'
    backdrop-filter: 'blur(20px) saturate(160%)'
    border: '1px solid rgba(255,255,255,0.40)'
    border-dark: '1px solid rgba(244,237,229,0.10)'
    radius: '{rounded.lg}'
    shadow: '0 8px 28px rgba(42,33,28,0.20)'
    shadow-dark: '0 8px 28px rgba(0,0,0,0.50)'
    fallback-background: '{colors.surface-raised}'
    fallback-background-dark: '{colors.surface-raised-dark}'
    max-composited-layers: 1
    note: 'Only ever over a backdrop the design controls — a dimmed overlay, a live camera feed, or a defined gradient. Never over a scrolling list. Falls back to fallback-background (solid, no blur) when backdrop-filter is unsupported or prefers-reduced-transparency is set. See Elevation & Depth for the full binding rule and the performance cap.'
  scan-viewfinder:
    background: '{colors.surface-scan}'
    radius: '{rounded.lg}'
    aperture-border: '{colors.accent}'
    aperture-border-width: 2px
    foreground: '{colors.primary-foreground}'
    overlay-treatment: '{components.surface-glass}'
    note: 'The near-black ground is fixed and does not change with this system. overlay-treatment applies only to the floating chrome on top of the live feed — the aperture frame, the decode hint, the manual-entry link, Cancel — which needs to read as a layer above the video, not a second opaque frame fighting it.'
  scan-result-card:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink}'
    radius: '{rounded.lg}'
    border: '1px solid {colors.border}'
    barcode-type: '{typography.barcode}'
    treatment: '{components.surface-soft}'
  intake-counter:
    typography: '{typography.counter}'
    foreground: '{colors.primary}'
    track: '{colors.surface-sunken}'
    fill: '{colors.primary}'
    radius: '{rounded.full}'
  status-pill:
    radius: '{rounded.full}'
    typography: '{typography.label}'
    padding: '{spacing.1} {spacing.3}'
    note: 'Fill is the matching colors.status-* token at 14% alpha; text and 1px border are the token at full strength. Never brand colour.'
  money-figure:
    typography: '{typography.money}'
    foreground: '{colors.ink}'
    note: 'Sign-neutral by default. Only takings, expenses, deposits and reversals take a money-* colour.'
  deposit-figure:
    typography: '{typography.money}'
    foreground: '{colors.money-held}'
    note: 'Deposits held and rent held are both liabilities (AD-33). This token exists so neither can be mistaken for takings — the adjacent word (held/deposit/rent) tells them apart, the colour tells them apart from income.'
  thumb-action-bar:
    background: '{colors.surface-raised}'
    border-top: '1px solid {colors.border}'
    height: '{spacing.thumb-bar-height}'
    radius: '0'
    treatment: '{components.surface-soft}'
    note: 'Navigation chrome. The shallow upward shadow is surface-soft''s shadow, not a bespoke effect; the top border already satisfied surface-soft''s real-border requirement.'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    min-height: 52px
    typography: '{typography.subheading}'
  button-secondary:
    background: 'transparent'
    foreground: '{colors.primary}'
    border: '1px solid {colors.border-strong}'
    radius: '{rounded.md}'
    min-height: 52px
  button-danger:
    background: '{colors.danger}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    min-height: 52px
  waking-banner:
    background: '{colors.waking}'
    foreground: '#FFFFFF'
    radius: '{rounded.md}'
    typography: '{typography.body-sm}'
  cart-line:
    background: '{colors.surface-raised}'
    border-bottom: '1px solid {colors.border}'
    radius: '0'
    price-type: '{typography.money-sm}'
    treatment: '{components.surface-flat}'
    note: 'A rupee figure lives on every cart line. Flat, always — the retail cart is one of the three named FLAT surfaces.'
  dashboard-card:
    background: '{colors.surface-raised}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.5}'
    figure-type: '{typography.money-lg}'
    treatment: '{components.surface-soft}'
    note: 'A card, so SOFT — not GLASS. The dashboard''s page-level chrome is glass; every card sitting on it, including every card carrying a rupee figure, is soft.'
  drill-sheet:
    background: '{colors.surface-base}'
    radius: '{rounded.xl} {rounded.xl} 0 0'
    border-top: '1px solid {colors.border}'
    treatment: '{components.surface-glass}'
    row-treatment: '{components.surface-flat}'
    note: 'A modal sheet over a dimmed backdrop, so its shell — the panel background, the border, the blur — is GLASS. The paged rows inside it are ordinary flat list rows (row-treatment): a rupee figure never sits directly on the glass ground, only on the flat row beneath it.'
  money-bucket-row:
    layout: 'three-up from tablet, stacked on phone'
    gap: '{spacing.4}'
    note: 'EARNED, DEPOSITS HELD, RENT HELD (AD-33) — three independent {components.dashboard-card} instances, side by side, each SOFT. No fourth combined figure is ever rendered across them; the layout has structurally nowhere to put one.'
  receipt-sheet:
    background: '#FFFFFF'
    foreground: '#1A1A1A'
    border: 'none'
    radius: '0'
    margin: '{spacing.receipt-margin}'
    note: 'Always the light palette, on every theme and every channel. Ink on paper. Exempt from the surface treatment system entirely — see Elevation & Depth.'
  date-range-control:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink}'
    border: '1px solid {colors.border}'
    radius: '{rounded.full}'
    typography: '{typography.label}'
    active-background: '{colors.primary}'
    active-foreground: '{colors.primary-foreground}'
  customer-sheet:
    background: '{colors.surface-raised}'
    radius: '{rounded.xl} {rounded.xl} 0 0'
    border-top: '1px solid {colors.border}'
    field-radius: '{rounded.sm}'
    treatment: '{components.surface-glass}'
    note: 'A modal sheet over a dimmed backdrop. Carries no rupee figure — lookup and consent capture only — so nothing here conflicts with the no-money-on-glass rule.'
  size-run-chip:
    background: '{colors.accent}'
    foreground: '{colors.accent-foreground}'
    radius: '{rounded.full}'
    typography: '{typography.label}'
---

# IMPOC — Design Spine

> Visual identity. Behaviour, states, and flows live in `EXPERIENCE.md`, which references these tokens by name. Both spines win over any mock, wireframe, or import.
>
> Raviraj chose the direction — *warm retail*, light **and** dark following the device, phone-first with a wide dashboard — and has now reviewed the typography and colour block below. The hex values, type ramp, and radii are **decisions**, not drafts. The *rules* around them — status colour is semantic not decorative, money has three kinds not two, every rupee figure is tabular — remain load-bearing and come from the spec, not from taste.

## Brand & Style

IMPOC belongs to a clothing and imitation-jewellery shop, not to a warehouse. The surface is warm paper rather than cold grey; the corners are soft; the brand colour is a jewel tone. That is the whole of the decoration budget.

Everything else answers to a harder master. This is a tool held in one hand at a counter with a customer waiting, and the two things it must do at a glance are **tell you what state a physical thing is in** and **tell you what a number means**. So the palette splits in two and the split is absolute:

- **The brand half** — warm neutrals, the plum primary, the gold accent. Chrome, actions, identity.
- **The semantic half** — unit status colours and money-kind colours. These are *data*, not decoration. They are never used for a button, never used for chrome, and never chosen for how they look next to the brand.

A reader must never have to ask whether a colour is telling them something. If it is a status colour or a money colour, it is telling them something.

The dashboard is the shop's headline feature and gets the one moment of display type — `{typography.display}` on the owner's headline figures. Nowhere else.

**A third read: surface itself now carries meaning, not just colour and type.** As of this pass IMPOC has three named surface treatments — flat, soft, glass — and which one a screen gets is not a stylistic choice, it is part of the same "tell me what a number means" discipline the colour split already enforces. See *Elevation & Depth*.

## Colors

**Warm neutrals.** `{colors.surface-base}` is a warm off-white — paper, not screen. `{colors.surface-raised}` is pure white for cards and sheets that need to lift off it; `{colors.surface-sunken}` is the warmer step down used for progress tracks, disabled fields, and the wide dashboard's page ground. `{colors.ink}` is a warm near-black, never `#000`. The dark theme inverts to warm browns (`{colors.surface-base-dark}`), never to neutral grey — a cold dark theme would abandon the warm-retail direction the moment the sun went down.

**`{colors.surface-scan}` is its own surface.** The camera viewfinder sits in near-black chrome in both themes, because a bright frame around a live camera feed both hurts at arm's length and makes the video look washed. This is the one surface that does not flip with the theme; it only deepens.

**Primary — Garnet Plum (`{colors.primary}` / `{colors.primary-dark}`).** The jewel. Primary actions, the active nav item, the intake counter, focus rings. It is the shop's colour.

**Accent — Warm Gold (`{colors.accent}` / `{colors.accent-dark}`).** Used for exactly two things: the viewfinder aperture that shows where to hold the barcode, and the size-run chip that shows which size the next scan will take. Both mean *"this is what the system is about to do."* Gold is never a state, never a button, never a heading.

**Unit status — six tokens, and they are the vocabulary.** `unit-state-machine.md` is the spine of the whole system, so its states get colour and staff learn them once:

| Token | States it carries | Reads as |
|---|---|---|
| `{colors.status-in-stock}` | `in_stock` | On the floor, sellable, bookable |
| `{colors.status-rented}` | `rented`, booking `handed_over` | Out of the shop, coming back |
| `{colors.status-overdue}` | `rented` past its due date (derived) | Wrong — deal with this |
| `{colors.status-sold}` | `sold`, booking `settled` | Done, closed, gone |
| `{colors.status-maintenance}` | `in_maintenance` | In the workshop |
| `{colors.status-terminal}` | `damaged`, `lost`, `retired` | Off the books, in shrinkage |

Overdue is the only status that shares a hue with `danger`, and that is deliberate: overdue *is* the alarm state of this product. Nothing else on a status pill is allowed to be red.

**Money — three kinds, and this is the most important rule in this file.** The spec is emphatic that a deposit held is *not* revenue (CAP-22, Q6). A palette with only "in" and "out" would force deposits into one of them and the mistake would be invisible.

- `{colors.money-in}` — takings, rent charged, damage charges collected, forfeited deposits. Income.
- `{colors.money-out}` — expenses, stock purchases, deposit returns, cash refunded on a cheaper exchange. Money leaving.
- `{colors.money-held}` — **both** liability buckets against `open` and `handed_over` bookings: deposits held, and rent held (AD-33). **The shop's cash, not the shop's money.** Violet, deliberately unlike both other tokens. The two buckets share a colour because they share a nature — money collected but not yet earned — and are told apart on screen by the word next to the figure (*deposit* vs *rent*), never by a colour split the accessibility floor would forbid resting a distinction on anyway.
- `{colors.money-reversed}` — reversing rows and reversed originals. Muted, struck through, present and visibly cancelled. A reversal is never simply hidden; the ledger is additive and the screen says so.

Plain figures — a selling price, a floor price, a line total — carry no money colour at all. They are `{colors.ink}`. Colour on a number means the number is *counted somewhere*.

**Avoid:** a second brand colour; status colours borrowed for buttons; brand colours borrowed for status; green for "save" and red for "cancel" as generic button chrome (green and red are spoken for); any gradient.

**Contrast target: WCAG AA, 4.5:1 for body and money text, 3:1 for large/display text (18px+ or 14px+ bold), checked against every surface a token can actually sit on.** For `{colors.status-*}`, `{colors.money-*}` and every ink token this means checked against both `{colors.surface-raised}` and `{colors.surface-raised-dark}` at minimum. For anything rendered on `{components.surface-glass}` it means checked against the *specific* backdrop that glass panel sits over — see *Elevation & Depth* — because a glass panel's effective background is not its token value alone.

## Typography

**Instrument Sans** carries everything functional — body, labels, and every rupee figure. **Bricolage Grotesque** appears only as `{typography.display}`, and only on the dashboard's headline figures and section titles. A system mono stack appears only on barcode values, where a mis-set `0`/`O` or `1`/`l` costs a scan.

This replaces the original Fraunces/Figtree pairing. Both new faces are free on Google Fonts. The reasoning: Bricolage reads modern rather than pretty, where Fraunces — a warm, bookish serif — was pulling IMPOC toward the same warm-cream-plus-serif look every second boutique brand reaches for. Instrument Sans has clean, even numerals, which matters more than it sounds in a product where digits are compared down a column all day. Together the pairing keeps the warm-retail identity (the colour system, the soft corners) without the genericness the old serif was adding to it.

**Bricolage is a variable grotesque, not a serif, and the display role was re-judged rather than carried over.** Fraunces' `-0.015em` tracking and `600` weight were tuned to tame a serif's wider default spacing and to give it enough presence against body text — corrections a grotesque doesn't need in the same way. `{typography.display}` now sets `700` weight and `-0.01em` tracking: less negative tracking, because Bricolage's default forms already sit close; heavier weight, because a sans at `600` reads thinner and closer to body chrome than the display moment this app spends on exactly one thing — the owner's headline figures — deserves.

**Tabular numerals are not a preference.** `{typography.money}`, `{typography.money-lg}`, `{typography.money-sm}`, `{typography.counter}` and `{typography.barcode}` all set `font-variant-numeric: tabular-nums lining-nums`. Money in this product is compared down a column — a cart, a drill-down, a receipt, a vendor's trips — and proportional digits make columns lie. The intake counter is tabular for a different reason: `8 of 12` must not jump sideways when it becomes `9 of 12` while someone is watching it. Barcode digits are tabular for the same reason as money: a scanned value is read digit by digit, and a font that lets `1` and `l` or `0` and `O` drift into ambiguity costs a rescan.

**The type scale has three changes this pass.** `{typography.money}` moves from 16px to 17px — this is the figure staff misread most, because at 16px it sat exactly level with `{typography.body}` beside it and only its weight told the two apart. One step up gives it a size difference too, so a rupee figure is never mistaken for the sentence next to it purely because someone is reading fast. The 12px `caption` role is deleted outright; `{typography.label}` at 13px is now the true floor for every role in the system, not just the nominal one — 12px is not trustworthy read on a phone screen in daylight at a shop counter, so nothing in IMPOC sets type that small any more. And barcode values move onto a dedicated monospace role at 14px, on a system mono stack (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`) rather than a bundled webfont — one fewer network request at the counter, and every system mono already disambiguates `0`/`O` and `1`/`l` on its own.

The type ramp is generous by tool standards. `{typography.body}` is 16px on the phone and does not shrink; `{typography.label}` at 13px is the floor. This is a warm-retail surface read quickly at arm's length, not a dense admin console.

`[NOTE FOR BUILD]` The app is online-only, so loading both faces from the Google Fonts CDN would work. But the counter is often on a slow shop connection, and self-hosting both variable fonts in the Vite build (`@fontsource` or local `.woff2` + `@font-face`) removes a render-blocking third-party request from the one moment — first paint at the till — where it costs the most. Not decided here; raised for the first frontend epic.

## Layout & Spacing

Two design centres, one app.

**Phone (the operating surface — inventory, POS, rental, expenses).** Single column at `{spacing.gutter-phone}`. Nothing important above the fold that needs a reach: the primary action of every operating screen lives in a fixed `{components.thumb-action-bar}` at the bottom, `{spacing.thumb-bar-height}` tall, and scrollable content reserves `{spacing.thumb-safe-bottom}` beneath it. Primary buttons are 52px minimum — a thumb, at a counter, possibly holding something else.

**Wide (the dashboard reading surface — tablet and laptop).** From 900px the dashboard becomes a card grid at `{spacing.gutter-wide}`, two columns on tablet and three on laptop, on `{colors.surface-sunken}` ground so the white cards lift. Maximum content width 1400px. The dashboard remains reachable and correct on a phone — one column, cards stacked — but it is not optimised there and the spine says so plainly.

Every other section stays single-column at every width, centred at 640px maximum. Widening a scan loop or a cart buys nothing.

**Breakpoints:** `phone` < 600px · `tablet` 600–1023px · `wide` ≥ 1024px. Only the dashboard and the top-level navigation change shape across them.

## Elevation & Depth

### Three surfaces, and the assignment is not a stylistic choice

IMPOC has exactly three named surface treatments — `{components.surface-flat}`, `{components.surface-soft}`, `{components.surface-glass}` — each specified for both light and dark. Every surface in the IA gets exactly one of them, and which one is a rule a builder follows, not a choice a builder makes per screen.

- **FLAT** (`{components.surface-flat}`) — solid surface, real border, full contrast. The ground state. Most of the app is this.
- **SOFT** (`{components.surface-soft}`) — a gentle shadow and a rounded card, but always with a real border too. This is neumorphism's softness without neumorphism's method: classic neumorphic shading works by making a surface barely differ from its own background in colour, relying on light/shadow alone to read as raised — and that barely functions in dark mode, where ambient light direction is a fiction anyway. `{components.surface-soft}` keeps a real 1px border under the shadow specifically so it stays legible when the shadow all but vanishes on a dark ground.
- **GLASS** (`{components.surface-glass}`) — translucent fill, `backdrop-filter: blur() saturate()`, a light edge, a drop shadow. The one treatment that borrows its legibility from whatever is *behind* it rather than owning its own contrast outright.

**Why this needs a rule and not taste:** GLASS and SOFT both work by *lowering* contrast between a surface and its content or its background — that is the entire visual trick, softness and depth bought at the price of crispness. IMPOC's job is getting a rupee figure read correctly at a counter, in daylight, on a mid-range phone. A soft-edged *Take payment* button whose only separation from its background is a shadow disappears in shop sunlight the same way a low-contrast glass panel does. So the rule below is not a preference; it is the same logic that already put unit-status colour and money colour under a hard "never decorative" rule in *Colors*, applied to surface.

### The binding rule

| Surface / component | Treatment | Why |
|---|---|---|
| **Dashboard** — the page shell: chrome, header, date-range bar ground | GLASS | The one screen this app treats as a reading surface rather than a decision surface (see EXPERIENCE.md Foundation). It is read on a tablet or laptop, not thumbed at a counter mid-sale. |
| Dashboard card, money bucket row (`{components.dashboard-card}`, `{components.money-bucket-row}`) | SOFT | Cards, so SOFT — not GLASS, even though they sit on the dashboard. Every rupee figure on the dashboard lives on one of these, never directly on the glass shell. |
| **Scanner overlay** — the aperture frame, decode hint, manual-entry link, Cancel, floating over `{components.scan-viewfinder}`'s live feed | GLASS | Sits over a backdrop the design fully controls (the camera feed inside a fixed near-black frame) and needs to read as a layer above moving video, not a second opaque box competing with it. |
| **Modal sheets over a dimmed backdrop** — `{components.customer-sheet}`, the shell of `{components.drill-sheet}` | GLASS | The dimmed backdrop behind a sheet is exactly the kind of design-controlled ground GLASS needs. |
| Drill sheet's row list (inside the glass shell) | FLAT | The rows carry rupee figures — see *Accessibility Floor* in EXPERIENCE.md: no rupee figure sits directly on glass. The shell is glass; what a figure actually sits on, one layer in, is flat. |
| Cards generally (trip detail's variance strip, unit detail, `{components.scan-result-card}`) | SOFT | "Cards" is the general case the binding rule names. |
| Navigation chrome — `{components.thumb-action-bar}`, bottom tab bar, left rail | SOFT | "Navigation chrome" is the general case the binding rule names. |
| **Retail cart** (`{components.cart-line}`) | FLAT | Named explicitly. A running total is being built, scan by scan, at the counter. |
| **Price & checkout** | FLAT | Named explicitly. This is where a rupee figure is decided and confirmed — the single highest-stakes screen in the product. |
| Booking money block, hand-over, Return & settle, Extension panel, Exchange | FLAT | Anywhere a rupee figure is being decided or confirmed, per the binding rule — not just Price & checkout. |
| **Every refusal and warning state**, anywhere in the app | FLAT | Named explicitly. A refusal on a glass or soft surface would inherit that surface's lowered contrast at the exact moment full contrast matters most; a refusal always renders on its own flat ground regardless of what it interrupts. |
| Everything else — trips, units, lots, picklists, vendors, expenses, customers, settings, forms, lists | FLAT | The unnamed default. This is the "almost flat" posture the earlier draft of this file already had; SOFT and GLASS are the two deliberate exceptions carved out of it, not a new baseline. |
| `{components.receipt-sheet}` | **Exempt** | Not part of this system at all. A5 black on white in every theme and every channel — see *Shapes* and `EXPERIENCE.md → Receipt Contract`. |

Reading the table as a whole: FLAT is still the ground state everywhere money is on the line, exactly as the original "almost flat" posture intended. SOFT lifts cards and chrome without touching contrast. GLASS is deliberately rare — three contexts, each one over a backdrop the design owns outright (a dimmed scrim, a camera feed, the dashboard's own defined ground) — never over content whose contrast the app can't guarantee.

### Consequences

- **No rupee figure, refusal, or status warning ever sits directly on a glass surface.** Where a glass-shelled surface must show one — the drill sheet is the only case that arises — the figure sits on a flat inner row, never on the glass ground itself.
- **Glass is only permitted over a backdrop the design controls.** A dimmed overlay, a live camera feed inside its fixed frame, or a defined gradient — never a scrolling list, because contrast then depends on whatever content happens to be scrolled underneath at that instant.
- **Every glass panel is checked for contrast against its own controlled backdrop, measured, not assumed** — see the contrast target in *Colors*. "It's translucent so it's probably fine" is not a check.

### Performance — `[NOTE FOR BUILD]`

`backdrop-filter` is GPU-expensive, and the staff phones this app runs on are not flagships. For the first frontend epic:

- **Cap composited glass layers at one visible at a time.** Nothing in this app's IA nests one glass panel inside another, so this should never bind in practice — but it is the ceiling, not a target to reach for.
- **Specify a solid-fill fallback.** Every `{components.surface-glass}` instance has `fallback-background` / `fallback-background-dark` tokens. Use them when `backdrop-filter` is unsupported and behind an explicit `@media (prefers-reduced-transparency: reduce)` query — the fallback is a flat fill at the same colour family, not a broken transparent panel.
- **`{components.receipt-sheet}` is exempt from all of this**, same as it is exempt from the treatment system generally: A5 black on white, every theme, every channel, no blur, ever.

No elevation is used to signal hierarchy. If two things differ in importance, that is type and colour's job — surface treatment answers a different question (what kind of layer is this), not how important it is.

## Shapes

Soft, because warm retail. `{rounded.sm}` on inputs and chips, `{rounded.md}` on buttons and cart lines, `{rounded.lg}` on cards and the viewfinder, `{rounded.xl}` on the drill sheet's top corners. `{rounded.full}` on status pills and the size-run chip only — a pill shape in this product means *"this is a state or a mode,"* never *"this is a button."*

The receipt is the one square-cornered surface (`{components.receipt-sheet}`). It is a document.

## Components

- **`{components.surface-flat}` / `{components.surface-soft}` / `{components.surface-glass}`** — the three surface treatments. See *Elevation & Depth* for the token values and the binding rule that assigns them.
- **`{components.scan-viewfinder}`** — near-black ground filling the upper two-thirds of the phone screen, with a gold aperture rectangle at 35mm×8mm proportions so staff learn where to hold the label. Live only while armed; see `EXPERIENCE.md → The Scan Primitive`. The near-black ground itself is fixed and outside the surface treatment system; the aperture frame and hint chrome floating over the live feed are `{components.surface-glass}`.
- **`{components.scan-result-card}`** — replaces the viewfinder the instant a barcode decodes. Barcode value in `{typography.barcode}`, then whatever the context knows about it. `{components.surface-soft}` — a card, so it lifts with a shadow, not a border alone.
- **`{components.intake-counter}`** — `8 of 12` in `{typography.counter}`, plum, above a full-width progress track. It is the largest thing on the intake screen because it is the question staff are actually asking.
- **`{components.status-pill}`** — the status token at 14% alpha behind the token at full strength, with a matching 1px border. Carries text always; colour alone never conveys status (see `EXPERIENCE.md → Accessibility Floor`).
- **`{components.money-figure}` / `{components.deposit-figure}`** — the same shape, different foreground token. The second exists so a deposit is structurally incapable of rendering as takings.
- **`{components.waking-banner}`** — amber strip for AD-19.1's cold start. Amber, not red: waking is expected, not broken.
- **`{components.dashboard-card}`** — one AD-14 question. Title, headline figure in `{typography.money-lg}` or `{typography.display}`, a one-line qualifier, and a drill affordance. Never more than one figure per card. `{components.surface-soft}`, even on the glass dashboard shell — see *Elevation & Depth*.
- **`{components.money-bucket-row}`** — three `{components.dashboard-card}` instances placed edge to edge (EARNED, DEPOSITS HELD, RENT HELD), never merged into a wider card and never given a shared border that would read as one figure. The gap between them is the point: it is the visual promise that nothing here is summed (AD-33).
- **`{components.receipt-sheet}`** — A5 portrait, black on white, in every theme and every channel. See `EXPERIENCE.md → Receipt Contract`. Exempt from the surface treatment system.
- **`{components.date-range-control}`** — a segmented pill of presets with the active segment filled in `{colors.primary}`. One per dashboard page; it governs every range card on it.
- **`{components.customer-sheet}`** — a bottom sheet on phone, a centred dialog from `tablet`. Same corner treatment as `{components.drill-sheet}` so *"a layer over what you were doing"* reads consistently. `{components.surface-glass}` — a modal sheet over a dimmed backdrop, carrying no rupee figure.
- **`{components.drill-sheet}`** — `{components.surface-glass}` shell; the paged rows inside it are `{components.surface-flat}`, because those rows carry rupee figures and no rupee figure sits directly on glass. See *Elevation & Depth*.
- **`{components.size-run-chip}`** — gold pill showing the size the next scan will take in CAP-9 mode. The only other gold thing on screen.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Reserve `{colors.status-*}` for unit and booking state, always with a text label | Use a status colour on a button, a heading, or chrome |
| Give deposits and rent held `{colors.money-held}` wherever they appear | Let either render in `{colors.money-in}` — neither is revenue until its booking closes (AD-33) |
| Show EARNED, DEPOSITS HELD and RENT HELD as three separate `{components.dashboard-card}` figures | Sum any two of the three into a fourth figure, anywhere on screen |
| Set every rupee figure in a `{typography.money*}` role with tabular numerals | Set money in `{typography.body}` because it happens to be in a sentence |
| Keep the viewfinder on `{colors.surface-scan}` in both themes | Put a live camera feed on a light surface |
| Show reversed rows muted and struck through, still present | Hide a reversed row — the ledger is additive and the screen must say so |
| Put the primary action in `{components.thumb-action-bar}` on every operating screen | Place a primary action at the top of a phone screen |
| Warm browns in the dark theme | Neutral or cool greys in the dark theme |
| Use `{colors.accent}` for the scan aperture and the size-run chip, and nothing else | Use gold as a general highlight, hover, or heading colour |
| Let the dashboard be wide | Let a cart, a scan loop, or a form be wide |
| Render the cart, Price & checkout, and every refusal/warning state on `{components.surface-flat}` | Put a rupee figure being decided or confirmed on `{components.surface-soft}` or `{components.surface-glass}` |
| Use `{components.surface-glass}` only over a backdrop this design controls — the dashboard shell, the scanner overlay, a dimmed modal backdrop | Use glass over a scrolling list, or nest a glass panel inside another |
| Give every `{components.surface-glass}` instance a solid-fill fallback for `prefers-reduced-transparency` and unsupported `backdrop-filter` | Ship a glass panel with no fallback |
| Set barcode digits in `{typography.barcode}` on the system mono stack, tabular | Set a rupee figure or a barcode value below 13px |
