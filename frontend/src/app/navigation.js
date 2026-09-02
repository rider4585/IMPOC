import { PERMISSIONS } from '../constants/permissions';
import BarcodePrintScreen from '../screens/BarcodePrintScreen';

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
  // Future epics add entries here
];
