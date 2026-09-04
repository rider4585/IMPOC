import { PERMISSIONS } from '../constants/permissions';
import BarcodePrintScreen from '../screens/BarcodePrintScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import RolesScreen from '../screens/admin/RolesScreen';
import PermissionsScreen from '../screens/admin/PermissionsScreen';
import PicklistManagementScreen from '../screens/admin/PicklistManagementScreen';
import VendorsScreen from '../screens/admin/VendorsScreen';
import TripsScreen from '../screens/inventory/TripsScreen';
import TripDetailScreen from '../screens/inventory/TripDetailScreen';
import StockForm from '../screens/inventory/StockForm';
import StockIntake from '../screens/inventory/StockIntake';
import VendorDetail from '../screens/inventory/VendorDetail';
import POSScreen from '../screens/pos/POSScreen';
import SalesListScreen from '../screens/pos/SalesListScreen';
import RentalsScreen from '../screens/rentals/RentalsScreen';
import ExpensesScreen from '../screens/expenses/ExpensesScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import Dashboard from './Dashboard';

/**
 * Flat navigation registry — one entry per accessible screen. Used by App.jsx to
 * render routes and by the nav to drive permission-gated visibility.
 *
 * Each entry is checked against the signed-in user's permissions array. Only
 * screens whose permission is present in the user's permissions render.
 *
 * This stays the single source of truth for routing + permission gates; paths,
 * gates, and element destinations are UNCHANGED from the pre-revamp app.
 */
export const navigationRegistry = [
  { permission: PERMISSIONS.INVENTORY.BARCODE_GENERATE, label: 'Print labels', path: '/barcode-sheets', element: BarcodePrintScreen },
  { permission: PERMISSIONS.USERS.VIEW, label: 'Users', path: '/users', element: UsersScreen },
  { permission: PERMISSIONS.ROLES.VIEW, label: 'Roles', path: '/roles', element: RolesScreen },
  { permission: PERMISSIONS.ROLES.VIEW, label: 'Permissions', path: '/permissions', element: PermissionsScreen },
  { permission: PERMISSIONS.PICKLISTS.VIEW, label: 'Picklists', path: '/picklists', element: PicklistManagementScreen },
  { permission: PERMISSIONS.INVENTORY.VIEW, label: 'Vendors', path: '/vendors', element: VendorsScreen },
  { permission: PERMISSIONS.INVENTORY.VIEW, label: 'Trips', path: '/trips', element: TripsScreen },
  { permission: PERMISSIONS.SALES.CREATE, label: 'POS', path: '/pos', element: POSScreen },
  { permission: PERMISSIONS.SALES.VIEW, label: 'Sales', path: '/sales', element: SalesListScreen },
  { permission: PERMISSIONS.RENTALS.VIEW, label: 'Rentals', path: '/rentals', element: RentalsScreen },
  { permission: PERMISSIONS.EXPENSES.VIEW, label: 'Expenses', path: '/expenses', element: ExpensesScreen },
  { permission: PERMISSIONS.CUSTOMERS.VIEW, label: 'Customers', path: '/customers', element: CustomersScreen },
  { permission: PERMISSIONS.REPORTS.VIEW, label: 'Dashboard', path: '/dashboard', element: Dashboard },
];

/**
 * Grouped navigation — labelled, icon'd sections (light, role-gated, absent-not-disabled).
 *
 * Each item references the SAME path + permission gate as navigationRegistry (never
 * removed or changed). AppShell consumes this to render labelled grouped sections.
 *
 * `icon` is a short key resolved to an inline SVG by AppShell's icon map.
 */
export const navigationSections = [
  {
    key: 'inventory',
    label: 'Inventory',
    icon: 'inventory',
    items: [
      { permission: PERMISSIONS.INVENTORY.VIEW, label: 'Trips', path: '/trips' },
      { permission: PERMISSIONS.INVENTORY.VIEW, label: 'Vendors', path: '/vendors' },
      { permission: PERMISSIONS.INVENTORY.BARCODE_GENERATE, label: 'Print labels', path: '/barcode-sheets' },
    ],
  },
  {
    key: 'pos',
    label: 'POS / Counter',
    icon: 'pos',
    items: [
      { permission: PERMISSIONS.SALES.CREATE, label: 'POS', path: '/pos' },
      { permission: PERMISSIONS.SALES.VIEW, label: 'Sales', path: '/sales' },
    ],
  },
  {
    key: 'rentals',
    label: 'Rentals',
    icon: 'rentals',
    items: [{ permission: PERMISSIONS.RENTALS.VIEW, label: 'Rentals', path: '/rentals' }],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    icon: 'expenses',
    items: [{ permission: PERMISSIONS.EXPENSES.VIEW, label: 'Expenses', path: '/expenses' }],
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'admin',
    items: [
      { permission: PERMISSIONS.USERS.VIEW, label: 'Users', path: '/users' },
      { permission: PERMISSIONS.ROLES.VIEW, label: 'Roles', path: '/roles' },
      { permission: PERMISSIONS.ROLES.VIEW, label: 'Permissions', path: '/permissions' },
      { permission: PERMISSIONS.PICKLISTS.VIEW, label: 'Picklists', path: '/picklists' },
      { permission: PERMISSIONS.CUSTOMERS.VIEW, label: 'Customers', path: '/customers' },
    ],
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    items: [{ permission: PERMISSIONS.REPORTS.VIEW, label: 'Dashboard', path: '/dashboard' }],
  },
];
