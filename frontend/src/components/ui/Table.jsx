import React from 'react';
import './Table.css';

/**
 * Table — base data-table primitive (light mode).
 * Compose TableHead/TableBody/TableRow/TableHeaderCell/TableCell.
 */
export const Table = React.forwardRef(function Table(
  { className = '', children, ...rest },
  ref
) {
  return (
    <div className="ui-table-wrap">
      <table ref={ref} className={`ui-table ${className}`.trim()} {...rest}>
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
    <thead ref={ref} className={`ui-table__head ${className}`.trim()} {...rest}>
      {children}
    </thead>
  );
});

export const TableBody = React.forwardRef(function TableBody(
  { className = '', children, ...rest },
  ref
) {
  return (
    <tbody ref={ref} className={`ui-table__body ${className}`.trim()} {...rest}>
      {children}
    </tbody>
  );
});

export const TableRow = React.forwardRef(function TableRow(
  { className = '', children, ...rest },
  ref
) {
  return (
    <tr ref={ref} className={`ui-table__row ${className}`.trim()} {...rest}>
      {children}
    </tr>
  );
});

export const TableHeaderCell = React.forwardRef(function TableHeaderCell(
  { className = '', children, ...rest },
  ref
) {
  return (
    <th ref={ref} className={`ui-table__th ${className}`.trim()} {...rest}>
      {children}
    </th>
  );
});

export const TableCell = React.forwardRef(function TableCell(
  { className = '', children, ...rest },
  ref
) {
  return (
    <td ref={ref} className={`ui-table__td ${className}`.trim()} {...rest}>
      {children}
    </td>
  );
});

export default Table;
