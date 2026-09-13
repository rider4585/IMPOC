import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './src/modules/auth/auth.routes.js';
import userRoutes from './src/modules/users/user.routes.js';
import roleRoutes from './src/modules/roles/role.routes.js';
import permissionRoutes from './src/modules/permissions/permission.routes.js';
import barcodeRoutes from './src/modules/barcode/barcode.routes.js';
import productTypesRoutes from './src/modules/product-types/product-type.routes.js';
import coloursRoutes from './src/modules/colours/colour.routes.js';
import sizesRoutes from './src/modules/sizes/size.routes.js';
import damageGradesRoutes from './src/modules/damage-grades/damage-grade.routes.js';
import paymentMethodRoutes from './src/modules/payment-methods/payment-method.routes.js';
import customerSourceRoutes from './src/modules/customer-sources/customer-source.routes.js';
import expenseTypesRoutes from './src/modules/expense-types/expense-type.routes.js';
import upiAccountsRoutes from './src/modules/upi-accounts/upi-account.routes.js';
import barcodeLayoutRoutes from './src/modules/barcode-layouts/barcode-layout.routes.js';
import posDisplayRoutes from './src/modules/pos-display/pos-display.routes.js';
import vendorsRoutes from './src/modules/vendors/vendor.routes.js';
import tripRoutes from './src/modules/intake/trip.routes.js';
import stockRoutes, { stockListRouter } from './src/modules/intake/stock.routes.js';
import templateRoutes from './src/modules/intake/template.routes.js';
import unitsRoutes from './src/modules/units/units.routes.js';
import salesRoutes from './src/modules/sales/sales.routes.js';
import rentalRoutes from './src/modules/rentals/rental-agreement.routes.js';
import expensesRoutes from './src/modules/expenses/expenses.routes.js';
import reportsRoutes from './src/modules/reports/reports.routes.js';
import customerRoutes from './src/modules/customers/customers.routes.js';
import deliveryRoutes from './src/modules/delivery/delivery.routes.js';
import receiptRoutes from './src/modules/receipts/receipts.routes.js';
import errorMiddleware from './src/middleware/error.middleware.js';

import { assertJwtSecrets } from './src/modules/auth/token.service.js';

/*
 * Fail fast at boot: a missing, placeholder, or weak JWT access secret would
 * leave every access token forgeable (SEC-CR-3). Running this at import time
 * means the process refuses to start (tests included) instead of silently
 * serving tokens anyone can mint.
 */
assertJwtSecrets();

const app = express();

app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());

// CORS configuration with explicit origin from FRONTEND_ORIGIN env var
const frontendOrigin = process.env.FRONTEND_ORIGIN;
if (!frontendOrigin) {
    throw new Error('FRONTEND_ORIGIN environment variable is not set');
}

// Validate that FRONTEND_ORIGIN is a proper URL
try {
    new URL(frontendOrigin);
} catch (error) {
    throw new Error(`FRONTEND_ORIGIN is not a valid URL: ${frontendOrigin}`);
}

const corsConfig = {
    origin: frontendOrigin,
    credentials: true,
};

app.use(cors(corsConfig));

app.use((req, res, next) => {
    console.log('REQUEST:', req.method, req.originalUrl);
    next();
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/barcodes', barcodeRoutes);
app.use('/api/picklists/product-types', productTypesRoutes);
app.use('/api/picklists/colours', coloursRoutes);
app.use('/api/picklists/sizes', sizesRoutes);
app.use('/api/picklists/damage-grades', damageGradesRoutes);
app.use('/api/picklists/payment-methods', paymentMethodRoutes);
app.use('/api/picklists/customer-sources', customerSourceRoutes);
app.use('/api/picklists/expense-types', expenseTypesRoutes);
app.use('/api/picklists/upi-accounts', upiAccountsRoutes);
app.use('/api/barcode-layouts', barcodeLayoutRoutes);
app.use('/api/pos-display', posDisplayRoutes);
app.use('/api/vendors', vendorsRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/trips/:tripUuid/stocks', stockRoutes);
app.use('/api/stocks', stockListRouter);
app.use('/api/templates', templateRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/receipts', receiptRoutes);

app.use(errorMiddleware);

// app.listen("5000")

export default app;
