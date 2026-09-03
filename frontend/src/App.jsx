import React, { Suspense } from 'react';
import './App.css';

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { RouteGuard } from './app/RouteGuard';
import { AppShell } from './app/AppShell';
import { navigationRegistry } from './app/navigation';
import TripDetailScreen from './screens/inventory/TripDetailScreen';
import LotForm from './screens/inventory/LotForm';
import LotIntake from './screens/inventory/LotIntake';
import VendorDetail from './screens/inventory/VendorDetail';

/**
 * App.jsx — top-level router and auth setup
 *
 * Structure:
 * Router (react-router-dom)
 *   └─ AuthProvider (auth state: accessToken, currentUser, permissions, status)
 *       └─ RouteGuard (blocks unauthenticated access)
 *           └─ AppShell (navigation chrome + sign-out)
 *               └─ Routes (permission-gated screens)
 *
 * Patch 11: Verify all navigationRegistry entries have corresponding Route elements
 * Patch 19: Add loading state indicator during route transitions
 */

/**
 * Loading fallback for route transitions
 */
function RouteLoadingFallback() {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p>Loading...</p>
    </div>
  );
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
                <Route path="/trips/:tripUuid/lots/new" element={<LotForm />} />
                <Route path="/trips/:tripUuid/lots/:lotUuid/scan" element={<LotIntake />} />

                {/* Nested vendor detail route */}
                <Route path="/vendors/:uuid" element={<VendorDetail />} />

                {/* Fallback: if user has no accessible routes, show "nothing here yet" */}
                <Route
                  path="*"
                  element={
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                      <h2>Nothing here yet</h2>
                      <p>You don't have access to any screens in this version of the app.</p>
                    </div>
                  }
                />
              </Routes>
            </Suspense>
          </AppShell>
        </RouteGuard>
      </AuthProvider>
    </Router>
  );
}

export default App;