import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';

/**
 * Middleware to validate request data using Zod schemas
 * @param {Object} schema - Zod schema object with body/query/params
 * @returns {Function} Express middleware
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      // Validate request data
      const validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      // Replace request data with validated data
      req.body = validated.body || req.body;
      req.query = validated.query || req.query;
      req.params = validated.params || req.params;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors
        const errors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return next(new ApiError(400, 'Validation failed', errors));
      }
      next(error);
    }
  };
};

export default validate;
