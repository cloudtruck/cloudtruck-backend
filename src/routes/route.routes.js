import express from 'express';
import * as routeController from '../controllers/route.controller.js';
import { verifyJWT, checkRole } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validation.middleware.js';
import {
  createRouteSchema,
  getMyRoutesQuerySchema,
  routeIdParamSchema,
  searchRoutesQuerySchema,
  updateRouteSchema,
  updateStatisticsSchema,
  cloneRouteSchema,
  getPopularRoutesQuerySchema
} from '../validators/route.validator.js';

const router = express.Router();

// Customer routes - all routes require customer role
router.use(verifyJWT, checkRole('customer'));

// Search and list routes
router.get('/search', validate(searchRoutesQuerySchema), routeController.searchRoutes);
router.get('/popular', validate(getPopularRoutesQuerySchema), routeController.getPopularRoutes);
router.get('/favorites', routeController.getFavoriteRoutes);
router.get('/statistics', routeController.getRouteStatistics);
router.get('/my-routes', validate(getMyRoutesQuerySchema), routeController.getMyRoutes);

// CRUD operations
router.post('/', validate(createRouteSchema), routeController.createRoute);
router.get('/:id', validate(routeIdParamSchema), routeController.getRouteById);
router.patch('/:id', validate(updateRouteSchema), routeController.updateRoute);
router.delete('/:id', validate(routeIdParamSchema), routeController.deleteRoute);

// Route actions
router.post('/:id/use', validate(routeIdParamSchema), routeController.markAsUsed);
router.post('/:id/toggle-favorite', validate(routeIdParamSchema), routeController.toggleFavorite);
router.post('/:id/statistics', validate(updateStatisticsSchema), routeController.updateStatistics);
router.post('/:id/clone', validate(cloneRouteSchema), routeController.cloneRoute);

export default router;
