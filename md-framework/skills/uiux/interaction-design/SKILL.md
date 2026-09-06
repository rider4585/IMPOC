---
name: interaction-design
version: 1.0.0
description: |
  Design how the interface responds — affordances, feedback, timing, state
  transitions, undo, and destructive-action handling. Use when designing a
  control or interaction, when users are unsure whether something worked, or when
  asked "what should happen when they tap this".
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
---

## Interaction Design

The moment-to-moment behaviour of an interface: what invites action, what happens
when it is taken, and how the user knows.

### Affordance — it should look like what it does

A control's appearance must signal its behaviour. Buttons look pressable; links
look followable; disabled controls look unavailable and say why.

The most common failure is a control that acts on tap but does not look
interactive — a table row, an icon, a status badge. If it does something, it must
look like it does something, and it must be a real interactive element (see
`accessibility`).

Disabled states need an explanation. A greyed-out Pay button with no reason is a
dead end; "Select a payment method" is a next step.

### Feedback is mandatory

Every action gets a response. The user must never wonder whether it registered —
uncertainty is what causes double taps, double payments, and re-scans.

| Delay | Response |
|---|---|
| < 100 ms | Feels instant — no indicator needed, but still show the result |
| 100 ms – 1 s | Immediate visual acknowledgment (press state), then the result |
| 1 – 10 s | Progress indicator; disable the control |
| > 10 s | Move it to the background; tell them when it is done |

**Press feedback on every control is non-negotiable on a touch terminal.** On a
laggy screen, the operator's only evidence that the tap landed is the button
changing state.

Match the feedback to the significance: a scan adding a line needs a subtle
visual and possibly a sound; completing a sale needs a clear, unmissable
confirmation.

### Timing

- **Under 100 ms** for the scan-to-line loop — this is the interaction that
  defines whether the system feels usable
- **Delay spinners ~200 ms** so fast responses do not flash, and keep them
  visible ~300 ms once shown — see `loading-states`
- **Animation 150–300 ms.** Faster is invisible; slower is in the way. Respect
  `prefers-reduced-motion`
- **Never animate the frequent path.** A 200 ms transition on every scan is 200 ms
  of waiting, hundreds of times a shift

### Destructive actions

Ranked by preference:

1. **Undo** — perform it immediately, offer a brief window to reverse. Fastest
   and least interrupting.
2. **Confirmation** — for actions that cannot be undone or that move money.
   State what will happen, in specifics: "Void sale #1041 for ₹63.68?"
3. **Type-to-confirm** — reserve for genuinely irreversible bulk operations.

**Confirm sparingly.** Operators who dismiss five dialogs a day stop reading the
sixth — which is the one that mattered. Confirm the destructive and financial;
never the routine.

**Place destructive controls away from frequent ones.** "Remove line" adjacent to
"Pay" is a design defect regardless of confirmation, because the confirmation
itself gets dismissed reflexively.

### Undo over confirm, where the action is reversible

```
Line removed.  [Undo]
```

An undo affordance shown for a few seconds after the action is faster than a
prompt before it, and it does not interrupt the flow. Use it for removing lines,
clearing filters, and archiving. It is not appropriate once money has moved.

### State transitions should be visible

When something changes, show the change rather than replacing the screen:

- A newly added line briefly highlights, then settles
- A saved value shows a moment of confirmation, then returns to normal
- Content that arrives should not shift what is already there — reserve the space

### Input behaviour

- **Focus lands where work continues.** On a till, focus returns to the scan
  field after every action. A scanner firing into an unfocused field loses the
  input.
- **Enter submits** the obvious action; **Escape** cancels.
- **Debounce searching**, but not typing — the field must never feel laggy.
- **Guard against double activation** on anything that moves money, in the UI
  *and* server-side with an idempotency key (see `forms`).

### Errors interrupt, information does not

| Severity | Treatment |
|---|---|
| Blocking error | Inline, at the point of failure, with what to do |
| Failure needing attention | Toast or banner, persists until dismissed |
| Success | Brief, auto-dismissing |
| Background info | Passive, no interruption |

Never use a modal for information. Never let a critical error auto-dismiss before
it can be read.

### Retail specifics

- **Scan feedback within 100 ms**, with a distinct signal for "not found" — a
  failed scan must be unmistakable in a noisy shop
- **Hold and resume** for interrupted sales
- **Payment is the one place to slow down**: clear confirmation of amount and
  method before committing
- **Never optimistically show a completed sale.** Showing success that then fails
  is worse than a brief wait — see `loading-states`
- **Offline must be visible** and honest about what still works

### Checklist

- [ ] Every interactive element looks interactive and is a real control
- [ ] Disabled states explain why
- [ ] Every action produces immediate feedback
- [ ] Press feedback present on all touch controls
- [ ] Response timing matched to delay bands
- [ ] Scan-to-line under 100 ms
- [ ] Spinners delayed and held to a minimum duration
- [ ] Animations 150–300 ms; none on the frequent path; reduced-motion respected
- [ ] Undo preferred over confirmation where reversible
- [ ] Confirmations reserved for destructive and financial actions
- [ ] Confirmations state specifics, not generics
- [ ] Destructive controls separated from frequent ones
- [ ] Focus returns to the scan field after every action
- [ ] Double activation guarded in UI and server-side
- [ ] Errors inline and persistent; success brief; no modal for information
- [ ] Failed scans unmistakable
- [ ] No optimistic success on payment

## References

- **Nielsen Norman Group — Response Times: The 3 Important Limits** — the 0.1 s
  / 1 s / 10 s bands
  <https://www.nngroup.com/articles/response-times-3-important-limits/>
- **Nielsen Norman Group — Visibility of System Status; Confirmation Dialogs**
  <https://www.nngroup.com/articles/ten-usability-heuristics/>
- **Material Design 3 — Motion durations and easing**
  <https://m3.material.io/styles/motion/overview>
- **MDN — `prefers-reduced-motion`**
  <https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion>
- **Agente Studio — POS design principles** — press feedback on touch, and
  confirming only where critical
  <https://agentestudio.com/blog/design-principles-pos-interface>

**Not sourced — written for this framework:** the undo-over-confirm ranking, the
never-animate-the-frequent-path rule, the focus-returns-to-scan-field rule, the
error-treatment table, and the retail specifics.
