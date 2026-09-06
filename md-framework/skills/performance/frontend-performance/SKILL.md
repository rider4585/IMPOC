---
name: frontend-performance
version: 1.0.0
description: |
  Measure and improve client-side performance — Core Web Vitals, render cost,
  list virtualisation, and asset loading. Shared by frontend and performance
  agents. Use when a screen feels slow, before releasing UI changes to the till,
  or when asked "why is this sluggish".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Frontend Performance

Measure first. Frontend performance work done from intuition usually optimises
something that was never the bottleneck.

### The metrics that matter

| Metric | Measures | Good | Retail relevance |
|---|---|---|---|
| **LCP** | Largest content painted | < 2.5 s | Till must be usable fast after load |
| **INP** | Responsiveness to interaction | < 200 ms | **Scan-to-line-added is the critical one** |
| **CLS** | Layout shift | < 0.1 | A shifting total is a mis-tap risk |
| **TTFB** | Server response | < 800 ms | Backend, see `api-latency` |

**INP is the metric to care about most here.** A till is an interaction loop —
scan, scan, scan, pay. Load time happens once per shift; interaction latency
happens hundreds of times.

### Measure

```bash
npx lighthouse http://localhost:5173 --view --preset=desktop
```

In DevTools: **Performance** panel to record an interaction (not just load), and
the **React Profiler** to see which components re-render and how long they take.

```js
// Real interaction timing in the app
performance.mark('scan-start');
// … handle scan …
performance.mark('scan-end');
performance.measure('scan', 'scan-start', 'scan-end');
```

**Measure on the real device.** A till terminal is often far slower than a
development laptop; throttle CPU to 4× in DevTools as a minimum proxy.

### The usual causes, in order

**1. Too much JavaScript.** The largest single lever. See `bundle-analysis`.

**2. Unnecessary re-renders.** Profile before assuming.

```bash
grep -rnA3 "Provider value=\{\{" src/ --include=*.jsx     # unmemoised context
grep -rn "useState" src/ --include=*.jsx | awk -F: '{print $1}' | uniq -c | sort -rn | head
```

Common fixes: memoise context values, split contexts by change frequency, move
state down to where it is used, and lift expensive computation out of render.
Do **not** scatter `useMemo`/`useCallback` speculatively — see `react`.

**3. Long lists rendered in full.** A product grid with 5,000 items creates 5,000
components.

- Paginate server-side (preferred — less data over shop wifi)
- Virtualise when a long list genuinely must be scrollable
- Never render more rows than the viewport plus a small buffer

**4. Expensive work on every keystroke.** Debounce search input; do the filtering
server-side where the dataset is large.

**5. Layout shift.** Reserve space for images and skeletons; set `width`/`height`
or `aspect-ratio` — see `loading-states`.

**6. Blocking assets.** Self-hosted fonts with `font-display: swap`, no
render-blocking third-party scripts, images sized for their display size.

### Retail-specific

- **Scan-to-line-added under 100 ms.** This is the interaction that defines
  whether the system feels usable. Measure it explicitly and treat regression as
  a defect.
- **The till must stay responsive while background data loads.** A summary panel
  fetching must never block scanning — see `loading-states`.
- **Shop wifi is slow.** Test throttled; every kilobyte matters more than on a
  desk.
- **Long shifts.** Check for memory growth over hours — a till left open all day
  should not degrade. Take heap snapshots at intervals.

### Verify the fix

Re-measure the same way. Record before and after numbers in the change. An
optimisation without a measured improvement is speculation, and adds complexity
for nothing.

### Checklist

- [ ] Measured before changing anything
- [ ] INP measured on the scan interaction specifically
- [ ] Tested on real hardware or with CPU throttling
- [ ] Tested on a throttled network
- [ ] Bundle size reviewed
- [ ] Re-renders profiled, not guessed
- [ ] Context values memoised; contexts split by change frequency
- [ ] Long lists paginated or virtualised
- [ ] Input handlers debounced where they trigger work
- [ ] Space reserved for images and skeletons
- [ ] Fonts self-hosted with `font-display: swap`
- [ ] Till stays interactive during background loads
- [ ] Memory growth checked over a long session
- [ ] Before/after numbers recorded

## References

- **web.dev — Core Web Vitals (LCP, INP, CLS)**
  <https://web.dev/articles/vitals>
- **web.dev — Optimize INP** <https://web.dev/articles/optimize-inp>
- **Chrome DevTools documentation — Performance panel and CPU throttling**
  <https://developer.chrome.com/docs/devtools/performance>
- **React documentation — Profiler / `<Profiler>`**
  <https://react.dev/reference/react/Profiler>
- **MDN — Performance API (`mark`, `measure`)**
  <https://developer.mozilla.org/en-US/docs/Web/API/Performance>

**Not sourced — written for this framework:** the retail metric relevance column,
the scan-to-line-added budget, the shop-wifi and long-shift considerations, and
the detection commands.
