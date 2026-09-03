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
import vendorsRoutes from './src/modules/vendors/vendor.routes.js';
import intakeRoutes from './src/modules/intake/stock-intake.routes.js';
import intakeLineRoutes from './src/modules/intake/stock-intake-line.routes.js';
import unitsRoutes from './src/modules/units/units.routes.js';
import salesRoutes from './src/modules/sales/sales.routes.js';
import rentalRoutes from './src/modules/rentals/rental-agreement.routes.js';
import expensesRoutes from './src/modules/expenses/expenses.routes.js';
import reportsRoutes from './src/modules/reports/reports.routes.js';
import errorMiddleware from './src/middleware/error.middleware.js';

const app = express();

app.use(express.json());
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
app.use('/api/vendors', vendorsRoutes);
app.use('/api/stock-intakes', intakeRoutes);
app.use('/api/stock-intakes/:tripUuid/lines', intakeLineRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reports', reportsRoutes);

app.use(errorMiddleware);

// app.listen("5000")

export default app;
