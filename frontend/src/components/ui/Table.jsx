import React from 'react';

/**
 * Table — shadcn-style base data-table primitive (light mode, Tailwind).
 * Compose TableHead/TableBody/TableRow/TableHeaderCell/TableCell.
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
  return (
    <thead ref={ref} className={`[&_tr]:border-b ${className}`.trim()} {...rest}>
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
  return (
    <tr
      ref={ref}
      className={`border-b border-[var(--border)] transition-colors hover:bg-[var(--surface-sunken)] ${className}`.trim()}
      {...rest}
    >
      {children}
    </tr>
  );
});

export const TableHeaderCell = React.forwardRef(function TableHeaderCell(
  { className = '', children, ...rest },
  ref
) {
  return (
    <th
      ref={ref}
      className={`h-11 px-3 text-left align-middle text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)] ${className}`.trim()}
      {...rest}
    >
      {children}
    </th>
  );
});

export const TableCell = React.forwardRef(function TableCell(
  { className = '', children, ...rest },
  ref
) {
  return (
    <td
      ref={ref}
      className={`p-3 align-middle ${className}`.trim()}
      {...rest}
    >
      {children}
    </td>
  );
});

export default Table;
