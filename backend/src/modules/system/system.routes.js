import express from 'express';
import { getNetworkInfoHandler } from './system.controller.js';

const router = express.Router();

// GET /api/system/network — discover local Wi-Fi and LAN access URLs (R-67)
router.get('/network', getNetworkInfoHandler);

export default router;
