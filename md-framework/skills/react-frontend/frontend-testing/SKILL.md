---
name: frontend-testing
version: 1.0.0
description: |
  Test React components with Vitest and Testing Library — queries that reflect
  real usage, user interaction, async assertions, API mocking, and what not to
  test. Use when adding component tests, when tests break on every refactor, or
  when asked "how do I test this component".
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Frontend Testing

Documents **Vitest** with **React Testing Library**. The guiding principle is
Testing Library's own: *the more your tests resemble the way your software is
used, the more confidence they give you.*

Test what the user experiences. A test asserting internal state breaks on every
refactor and catches nothing a user would notice.

### Query by what the user perceives

Priority order — use the highest that applies:

| Priority | Query | Why |
|---|---|---|
| 1 | `getByRole('button', { name: /complete sale/i })` | How assistive tech and users find it |
| 2 | `getByLabelText('Quantity')` | Form fields as users identify them |
| 3 | `getByText(/no sales yet/i)` | Visible content |
| 4 | `getByTestId('sale-row')` | Last resort — invisible to users |

```jsx
// ❌ couples to markup; a div→button change breaks it, and it tests nothing real
container.querySelector('.btn-primary');

// ✅ fails if the control stops being reachable — which is the point
screen.getByRole('button', { name: /complete sale/i });
```

Using role queries has a useful side effect: **an element you cannot query by
role is usually an accessibility defect.** A clickable `div` has no role, so the
test forces you to notice.

### Interact like a user

```jsx
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();
await user.type(screen.getByLabelText('Quantity'), '3');
await user.click(screen.getByRole('button', { name: /add/i }));
```

`userEvent` simulates the real sequence — focus, keydown, input, change. `fireEvent`
dispatches one synthetic event and misses defects that only appear with real
interaction. Prefer `userEvent`.

### Async

```jsx
// ✅ waits for the assertion to pass
expect(await screen.findByText('Sale completed')).toBeInTheDocument();

// ✅ asserting something is gone
await waitForElementToBeRemoved(() => screen.queryByRole('status'));

// ❌ arbitrary sleeps: slow, and flaky under load
await new Promise((r) => setTimeout(r, 500));
```

`findBy*` for appearance, `queryBy*` for absence (`getBy*` throws), and never a
fixed timeout.

### Mock the network, not your modules

```js
// test/setup.js — MSW intercepts at the network layer
export const server = setupServer(
  http.get('/api/v1/sales', () => HttpResponse.json({ data: [saleFixture()] })),
);
```

Intercepting HTTP tests your real fetching code — interceptors, error
normalisation, cancellation. Mocking your own `sales.api.js` tests the mock.

Per-test overrides for failure paths:

```js
server.use(http.get('/api/v1/sales', () => new HttpResponse(null, { status: 500 })));
```

### Test the states that break

The failure paths are where the value is:

```jsx
it('shows a retry when loading fails', async () => {
  server.use(http.get('/api/v1/sales', () => new HttpResponse(null, { status: 500 })));
  render(<SalesPage />, { wrapper: AllProviders });
  expect(await screen.findByRole('button', { name: /try again/i })).toBeInTheDocument();
});

it('distinguishes empty results from filtered-out results', async () => {
  server.use(http.get('/api/v1/sales', () => HttpResponse.json({ data: [] })));
  render(<SalesPage initialFilters={{ status: 'void' }} />, { wrapper: AllProviders });
  expect(await screen.findByText(/no sales match these filters/i)).toBeInTheDocument();
});

it('prevents double submission', async () => {
  const user = userEvent.setup();
  render(<SaleForm onSubmit={onSubmit} />);
  const button = screen.getByRole('button', { name: /complete/i });
  await user.dblClick(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
});
```

The double-submission test is worth writing everywhere money is involved — see
`forms`.

### A render helper with providers

```jsx
export function renderWithProviders(ui, options) {
  const Wrapper = ({ children }) => (
    <MemoryRouter><AuthProvider>{children}</AuthProvider></MemoryRouter>
  );
  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...options }) };
}
```

Repeating provider setup in every file guarantees they drift apart.

### Money assertions

Assert the rendered string exactly. If a currency test needs a tolerance, the
production code is using floats — that is the finding, not the test's problem.
See `javascript`.

```jsx
expect(screen.getByTestId('total')).toHaveTextContent('₹1,240.00');
```

### What not to test

- **Implementation details** — internal state, hook internals, whether a
  particular child rendered
- **The framework** — React, Router, and axios are already tested
- **Styling** — beyond what conveys meaning (a disabled control, an error state)
- **Snapshot tests of whole trees.** They break on every change and get
  regenerated without being read, so they detect nothing. Narrow assertions
  instead.

Coverage is a tool for finding untested branches, not a target. High coverage
with no error-path tests is worse than lower coverage with them.

### Detection

```bash
grep -rn "querySelector\|getByTestId" src/ --include=*.test.jsx | wc -l
grep -rn "fireEvent" src/ --include=*.test.jsx | wc -l
grep -rn "setTimeout" src/ --include=*.test.jsx
grep -rn "toMatchSnapshot" src/ --include=*.test.jsx | wc -l
grep -rn "getByRole" src/ --include=*.test.jsx | wc -l
```

A high `getByTestId` count against a low `getByRole` count means tests are
coupled to markup — and often that the markup is not accessible.

### Checklist

- [ ] Queries follow the priority order; `getByTestId` is a last resort
- [ ] `userEvent` used rather than `fireEvent`
- [ ] `findBy*` for async appearance; no fixed timeouts
- [ ] Network mocked at HTTP level, not by mocking own modules
- [ ] Loading, error, and empty states tested
- [ ] Empty vs filtered-out distinguished
- [ ] Double-submission tested on money-moving forms
- [ ] Providers supplied by a shared render helper
- [ ] Money asserted as exact strings
- [ ] No assertions on internal state or hook internals
- [ ] No whole-tree snapshot tests
- [ ] Test names state the behaviour

## References

- **Testing Library — Guiding Principles and Priority of Queries**
  <https://testing-library.com/docs/queries/about/#priority>
- **Testing Library — `user-event`**
  <https://testing-library.com/docs/user-event/intro>
- **Testing Library — Async methods (`findBy`, `waitFor`)**
  <https://testing-library.com/docs/dom-testing-library/api-async>
- **Vitest documentation — configuration, jsdom environment, setup files**
  <https://vitest.dev/guide/>
- **Mock Service Worker (MSW)** — network-level request interception
  <https://mswjs.io/docs/>
- **Kent C. Dodds — Testing Implementation Details**
  <https://kentcdodds.com/blog/testing-implementation-details>

**Not sourced — written for this framework:** the retail test examples
(double-submission, empty vs filtered, money assertions), the role-query
accessibility side effect, and the detection commands.
