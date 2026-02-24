import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import MarketRateService from '../services/marketRate.service.js';

// @desc    Get market rates (filtered)
// @route   GET /api/v1/market-rates
// @access  Public
export const getMarketRates = asyncHandler(async (req, res) => {
  const { fromCity, toCity, truckType, page, limit } = req.query;
  const result = await MarketRateService.getMarketRates({
    fromCity, toCity, truckType, page, limit
  });

  res.json(new ApiResponse(200, result, 'Market rates fetched successfully'));
});

// @desc    Get price trends for routes
// @route   GET /api/v1/market-rates/trends
// @access  Public
export const getPriceTrends = asyncHandler(async (req, res) => {
  const { fromCity, toCity, truckType } = req.query;
  const trends = await MarketRateService.getPriceTrends({
    fromCity, toCity, truckType
  });

  res.json(new ApiResponse(200, trends, 'Price trends fetched successfully'));
});

// @desc    Get distinct cities
// @route   GET /api/v1/market-rates/cities
// @access  Public
export const getCities = asyncHandler(async (req, res) => {
  const cities = await MarketRateService.getCities();
  res.json(new ApiResponse(200, cities, 'Cities fetched successfully'));
});

// @desc    Get single market rate
// @route   GET /api/v1/market-rates/:id
// @access  Public
export const getMarketRateById = asyncHandler(async (req, res) => {
  const rate = await MarketRateService.getMarketRateById(req.params.id);
  res.json(new ApiResponse(200, rate, 'Market rate fetched successfully'));
});

// @desc    Create market rate
// @route   POST /api/v1/market-rates
// @access  Admin
export const createMarketRate = asyncHandler(async (req, res) => {
  const data = { ...req.body, createdBy: req.user?._id };
  const rate = await MarketRateService.createMarketRate(data);
  res.status(201).json(new ApiResponse(201, rate, 'Market rate created successfully'));
});

// @desc    Update market rate
// @route   PATCH /api/v1/market-rates/:id
// @access  Admin
export const updateMarketRate = asyncHandler(async (req, res) => {
  const data = { ...req.body, updatedBy: req.user?._id };
  const rate = await MarketRateService.updateMarketRate(req.params.id, data);
  res.json(new ApiResponse(200, rate, 'Market rate updated successfully'));
});

// @desc    Delete market rate
// @route   DELETE /api/v1/market-rates/:id
// @access  Admin
export const deleteMarketRate = asyncHandler(async (req, res) => {
  await MarketRateService.deleteMarketRate(req.params.id, req.user?._id);
  res.json(new ApiResponse(200, null, 'Market rate deleted successfully'));
});
