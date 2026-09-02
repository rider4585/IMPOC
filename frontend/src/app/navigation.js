import { PERMISSIONS } from '../constants/permissions';
import BarcodePrintScreen from '../screens/BarcodePrintScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import RolesScreen from '../screens/admin/RolesScreen';
import PermissionsScreen from '../screens/admin/PermissionsScreen';
import PicklistManagementScreen from '../screens/admin/PicklistManagementScreen';
import VendorsScreen from '../screens/admin/VendorsScreen';
import IntakeScreen from '../screens/intake/IntakeScreen';
import POSScreen from '../screens/pos/POSScreen';
import SalesListScreen from '../screens/pos/SalesListScreen';

/**
 * Navigation registry — one entry per accessible screen.
 * Each entry is checked against the signed-in user's permissions array.
 * Only screens whose permission is present in the user's permissions render in navigation.
 *
 * Entries are ordered top-to-bottom in navigation.
 * Future stories add their own entries to this list; this is the single source of truth
 * for routing and permission-driven navigation, mirroring the gesture-type.js pattern.
 */
export const navigationRegistry = [
  {
    permission: PERMISSIONS.INVENTORY.BARCODE_GENERATE,
    label: 'Print labels',
    path: '/barcode-sheets',
    element: BarcodePrintScreen,
  },
  {
    permission: PERMISSIONS.USERS.VIEW,
    label: 'Users',
    path: '/users',
    element: UsersScreen,
  },
  {
    permission: PERMISSIONS.ROLES.VIEW,
    label: 'Roles',
    path: '/roles',
    element: RolesScreen,
  },
  {
    permission: PERMISSIONS.ROLES.VIEW,
    label: 'Permissions',
    path: '/permissions',
    element: PermissionsScreen,
  },
  {
    permission: PERMISSIONS.PICKLISTS.VIEW,
    label: 'Picklists',
    path: '/picklists',
    element: PicklistManagementScreen,
  },
  {
    permission: PERMISSIONS.INVENTORY.VIEW,
    label: 'Vendors',
    path: '/vendors',
    element: VendorsScreen,
  },
  {
    permission: PERMISSIONS.INVENTORY.VIEW,
    label: 'Intake',
    path: '/intake',
    element: IntakeScreen,
  },
  {
    permission: PERMISSIONS.SALES.CREATE,
    label: 'POS',
    path: '/pos',
    element: POSScreen,
  },
  {
    permission: PERMISSIONS.SALES.VIEW,
    label: 'Sales',
    path: '/sales',
    element: SalesListScreen,
  },
  // Future epics add entries here
];
