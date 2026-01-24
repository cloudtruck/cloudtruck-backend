import express from 'express';
import * as cityController from '../controllers/city.controller.js';

const router = express.Router();

// Public routes - no authentication required
router.get('/search', cityController.searchCities);
router.get('/', cityController.getAllCities);
router.get('/prefix/:prefix', cityController.getCitiesByPrefix);

export default router;
