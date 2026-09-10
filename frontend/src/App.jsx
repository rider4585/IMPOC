import React, { Suspense } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/useAuth';
import { RouteGuard } from './app/RouteGuard';
import { AppShell } from './app/AppShell';
import { navigationRegistry } from './app/navigation';
import TripDetailScreen from './screens/inventory/TripDetailScreen';
import StockForm from './screens/inventory/StockForm';
import StockIntake from './screens/inventory/StockIntake';
import TemplateForm from './screens/inventory/TemplateForm';
import VendorDetail from './screens/inventory/VendorDetail';
import StocksScreen from './screens/inventory/StocksScreen';
import UnitsScreen from './screens/inventory/UnitsScreen';
import PosDisplayScreen from './screens/display/PosDisplayScreen';

/**
 * App.jsx — top-level router and auth setup
 *
 * Structure:
 * Router (react-router-dom)
 *   └─ AuthProvider (auth state: accessToken, currentUser, permissions, status)
 *       └─ Routes
 *           ├─ /display, /display/:code (R-35: PUBLIC, no auth, no nav chrome —
 *           |   the customer-facing display on a separate device)
 *           └─ /* → RouteGuard (blocks unauthenticated access)
 *                     └─ AppShell (navigation chrome + sign-out)
 *                         └─ Routes (permission-gated screens)
 *
 * Patch 11: Verify all navigationRegistry entries have corresponding Route elements
 * Patch 19: Add loading state indicator during route transitions
 */

/**
 * Loading fallback for route transitions
 */
function RouteLoadingFallback() {
  return (
    <div className="p-10 text-center">
      <p>Loading...</p>
    </div>
  );
}

/**
 * LandingRedirect (UX-C1) — post-login landing. `/` falls through to the
 * user's first permitted screen (computed from permissions against
 * navigationRegistry, absent-not-disabled), so sign-in/sign-out never dump
 * the operator on the "Nothing here yet" catch-all.
 */
function LandingRedirect() {
  const { permissions } = useAuth();
  const perms = permissions ?? [];
  const firstAccessiblePath = navigationRegistry.find(
    (entry) => entry && entry.path && entry.permission && perms.includes(entry.permission)
  )?.path;
  if (!firstAccessiblePath) {
    return (
      <div className="p-10 text-center">
        <h2>Nothing here yet</h2>
        <p>You don't have access to any screens in this version of the app.</p>
      </div>
    );
  }
  return <Navigate to={firstAccessiblePath} replace />;
}

function App() {
  // Patch 11: Validate that all navigationRegistry entries are valid and have required fields
  const validEntries = navigationRegistry.filter((entry) => {
    if (!entry) {
      console.warn('Invalid entry in navigationRegistry: null or undefined');
      return false;
    }
    if (!entry.path) {
      console.warn('Invalid entry in navigationRegistry: missing path', entry);
      return false;
    }
    if (!entry.element) {
      console.warn('Invalid entry in navigationRegistry: missing element', entry);
      return false;
    }
    return true;
  });

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/*
            R-35: the customer-facing POS display is a PUBLIC, full-screen
            page on a separate device — it must render outside RouteGuard
            (no auth) and AppShell (no nav chrome). Every other path falls
            through to the guarded app below.
          */}
          <Route path="/display" element={<PosDisplayScreen />} />
          <Route path="/display/:code" element={<PosDisplayScreen />} />

          <Route
            path="/*"
            element={
              <RouteGuard>
                <AppShell>
                  <Suspense fallback={<RouteLoadingFallback />}>
                    <Routes>
                      {/* Dynamically render routes from navigation registry */}
                      {validEntries.map((entry) => {
                        // Ensure element is a valid React component
                        const Element = entry.element;
                        return (
                          <Route
                            key={entry.path}
                            path={entry.path}
                            element={<Element />}
                          />
                        );
                      })}

                      {/* Nested inventory routes */}
                      <Route path="/trips/:tripUuid" element={<TripDetailScreen />} />
                      <Route path="/trips/:tripUuid/stocks/new" element={<StockForm />} />
                      <Route path="/trips/:tripUuid/stocks/:stockUuid/scan" element={<StockIntake />} />
                      <Route path="/trips/:tripUuid/templates" element={<TemplateForm />} />
                      <Route path="/stocks" element={<StocksScreen />} />
                      <Route path="/units" element={<UnitsScreen />} />

                      {/* Nested vendor detail route */}
                      <Route path="/vendors/:uuid" element={<VendorDetail />} />

                      {/* UX-C1: post-login landing — redirect `/` to the first permitted screen */}
                      <Route path="/" element={<LandingRedirect />} />

                      {/* Fallback: if user has no accessible routes, show "nothing here yet" */}
                      <Route
                        path="*"
                        element={
                          <div className="p-10 text-center">
                            <h2>Nothing here yet</h2>
                            <p>You don't have access to any screens in this version of the app.</p>
                          </div>
                        }
                      />
                    </Routes>
                  </Suspense>
                </AppShell>
              </RouteGuard>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;