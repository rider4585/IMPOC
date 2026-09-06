---
name: forms
version: 1.0.0
description: |
  Build accessible, correct forms in React — controlled inputs, client-side
  validation and its relationship to server validation, submission state, error
  display, and money and barcode inputs. Use when building or reviewing any form,
  when validation messages are inconsistent, or when a form can be
  double-submitted.
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## Forms

Forms are where most user-facing bugs live: double submissions, lost input,
validation that disagrees with the server, and error messages nobody can act on.

### Client validation is UX, never a control

The server validates; the client gives fast feedback. **Both are required, and
neither replaces the other.** A client-only check is bypassed by any direct API
call — see `input-validation`.

Share the shape where you can. The project uses Zod on the server, and the same
schema can validate on the client:

```js
// shared/schemas/sale.js — one definition, both ends
export const CreateSaleLine = z.object({
  productId: z.string().uuid(),
  quantity:  z.number().int().positive().max(10_000),
  discount:  z.number().min(0).max(100).default(0),
}).strict();
```

One schema means the client cannot drift from what the server accepts — the usual
source of "it looked fine but the save failed".

### Validation timing

Validating on every keystroke from the first character means telling users their
email is invalid while they type the first letter.

- **Validate a field on blur**, once it has been touched
- **Re-validate on change** only after it has already failed, so the error clears
  as they fix it
- **Validate everything on submit**, and move focus to the first error

```jsx
const [values, setValues] = useState(initial);
const [errors, setErrors] = useState({});
const [touched, setTouched] = useState({});

const validateField = (name, value) => {
  const result = schema.shape[name].safeParse(value);
  setErrors((e) => ({ ...e, [name]: result.success ? undefined : result.error.issues[0].message }));
};
```

### Submission state

Every form needs three things, or it will be double-submitted.

```jsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit(e) {
  e.preventDefault();
  if (isSubmitting) return;                 // guard against double-fire

  const parsed = CreateSale.safeParse(values);
  if (!parsed.success) { setErrors(toFieldErrors(parsed.error)); return; }

  setIsSubmitting(true);
  try {
    await createSale(parsed.data);
    onSuccess();
  } catch (err) {
    setErrors(err.errors ?? {});
    setFormError(err.title ?? 'Could not save. Please try again.');
  } finally {
    setIsSubmitting(false);                 // always, even on failure
  }
}
```

```jsx
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? 'Saving…' : 'Complete sale'}
</button>
```

**Disabling the button is not enough on its own** for anything that moves money —
a slow network plus an impatient user still produces two requests. Pair it with a
server-side idempotency key (see `rest-api`).

React 19's `useActionState` provides pending state without the manual flag; use
it if you prefer, the requirements are the same.

### Accessibility is not optional

An inaccessible form is a broken form.

```jsx
<label htmlFor="qty">Quantity</label>
<input
  id="qty"
  name="quantity"
  type="number"
  inputMode="numeric"
  value={values.quantity}
  onChange={handleChange}
  onBlur={handleBlur}
  aria-invalid={!!errors.quantity}
  aria-describedby={errors.quantity ? 'qty-error' : undefined}
/>
{errors.quantity && (
  <p id="qty-error" role="alert">{errors.quantity}</p>
)}
```

Requirements:

- A real `<label>` with `htmlFor` — placeholder text is not a label and disappears
  on input
- `aria-invalid` and `aria-describedby` linking the field to its message
- `role="alert"` so screen readers announce errors
- A real `<form>` with `onSubmit`, so Enter submits
- Errors summarised at the top for long forms, with focus moved there on submit
- Never signal errors by colour alone

### Money and quantity inputs

The retail-specific traps:

```jsx
// Store minor units; display major. Never float arithmetic — see `javascript`.
<input value={majorFromMinor(values.unitPrice)} onChange={(e) =>
  setValues((v) => ({ ...v, unitPrice: minorFromMajor(e.target.value) }))} />
```

- `<input type="number">` returns a **string**; `''` coerces to `0` with
  `Number()`. Never default with `||` — `quantity || 1` turns a deliberate 0 into
  1.
- Use `inputMode="numeric"` (or `"decimal"`) so mobile and till devices show the
  right keypad.
- Do not let a `number` input's spinner or scroll-wheel change a price by
  accident — disable wheel adjustment on money fields.

### Barcode scanner input

Scanners type very fast and end with Enter. That interacts badly with normal
forms.

- Keep a dedicated, always-focused scan field on till screens, or listen globally
  and detect the speed of input.
- The trailing Enter will submit whatever form has focus — make sure that is the
  intended one.
- Debounce lookups, and handle "not found" as a first-class state.

### Unsaved changes

A half-completed sale lost to a misclick is a real cost. Warn before navigating
away from a dirty form, and consider draft persistence for long ones.

### Detection

```bash
grep -rn "<input" src/ --include=*.jsx | grep -v "id=" | head -20        # unlabelled
grep -rn "placeholder=" src/ --include=*.jsx | grep -v "<label"          # placeholder-as-label
grep -rn "onSubmit" src/ --include=*.jsx | wc -l
grep -rnA10 "async function handleSubmit\|onSubmit=" src/ --include=*.jsx | grep -c "isSubmitting\|disabled"
grep -rnE "(quantity|price|amount|discount)\s*\|\|" src/ --include=*.jsx
```

### Checklist

- [ ] Server validates independently; client validation is UX only
- [ ] Validation schema shared between client and server where possible
- [ ] Fields validate on blur, re-validate on change once failed
- [ ] Submit validates everything and focuses the first error
- [ ] `isSubmitting` guard prevents double submission
- [ ] Submitting state reset in `finally`
- [ ] Money-moving forms also protected by a server idempotency key
- [ ] Every input has a real `<label>`; placeholders are not labels
- [ ] `aria-invalid` and `aria-describedby` wired to error messages
- [ ] Errors announced with `role="alert"`, not colour alone
- [ ] Real `<form>` element so Enter submits
- [ ] Money handled in minor units; no `||` defaults on numeric fields
- [ ] `inputMode` set on numeric fields
- [ ] Scanner Enter key lands on the intended form
- [ ] Unsaved-changes warning on dirty forms

## References

- **MDN — Client-side form validation and constraint validation API**
  <https://developer.mozilla.org/en-US/docs/Learn/Forms/Form_validation>
- **WAI-ARIA Authoring Practices — Form instructions and error identification**
  <https://www.w3.org/WAI/tutorials/forms/>
- **WCAG 2.2 — SC 3.3.1 Error Identification, 3.3.2 Labels or Instructions,
  1.4.1 Use of Colour** <https://www.w3.org/TR/WCAG22/>
- **React documentation — `<form>`, Actions, `useActionState`**
  <https://react.dev/reference/react-dom/components/form>
- **Zod documentation** — `safeParse` and issue formatting <https://zod.dev/>

**Not sourced — written for this framework:** the validation timing rules, the
money and barcode input guidance, the double-submission argument for idempotency
keys, and the detection commands.
