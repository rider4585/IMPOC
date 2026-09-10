// UX-H8/M3: unit statuses are always rendered as labelled Badges so a state is
// never conveyed by colour alone. Shared by rental lines and vendor detail
// unit lists.
export function unitStatusBadgeVariant(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'returned' || s === 'sold' || s === 'completed') return 'success';
  if (s === 'rented' || s === 'checked_out' || s === 'in_stock') return 'info';
  if (s === 'overdue' || s === 'late' || s === 'lost') return 'danger';
  if (s === 'maintenance' || s === 'in_maintenance' || s === 'damaged') return 'warning';
  return 'neutral';
}