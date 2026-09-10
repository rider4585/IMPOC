import React from 'react';

/**
 * Table — shadcn-style base data-table primitive (light mode, Tailwind).
 * Compose TableHead/TableBody/TableRow/TableHeaderCell/TableCell.
 *
 * - `<TableHead sticky />` pins the header row inside a scrolling Table.
 * - `<TableHeaderCell frozen />` + matched `<TableCell frozen />` pin the
 *   first column to the left edge (identity column), UX-M3.
 * - `<TableRow noHover />` drops the hover tint for receipt-style rows.
 */
export const Table = React.forwardRef(function Table(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div className="w-full overflow-auto">
      <table
        ref={ref}
        className={`w-full caption-bottom text-sm ${className}`.trim()}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
});

export const TableHead = React.forwardRef(function TableHead(
  { className = '', children, ...rest },
  ref
) {
  const sticky = rest.sticky;
  const stickyCls = sticky
    ? ' [&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:bg-[var(--surface-raised)]'
    : '';
  const cleanRest = { ...rest };
  delete cleanRest.sticky;
  return (
    <thead ref={ref} className={`[&_tr]:border-b ${stickyCls} ${className}`.trim()} {...cleanRest}>
      {children}
    </thead>
  );
});

export const TableBody = React.forwardRef(function TableBody(
  { className = '', children, ...rest },
  ref
) {
  return (
    <tbody
      ref={ref}
      className={`[&_tr:last-child]:border-0 ${className}`.trim()}
      {...rest}
    >
      {children}
    </tbody>
  );
});

export const TableRow = React.forwardRef(function TableRow(
  { className = '', children, ...rest },
  ref
) {
  const noHover = rest.noHover;
  const hoverCls = noHover ? '' : ' hover:bg-[var(--surface-sunken)]';
  const cleanRest = { ...rest };
  delete cleanRest.noHover;
  return (
    <tr
      ref={ref}
      className={`border-b border-[var(--border)] transition-colors${hoverCls} ${className}`.trim()}
      {...cleanRest}
    >
      {children}
    </tr>
  );
});

export const TableHeaderCell = React.forwardRef(function TableHeaderCell(
  { className = '', children, ...rest },
  ref
) {
  const frozen = rest.frozen;
  const frozenCls = frozen
    ? ' sticky left-0 z-30 bg-[var(--surface-raised)] shadow-[1px_0_0_var(--border)]'
    : '';
  const cleanRest = { ...rest };
  delete cleanRest.frozen;
  return (
    <th
      ref={ref}
      className={`h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]${frozenCls} ${className}`.trim()}
      {...cleanRest}
    >
      {children}
    </th>
  );
});

export const TableCell = React.forwardRef(function TableCell(
  { className = '', children, ...rest },
  ref
) {
  const frozen = rest.frozen;
  const frozenCls = frozen
    ? ' sticky left-0 z-10 bg-[var(--surface-raised)] shadow-[1px_0_0_var(--border)]'
    : '';
  const cleanRest = { ...rest };
  delete cleanRest.frozen;
  return (
    <td
      ref={ref}
      className={`p-3 align-middle${frozenCls} ${className}`.trim()}
      {...cleanRest}
    >
      {children}
    </td>
  );
});

export default Table;