import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { navigationRegistry } from './navigation';
import './AppShell.css';

/**
 * AppShell — renders navigation chrome (tab bar or left rail) and the main content area.
 *
 * - Checks user permissions against navigationRegistry
 * - Only shows nav entries the user has permission for (absent, never disabled)
 * - Tab bar at mobile (< 600px), left rail at tablet+ (>= 600px)
 * - Tab bar caps at 4 items
 * - Exposes sign-out control
 * - Includes loading state, error handling, keyboard navigation, and accessibility
 */
export function AppShell({ children }) {
  const { permissions, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const resizeObserverRef = useRef(null);

  // Patch 2: Use nullish coalescing for permissions
  const perms = permissions ?? [];

  // Patch 3: Add null check for navigationRegistry before filtering
  const navItems = navigationRegistry ?? [];

  // Patch 12: Add validation: filter entries that have `.permission` field present
  const accessibleEntries = navItems.filter(
    (entry) => entry && entry.permission && perms.includes(entry.permission)
  );

  // Patch 8: Add null check before calling `.slice(0, 4)`
  const visibleEntries =
    isMobile && accessibleEntries ? accessibleEntries.slice(0, 4) : accessibleEntries;

  // Patch 9-10: Use ResizeObserver with fallback
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600);
    };

    // Try to use ResizeObserver if available
    if (typeof ResizeObserver !== 'undefined') {
      try {
        resizeObserverRef.current = new ResizeObserver(() => {
          handleResize();
        });
        resizeObserverRef.current.observe(document.documentElement);
      } catch (error) {
        console.warn('ResizeObserver not fully supported, falling back to resize event');
        window.addEventListener('resize', handleResize);
      }
    } else {
      // Fallback: use resize event
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

  // Patch 4-5: Wrap signOut in try-catch and make async
  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsSigningOut(false);
      // Redirect after state clears (navigate is synchronous but happens after state settles)
      navigate('/');
    }
  };

  // Patch 24: Handle keyboard navigation (arrow keys)
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

  return (
    <div className={`app-shell ${isMobile ? 'mobile' : 'desktop'}`}>
      {/* Left rail (desktop only) - Patch 21: Add ARIA labels */}
      {!isMobile && (
        <nav className="app-shell-rail surface-soft" aria-label="Main Navigation">
          <div className="app-shell-nav-items" role="menubar">
            {visibleEntries.length > 0 ? (
              visibleEntries.map((entry) => (
                <button
                  key={entry.path}
                  className={`app-shell-nav-item ${
                    location.pathname === entry.path ? 'active' : ''
                  }`}
                  onClick={() => handleNavigation(entry.path)}
                  role="menuitem"
                  aria-current={location.pathname === entry.path ? 'page' : undefined}
                >
                  {entry.label}
                </button>
              ))
            ) : (
              <div className="app-shell-no-access">
                <p>You don't have access to any screens yet.</p>
              </div>
            )}
          </div>

          {/* Sign out in rail footer */}
          <div className="app-shell-rail-footer">
            <button
              className="app-shell-sign-out"
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

      {/* Main content area */}
      <main className="app-shell-content">{children}</main>

      {/* Bottom tab bar (mobile only) - Patch 22: Add ARIA labels */}
      {isMobile && (
        <nav
          className="app-shell-tab-bar surface-soft"
          aria-label="Main Navigation"
          onKeyDown={(e) => handleKeyDown(e, visibleEntries)}
        >
          <div className="app-shell-tab-items" role="menubar">
            {visibleEntries.length > 0 ? (
              visibleEntries.map((entry) => (
                <button
                  key={entry.path}
                  className={`app-shell-tab-item ${
                    location.pathname === entry.path ? 'active' : ''
                  }`}
                  onClick={() => handleNavigation(entry.path)}
                  role="menuitem"
                  aria-current={location.pathname === entry.path ? 'page' : undefined}
                >
                  {entry.label}
                </button>
              ))
            ) : (
              <div className="app-shell-no-access-mobile">
                <p>No screens available</p>
              </div>
            )}
          </div>

          {/* Sign out in tab bar */}
          <button
            className="app-shell-sign-out-mobile"
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
