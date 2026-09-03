import React from 'react';

/**
 * Placeholder screen for the Dashboard section. The real dashboard/reports landing
 * lands later as T-15; for now this reserves the /dashboard destination so the nav
 * and routing stay intact until then.
 */
export function DashboardPlaceholder() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2 className="typography-heading">Dashboard</h2>
      <p className="typography-body" style={{ color: 'var(--ink-muted)' }}>
        Dashboard and reports land here in a later update.
      </p>
    </div>
  );
}

export default DashboardPlaceholder;
