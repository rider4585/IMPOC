import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { navigationSections } from './navigation';

/**
 * Section / item icon set — lightweight inline SVGs (no extra dependency).
 * Keyed by the `icon` strings set on navigationSections + nav items.
 */
const ICONS = {
  inventory: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  ),
  pos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="6" x2="10" y1="10" y2="10" />
      <path d="M6 15h4" />
    </svg>
  ),
  rentals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M8 6v6" /><path d="M15 6v6" />
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  ),
  intake: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    </svg>
  ),
  vendors: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M6 22 4 3H3" /><path d="M18 22 20 3h1" /><path d="M5 16h14" /><path d="M5 8h14" />
    </svg>
  ),
  barcode: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
      <path d="M3 5v14" /><path d="M7 5v14" /><path d="M11 5v14" /><path d="M15 5v14" /><path d="M19 5v14" />
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M3 3v18h18" /><path d="m7 15 4-4 4 3 5-6" />
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  ),
  rentalsItem: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M8 21v-9a4 4 0 0 1 8 0v9" />
    </svg>
  ),
  expensesItem: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  roles: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  ),
  permissions: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
    </svg>
  ),
  picklists: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <path d="M11 17H3" /><path d="M11 7H3" /><path d="m13 5 4 4 5-6" /><path d="M13 19h8" />
    </svg>
  ),
  dashboardItem: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
      <rect width="18" height="13" x="3" y="3" rx="2" /><path d="M3 10h18" /><path d="M7 15h2" /><path d="M11 15h6" />
    </svg>
  ),
};

function iconFor(name) {
  return ICONS[name] || ICONS.dashboard;
}

const itemIcon = {
  '/trips': 'intake',
  '/intake-records': 'intake',
  '/vendors': 'vendors',
  '/barcode-sheets': 'barcode',
  '/pos': 'cart',
  '/sales': 'sales',
  '/rentals': 'rentalsItem',
  '/expenses': 'expensesItem',
  '/users': 'users',
  '/roles': 'roles',
  '/permissions': 'permissions',
  '/picklists': 'picklists',
  '/dashboard': 'dashboardItem',
};

/**
 * AppShell — renders grouped, labelled, icon'd navigation chrome with an
 * active-route indicator and sign-out. Desktop: left rail. Mobile: bottom tab bar.
 *
 * Role-gating: only sections/items whose permission is held by the user render
 * (absent-not-disabled — nothing is ever shown greyed-out).
 */
export function AppShell({ children }) {
  const { permissions, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const resizeObserverRef = useRef(null);

  const perms = permissions ?? [];
  const sections = navigationSections ?? [];

  // Resolve each section to only the items the user can see (absent-not-disabled).
  const accessibleSections = sections
    .map((section) => ({
      ...section,
      items: (section.items || []).filter(
        (entry) => entry && entry.permission && perms.includes(entry.permission)
      ),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600);
    };
    if (typeof ResizeObserver !== 'undefined') {
      try {
        resizeObserverRef.current = new ResizeObserver(handleResize);
        resizeObserverRef.current.observe(document.documentElement);
      } catch (error) {
        console.warn('ResizeObserver not fully supported, falling back to resize event', error);
        window.addEventListener('resize', handleResize);
      }
    } else {
      window.addEventListener('resize', handleResize);
    }
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
      navigate('/');
    }
  };

  // Flatten accessible items for mobile tab-bar keyboard navigation.
  const flatItems = accessibleSections.flatMap((section) => section.items);

  const handleKeyDown = (e, entries) => {
    if (!isMobile || entries.length === 0) return;
    const currentIndex = entries.findIndex((entry) => location.pathname === entry.path);
    let nextIndex = currentIndex;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % entries.length;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + entries.length) % entries.length;
    }
    if (nextIndex !== currentIndex) {
      handleNavigation(entries[nextIndex].path);
    }
  };

  const isActive = (path) => location.pathname === path;

  const railItem = (entry) => (
    <button
      key={entry.path}
      type="button"
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
        isActive(entry.path)
          ? 'bg-primary text-primary-foreground'
          : 'text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]'
      }`}
      onClick={() => handleNavigation(entry.path)}
      role="menuitem"
      aria-current={isActive(entry.path) ? 'page' : undefined}
    >
      <span className={isActive(entry.path) ? 'text-primary-foreground' : 'text-[var(--ink-faint)]'}>
        {iconFor(itemIcon[entry.path])}
      </span>
      {entry.label}
    </button>
  );

  const railSection = (section) => (
    <div key={section.key} className="mb-5">
      <div className="mb-1.5 flex items-center gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)]">
        <span className="text-[var(--ink-faint)]">{iconFor(section.icon)}</span>
        {section.label}
      </div>
      <div className="space-y-0.5">{section.items.map(railItem)}</div>
    </div>
  );

  return (
    <div className={`flex ${isMobile ? 'flex-col' : ''} h-screen w-full`}>
      {!isMobile && (
        <nav
          className="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-raised)]"
          aria-label="Main Navigation"
        >
          <div className="flex flex-1 flex-col overflow-y-auto p-3">
            {accessibleSections.length > 0 ? (
              accessibleSections.map(railSection)
            ) : (
              <div className="p-4 text-center text-sm text-[var(--ink-faint)]">
                <p>You don't have access to any screens yet.</p>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--border)] p-3">
            <button
              type="button"
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--border-strong)] disabled:opacity-60"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
              title={isSigningOut ? 'Signing out...' : 'Sign Out'}
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </nav>
      )}

      <main className="flex-1 overflow-y-auto p-4">{children}</main>

      {isMobile && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 flex h-14 items-center border-t border-[var(--border)] bg-[var(--surface-raised)] px-2"
          aria-label="Main Navigation"
          onKeyDown={(e) => handleKeyDown(e, flatItems)}
        >
          <div className="flex flex-1 gap-1 overflow-x-auto" role="menubar">
            {flatItems.length > 0 ? (
              flatItems.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className={`flex min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium ${
                    isActive(entry.path)
                      ? 'text-primary'
                      : 'text-[var(--ink-muted)]'
                  }`}
                  onClick={() => handleNavigation(entry.path)}
                  role="menuitem"
                  aria-current={isActive(entry.path) ? 'page' : undefined}
                >
                  {iconFor(itemIcon[entry.path])}
                  {entry.label}
                </button>
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-[var(--ink-faint)]">
                No screens available
              </div>
            )}
          </div>
          <button
            type="button"
            className="ml-1 shrink-0 rounded-md border border-[var(--border-strong)] px-2.5 py-1 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-60"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            title={isSigningOut ? 'Signing out...' : 'Sign Out'}
          >
            {isSigningOut ? '⋯' : '✕'}
          </button>
        </nav>
      )}
    </div>
  );
}

export default AppShell;
