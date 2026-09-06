/**
 * SearchableSelect — alias of the app's standard custom Select (cmdk combobox).
 *
 * Kept as a named alias so existing call sites stay working; there is exactly ONE
 * custom select implementation (ui/Select). Use `Select` for all new selects.
 */
export { Select as SearchableSelect, Select as default } from './Select.jsx';