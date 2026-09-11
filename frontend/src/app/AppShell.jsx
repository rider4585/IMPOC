import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { navigationSections } from './navigation';
import { ShopLogo } from '../components/ShopLogo';
import { SettingsDrawer } from '../theme/index.js';
import { NavItem } from '../components/ui';
import { primeMediaPermissions } from '../platform/mediaPermissions.js';
import {
  Boxes,
  ScanBarcode,
  Store,
  MapPin,
  NotebookPen,
  LayoutDashboard,
  Truck,
  ShoppingCart,
  ChartLine,
  CalendarRange,
  ListOrdered,
  ShieldCheck,
  ShoppingBag,
  Wallet,
  Users,
  UserCog,
  KeyRound,
  ListChecks,
  Settings,
  Layers,
  Package,
  Tags,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';

// localStorage keys for remembering which desktop nav sections and rail are collapsed.
const NAV_COLLAPSED_KEY = 'appshell:nav-collapsed';
const RAIL_COLLAPSED_KEY = 'appshell:rail-collapsed';

function loadCollapsedSections() {
  try {
    const raw = localStorage.getItem(NAV_COLLAPSED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadRailCollapsed() {
  try {
    const raw = localStorage.getItem(RAIL_COLLAPSED_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

const iconClass = 'h-4 w-4';
const iconProps = { className: iconClass, 'aria-hidden': true };

const ICONS = {
  inventory: <Boxes {...iconProps} />,
  pos: <Store {...iconProps} />,
  rentals: <CalendarRange {...iconProps} />,
  expenses: <NotebookPen {...iconProps} />,
  admin: <ShieldCheck {...iconProps} />,
  dashboard: <LayoutDashboard {...iconProps} />,
  intake: <Truck {...iconProps} />,
  vendors: <MapPin {...iconProps} />,
  barcode: <ScanBarcode {...iconProps} />,
  sales: <ChartLine {...iconProps} />,
  cart: <ShoppingCart {...iconProps} />,
  rentalsItem: <CalendarRange {...iconProps} />,
  expensesItem: <ListOrdered {...iconProps} />,
  users: <UserCog {...iconProps} />,
  roles: <KeyRound {...iconProps} />,
  permissions: <ShieldCheck {...iconProps} />,
  picklists: <ListChecks {...iconProps} />,
  customers: <Users {...iconProps} />,
  dashboardItem: <Layers {...iconProps} />,
  stocks: <Package {...iconProps} />,
  units: <Tags {...iconProps} />,
};

function iconFor(name) {
  return ICONS[name] || ICONS.dashboard;
}

const itemIcon = {
  '/trips': 'intake',
  '/vendors': 'vendors',
  '/stocks': 'stocks',
  '/units': 'units',
  '/barcode-sheets': 'barcode',
  '/pos': 'cart',
  '/sales': 'sales',
  '/rentals': 'rentalsItem',
  '/expenses': 'expensesItem',
  '/users': 'users',
  '/roles': 'roles',
  '/permissions': 'permissions',
  '/picklists': 'picklists',
  '/customers': 'customers',
  '/dashboard': 'dashboardItem',
};

// Desktop shell kicks in at/above this many CSS pixels (mobile-first default).
const DESKTOP_BREAKPOINT = 768;

/**
 * AppShell — grouped, labelled, icon'd navigation chrome with active-route
 * indicator and sign-out. Mobile-first: a compact top brand bar + bottom tab
 * bar by default; a minimals-style left sidebar + top header on larger screens.
 *
 * Role-gating: only sections/items whose permission is held by the user render
 * (absent-not-disabled — nothing is ever shown greyed-out).
 */
export function AppShell({ children }) {
  const { permissions, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= DESKTOP_BREAKPOINT);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Which desktop nav sections are collapsed, remembered across reloads.
  const [collapsedSections, setCollapsedSections] = useState(loadCollapsedSections);
  // Whether desktop rail is in icon-only mode.
  const [railCollapsed, setRailCollapsed] = useState(loadRailCollapsed);
  const resizeObserverRef = useRef(null);

  // Post-login: request the camera permission once up front so the barcode
  // scanner (Intake / POS) opens without a mid-scan prompt. AppShell only
  // renders for a signed-in user, so this runs after login. Runs once/load.
  useEffect(() => {
    primeMediaPermissions();
  }, []);

  const toggleSection = (key) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode / blocked) — collapse still works for the session.
      }
      return next;
    });
  };

  const toggleRailCollapse = () => {
    setRailCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
      } catch {
        // Storage unavailable — collapse still works for the session.
      }
      return next;
    });
  };

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
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
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

  // Flatten accessible items for the mobile tab bar + keyboard navigation.
  const flatItems = accessibleSections.flatMap((section) => section.items);

  const handleKeyDown = (e, entries) => {
    if (isDesktop || entries.length === 0) return;
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

  // Derive the current page title from the flat registry for the header.
  const currentTitle = flatItems.find(
    (entry) => location.pathname === entry.path || location.pathname.startsWith(`${entry.path}/`)
  )?.label;

  const railItem = (entry) => (
    <NavItem
      key={entry.path}
      active={isActive(entry.path)}
      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
        isActive(entry.path)
          ? 'bg-primary text-primary-foreground'
          : 'text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]'
      } ${railCollapsed ? 'justify-center' : ''}`}
      onClick={() => handleNavigation(entry.path)}
      title={railCollapsed ? entry.label : undefined}
      aria-label={railCollapsed ? entry.label : undefined}
      role="menuitem"
    >
      <span className={isActive(entry.path) ? 'text-primary-foreground' : 'text-[var(--ink-faint)]'}>
        {iconFor(itemIcon[entry.path])}
      </span>
      {!railCollapsed && entry.label}
    </NavItem>
  );

  const railSection = (section) => {
    const isCollapsed = Boolean(collapsedSections[section.key]);
    const bodyId = `nav-section-${section.key}`;
    if (railCollapsed) {
      return (
        <div key={section.key} className="mb-3">
          <div className="flex flex-col items-center gap-2">
            {section.items.map(railItem)}
          </div>
        </div>
      );
    }
    return (
      <div key={section.key} className="mb-5">
        <button
          type="button"
          className="mb-1.5 flex w-full items-center gap-1.5 rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-faint)] transition-colors hover:text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          onClick={() => toggleSection(section.key)}
        >
          <span className="text-[var(--ink-faint)]">{iconFor(section.icon)}</span>
          <span className="flex-1 text-left">{section.label}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            aria-hidden
          />
        </button>
        {!isCollapsed && (
          <div id={bodyId} className="space-y-0.5">
            {section.items.map(railItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex h-dvh w-full ${isDesktop ? '' : 'flex-col'}`}>
      {/* Mobile-first compact brand header (shown by default, hidden on desktop) */}
      {!isDesktop && (
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] px-3">
          <ShopLogo size={{ logo: 28, text: 'text-base' }} />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open theme settings"
              title="Theme settings"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex min-h-[44px] items-center rounded-md border border-[var(--border-strong)] px-2.5 py-1.5 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
              title={isSigningOut ? 'Signing out...' : 'Sign Out'}
            >
              {isSigningOut ? '⋯' : 'Sign out'}
            </button>
          </div>
        </header>
      )}

      {/* Desktop left sidebar */}
      {isDesktop && (
        <nav
          className={`relative flex shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface-raised)] transition-all ${railCollapsed ? 'w-16' : 'w-60'}`}
          aria-label="Main Navigation"
        >
          <div className={`flex h-16 shrink-0 items-center border-b border-[var(--border)] ${railCollapsed ? 'justify-center px-2' : 'px-4'}`}>
            <ShopLogo size={railCollapsed ? { logo: 24, text: 'hidden' } : { logo: 32, text: 'text-lg' }} />
          </div>
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
              className={`flex items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-sunken)] px-3 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--border-strong)] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 ${railCollapsed ? 'h-9 w-9 justify-center' : 'min-h-[44px] w-full justify-center'}`}
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
              title={isSigningOut ? 'Signing out...' : 'Sign Out'}
              aria-label={railCollapsed ? 'Sign out' : undefined}
            >
              {!railCollapsed && (isSigningOut ? 'Signing out...' : 'Sign Out')}
              {railCollapsed && <LogOut className="h-5 w-5" aria-hidden />}
            </button>
          </div>
          <button
            type="button"
            className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface-raised)] shadow-sm transition-colors hover:bg-[var(--surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            onClick={toggleRailCollapse}
            aria-label={railCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={railCollapsed ? 'Expand' : 'Collapse'}
          >
            {railCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronLeft className="h-4 w-4" aria-hidden />
            )}
          </button>
        </nav>
      )}

      {/* Content area + desktop top header */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {isDesktop && (
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)] px-6">
            <h1 className="typography-heading mb-0">{currentTitle || 'Shree Fashion Store'}</h1>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[var(--ink-muted)]">Shree Fashion Store</span>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-md text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
                onClick={() => setSettingsOpen(true)}
                aria-label="Open theme settings"
                title="Theme settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </header>
        )}
        <main
          className={`min-h-0 flex-1 overflow-y-auto ${
            isDesktop
              ? 'p-4 sm:p-6'
              : 'px-0 pt-4 sm:pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))]'
          }`}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      {!isDesktop && (
        <nav
          className="fixed inset-x-0 bottom-0 z-20 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center border-t border-[var(--border)] bg-[var(--surface-raised)] px-2 pb-[env(safe-area-inset-bottom)]"
          aria-label="Main Navigation"
          onKeyDown={(e) => handleKeyDown(e, flatItems)}
        >
          <div className="flex flex-1 gap-1 overflow-x-auto" role="menubar">
            {flatItems.length > 0 ? (
              flatItems.map((entry) => (
                <NavItem
                  key={entry.path}
                  active={isActive(entry.path)}
                  className={`flex min-h-[44px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] ${
                    isActive(entry.path)
                      ? 'text-primary'
                      : 'text-[var(--ink-muted)]'
                  }`}
                  onClick={() => handleNavigation(entry.path)}
                  role="menuitem"
                >
                  {iconFor(itemIcon[entry.path])}
                  {entry.label}
                </NavItem>
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center text-xs text-[var(--ink-faint)]">
                No screens available
              </div>
            )}
          </div>
        </nav>
      )}

      <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default AppShell;
