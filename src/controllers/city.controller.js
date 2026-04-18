import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// cities.json is an array of { name, state } objects
const cities = JSON.parse(readFileSync(join(__dirname, '../utils/cities.json'), 'utf-8'));

// @desc    Search cities by name (min 2 chars)
// @route   GET /api/v1/cities/search?q=
// @access  Public
export const searchCities = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.json(new ApiResponse(200, [], 'Query too short'));
  }

  const query = q.toLowerCase().trim();
  const results = cities
    .filter(city => city.name.toLowerCase().includes(query))
    .slice(0, 20);

  res.json(new ApiResponse(200, results, 'Cities fetched successfully'));
});

// @desc    Get all cities
// @route   GET /api/v1/cities
// @access  Public
export const getAllCities = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, cities, 'All cities fetched successfully'));
});

// @desc    Get cities by prefix
// @route   GET /api/v1/cities/prefix/:prefix
// @access  Public
export const getCitiesByPrefix = asyncHandler(async (req, res) => {
  const { prefix } = req.params;

  if (!prefix || prefix.length < 1) {
    return res.json(new ApiResponse(200, [], 'Prefix required'));
  }

  const prefixLower = prefix.toLowerCase();
  const results = cities.filter(city =>
    city.name.toLowerCase().startsWith(prefixLower)
  );

  res.json(new ApiResponse(200, results, 'Cities fetched successfully'));
});
