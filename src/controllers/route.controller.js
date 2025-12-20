import RouteService from '../services/route.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';

/**
 * Create Saved Route
 * POST /api/v1/routes
 */
export const createRoute = asyncHandler(async (req, res) => {
  const routeData = req.body;
  const customerId = req.user._id;

  const route = await RouteService.createRoute(routeData, customerId);

  return res.status(201).json(
    new ApiResponse(201, route, 'Route created successfully')
  );
});

/**
 * Get Route by ID
 * GET /api/v1/routes/:id
 */
export const getRouteById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const route = await RouteService.getRouteById(id, customerId);

  return res.status(200).json(
    new ApiResponse(200, route, 'Route fetched successfully')
  );
});

/**
 * Get My Routes (Customer)
 * GET /api/v1/routes/my-routes
 */
export const getMyRoutes = asyncHandler(async (req, res) => {
  const customerId = req.user._id;
  const { truckType, preferredTruckType, isFavorite, city, page, limit, sort } = req.query;

  const filters = {
    truckType,
    preferredTruckType,
    isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
    city
  };

  const pagination = { page, limit, sort };

  const result = await RouteService.getCustomerRoutes(customerId, filters, pagination);

  return res.status(200).json(
    new ApiResponse(200, result, 'Routes fetched successfully')
  );
});

/**
 * Search Routes by Cities
 * GET /api/v1/routes/search
 */
export const searchRoutes = asyncHandler(async (req, res) => {
  const customerId = req.user._id;
  const { pickupCity, dropCity } = req.query;

  const routes = await RouteService.searchRoutes(customerId, pickupCity, dropCity);

  return res.status(200).json(
    new ApiResponse(200, routes, 'Routes fetched successfully')
  );
});

/**
 * Update Route
 * PATCH /api/v1/routes/:id
 */
export const updateRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const customerId = req.user._id;

  const route = await RouteService.updateRoute(id, updateData, customerId);

  return res.status(200).json(
    new ApiResponse(200, route, 'Route updated successfully')
  );
});

/**
 * Mark Route as Used
 * POST /api/v1/routes/:id/use
 */
export const markAsUsed = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const route = await RouteService.markAsUsed(id);

  return res.status(200).json(
    new ApiResponse(200, route, 'Route marked as used')
  );
});

/**
 * Toggle Favorite
 * POST /api/v1/routes/:id/toggle-favorite
 */
export const toggleFavorite = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const route = await RouteService.toggleFavorite(id, customerId);

  return res.status(200).json(
    new ApiResponse(200, route, 'Favorite status toggled successfully')
  );
});

/**
 * Update Route Statistics
 * POST /api/v1/routes/:id/statistics
 */
export const updateStatistics = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const bookingData = req.body;

  const route = await RouteService.updateStatistics(id, bookingData);

  return res.status(200).json(
    new ApiResponse(200, route, 'Statistics updated successfully')
  );
});

/**
 * Clone Route
 * POST /api/v1/routes/:id/clone
 */
export const cloneRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  const customerId = req.user._id;

  const route = await RouteService.cloneRoute(id, newName, customerId);

  return res.status(201).json(
    new ApiResponse(201, route, 'Route cloned successfully')
  );
});

/**
 * Get Popular Routes
 * GET /api/v1/routes/popular
 */
export const getPopularRoutes = asyncHandler(async (req, res) => {
  const customerId = req.user._id;
  const { limit } = req.query;

  const routes = await RouteService.getPopularRoutes(customerId, limit ? parseInt(limit) : 5);

  return res.status(200).json(
    new ApiResponse(200, routes, 'Popular routes fetched successfully')
  );
});

/**
 * Get Favorite Routes
 * GET /api/v1/routes/favorites
 */
export const getFavoriteRoutes = asyncHandler(async (req, res) => {
  const customerId = req.user._id;

  const routes = await RouteService.getFavoriteRoutes(customerId);

  return res.status(200).json(
    new ApiResponse(200, routes, 'Favorite routes fetched successfully')
  );
});

/**
 * Get Route Statistics
 * GET /api/v1/routes/statistics
 */
export const getRouteStatistics = asyncHandler(async (req, res) => {
  const customerId = req.user._id;

  const stats = await RouteService.getRouteStatistics(customerId);

  return res.status(200).json(
    new ApiResponse(200, stats, 'Route statistics fetched successfully')
  );
});

/**
 * Delete Route
 * DELETE /api/v1/routes/:id
 */
export const deleteRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const customerId = req.user._id;

  const route = await RouteService.deleteRoute(id, customerId);

  return res.status(200).json(
    new ApiResponse(200, route, 'Route deleted successfully')
  );
});
