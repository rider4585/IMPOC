import express from 'express';

import { authenticate } from '../../middleware/auth.middleware.js';
import { authorize } from '../../middleware/authorization.middleware.js';

import { PERMISSIONS } from '../../constants/permissions.js';

import {
    createCustomer,
    listCustomers,
    getCustomerByUuid,
    updateCustomer,
    updateConsent,
    deleteCustomer,
} from './customers.controller.js';

const router = express.Router();

// GET /api/customers - List customers (optional search)
router.get('/', authenticate, authorize(PERMISSIONS.CUSTOMERS.VIEW), listCustomers);

// POST /api/customers - Create a customer
router.post('/', authenticate, authorize(PERMISSIONS.CUSTOMERS.CREATE), createCustomer);

// GET /api/customers/:uuid - Get a customer by uuid
router.get('/:uuid', authenticate, authorize(PERMISSIONS.CUSTOMERS.VIEW), getCustomerByUuid);

// PATCH /api/customers/:uuid - Update a customer
router.patch('/:uuid', authenticate, authorize(PERMISSIONS.CUSTOMERS.UPDATE), updateCustomer);

// PATCH /api/customers/:uuid/consent - Set a consent channel
router.patch('/:uuid/consent', authenticate, authorize(PERMISSIONS.CUSTOMERS.UPDATE), updateConsent);

// DELETE /api/customers/:uuid - Soft delete a customer
router.delete('/:uuid', authenticate, authorize(PERMISSIONS.CUSTOMERS.DELETE), deleteCustomer);

export default router;