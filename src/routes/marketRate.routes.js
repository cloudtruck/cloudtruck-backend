import express from 'express';
import * as marketRateController from '../controllers/marketRate.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createMarketRateSchema,
  updateMarketRateSchema,
  getMarketRatesQuerySchema,
  getPriceTrendsQuerySchema,
  marketRateIdParamSchema
} from '../validators/marketRate.validator.js';

const router = express.Router();

// Public routes
router.get('/', validate(getMarketRatesQuerySchema), marketRateController.getMarketRates);
router.get('/trends', validate(getPriceTrendsQuerySchema), marketRateController.getPriceTrends);
router.get('/cities', marketRateController.getCities);
router.get('/:id', validate(marketRateIdParamSchema), marketRateController.getMarketRateById);

// Admin routes
router.post('/', verifyJWT, checkRole('internal', 'super-admin'), validate(createMarketRateSchema), marketRateController.createMarketRate);
router.patch('/:id', verifyJWT, checkRole('internal', 'super-admin'), validate(updateMarketRateSchema), marketRateController.updateMarketRate);
router.delete('/:id', verifyJWT, checkRole('internal', 'super-admin'), validate(marketRateIdParamSchema), marketRateController.deleteMarketRate);

export default router;
