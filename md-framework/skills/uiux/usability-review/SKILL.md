---
name: usability-review
version: 1.0.0
description: |
  Evaluate an interface against usability heuristics and task efficiency, and
  report findings by severity. Use when auditing an existing screen, when users
  report friction, before a release, or when asked "is this usable". Expert
  evaluation — complements, but does not replace, testing with real users.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Usability Review

A structured expert walkthrough. It finds a large share of problems cheaply, and
it is not a substitute for watching a real user — it predicts difficulty rather
than observing it.

### Method

1. **Define the tasks.** Review against real tasks, not screens in isolation:
   "complete a sale with a discount", "find why stock is negative".
2. **Walk each task twice** — once as a first-time user, once as an expert who
   does it fifty times a day. These surface different problems, and in retail the
   expert pass matters more.
3. **Apply the heuristics** to what you find.
4. **Record findings with severity**, location, and a suggested direction.

### The heuristics, with retail application

**1. Visibility of system status**
Does the operator know what happened? A scan must give immediate feedback; a
completing sale must show progress; a queued offline sale must be visibly
pending, with its age.

**2. Match between system and the real world**
Use shop language — "void", "refund", "stock take", not "transaction reversal
entity". Sequence flows the way the work actually happens.

**3. User control and freedom**
Can a mis-scan be undone easily? Is there an obvious exit from every state? Can
an in-progress sale be held rather than abandoned?

**4. Consistency and standards**
Same action, same place, same name everywhere. **In a POS this outranks
improvement** — conditioned operators act from muscle memory, so moving a
familiar control is a regression until retraining happens.

**5. Error prevention**
Prefer designing the error out over catching it: cap discount inputs, disable Pay
until a method is selected, separate destructive controls from frequent ones.
Confirm only what is destructive or financial.

**6. Recognition rather than recall**
Show recent items, remember filters, display the product name on a line rather
than only a SKU. An operator should not have to remember a code.

**7. Flexibility and efficiency of use**
Is there a fast path for experts — keyboard shortcuts, scan-and-go, quick-pick
tiles — alongside the discoverable path for new staff?

**8. Aesthetic and minimalist design**
Every element competes for attention. Dashboards past ~9 metrics measurably lose
engagement; tables with a button in every row become unreadable.

**9. Help users recognise, diagnose, and recover from errors**
"Not enough stock — 2 available, 5 requested" beats "Error 409". Say what to do
next.

**10. Help and documentation**
Inline where it is needed, not in a manual nobody opens.

### Measure task efficiency

The most objective part of this review.

| Task | Ideal | Actual | Gap |
|---|---|---|---|
| Scan and add an item | 1 action | 1 | — |
| Complete a cash sale | 3 | 5 | 2 extra confirmations |
| Apply a line discount | 3 | 7 | buried in a submenu |
| Find a product without a barcode | 2 | 6 | search is 3 taps away |

**Count interactions for the frequent tasks.** On a till, two extra taps per sale
is thousands of taps a month and measurable queue time. This converts a vague
"it feels slow" into an actionable number.

### Severity

| Level | Meaning |
|---|---|
| `CRITICAL` | Prevents task completion, or causes financial error |
| `HIGH` | Major friction or frequent errors; no workaround |
| `MEDIUM` | Noticeable friction; workaround exists |
| `LOW` | Minor irritation |

Weight by **frequency × cost**. A small friction on the scan loop outranks a
large friction in an annual report.

### Reporting

```
SEVERITY   HIGH
HEURISTIC  #7 Flexibility and efficiency of use
TASK       Apply a line discount
FINDING    Requires 7 interactions; the discount control is in an overflow menu
IMPACT     Used ~40×/day per till; staff bypass it by editing the price directly,
           which leaves no audit trail for the discount
FIX        Surface a discount control on the line row; keep the override reason
           prompt
```

The impact line matters most — **note where friction causes a workaround**, since
workarounds around audited actions are a control failure, not just a usability
problem.

### Limits of this method

Expert review predicts problems; it does not observe them. It systematically
misses:

- What users actually misunderstand about the domain
- Environmental factors — noise, interruption, queue pressure
- How real staff have adapted or worked around the system

Where the stakes justify it, watch a real operator for one shift. That single
observation typically outperforms any number of heuristic passes — see
`ux-research`.

### Checklist

- [ ] Real tasks defined, not screens
- [ ] Walked as both novice and expert
- [ ] All ten heuristics applied
- [ ] Interaction counts measured for frequent tasks
- [ ] Consistency checked against existing screens and muscle memory
- [ ] Error prevention favoured over confirmation
- [ ] Fast paths verified for expert users
- [ ] Findings weighted by frequency × cost
- [ ] Workarounds identified, especially around audited actions
- [ ] Each finding names heuristic, task, impact, and direction
- [ ] Method limits acknowledged; user observation recommended where warranted

## References

- **Nielsen Norman Group — 10 Usability Heuristics for User Interface Design**
  <https://www.nngroup.com/articles/ten-usability-heuristics/>
- **Nielsen Norman Group — How to Conduct a Heuristic Evaluation** — method and
  severity rating <https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/>
- **Agente Studio / Creative Navy — POS design principles** — consistency,
  operator conditioning, and confirming only where critical
  <https://agentestudio.com/blog/design-principles-pos-interface>
- **Improvado — dashboard design guide** — the metric-count and overload findings
  behind heuristic 8 <https://improvado.io/blog/dashboard-design-guide>

**Not sourced — written for this framework:** the retail application of each
heuristic, the interaction-count table, the frequency × cost weighting, and the
workaround-as-control-failure observation.
