/**
 * Pagination Plugin for Mongoose Schemas
 * 
 * Adds a static `paginate` method to any schema
 * Supports filtering, sorting, population, and field selection
 * 
 * Usage:
 * import { paginationPlugin } from '../utils/plugins/pagination.plugin.js';
 * schema.plugin(paginationPlugin);
 * 
 * Then in your service/controller:
 * const result = await Model.paginate(query, options);
 */

export const paginationPlugin = (schema) => {
  /**
   * Paginate documents
   * 
   * @param {Object} query - MongoDB query object
   * @param {Object} options - Pagination options
   * @param {Number} options.page - Page number (default: 1)
   * @param {Number} options.limit - Items per page (default: 20, max: 100)
   * @param {Object|String} options.sort - Sort criteria (default: { createdAt: -1 })
   * @param {String} options.select - Fields to select
   * @param {Array|String} options.populate - Fields to populate
   * @param {Boolean} options.lean - Use lean() for better performance (default: true)
   * @param {Object} options.projection - MongoDB projection
   * 
   * @returns {Promise<Object>} - { data, pagination: { page, limit, total, pages, hasNext, hasPrev } }
   */
  schema.statics.paginate = async function(query = {}, options = {}) {
    // Parse options with defaults
    const page = Math.max(1, parseInt(options.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const skip = (page - 1) * limit;
    
    // Sort options (default: newest first)
    const sort = options.sort || { createdAt: -1 };
    
    // Field selection
    const select = options.select || '';
    
    // Population options
    const populate = options.populate || [];
    
    // Use lean for better performance (returns plain JS objects)
    const useLean = options.lean !== undefined ? options.lean : true;
    
    // Projection (alternative to select)
    const projection = options.projection || {};
    
    try {
      // Build the query
      let queryBuilder = this.find(query);
      
      // Apply projection/selection
      if (Object.keys(projection).length > 0) {
        queryBuilder = queryBuilder.select(projection);
      } else if (select) {
        queryBuilder = queryBuilder.select(select);
      }
      
      // Apply population
      if (Array.isArray(populate)) {
        populate.forEach(pop => {
          queryBuilder = queryBuilder.populate(pop);
        });
      } else if (populate) {
        queryBuilder = queryBuilder.populate(populate);
      }
      
      // Apply sorting
      queryBuilder = queryBuilder.sort(sort);
      
      // Apply pagination
      queryBuilder = queryBuilder.skip(skip).limit(limit);
      
      // Apply lean if enabled
      if (useLean) {
        queryBuilder = queryBuilder.lean();
      }
      
      // Execute queries in parallel for performance
      const [data, total] = await Promise.all([
        queryBuilder.exec(),
        this.countDocuments(query)
      ]);
      
      // Calculate pagination metadata
      const pages = Math.ceil(total / limit);
      const hasNext = page < pages;
      const hasPrev = page > 1;
      
      return {
        data,
        pagination: {
          page,
          limit,
          total,
          pages,
          hasNext,
          hasPrev,
          // Additional useful metadata
          startIndex: skip + 1,
          endIndex: Math.min(skip + limit, total),
          nextPage: hasNext ? page + 1 : null,
          prevPage: hasPrev ? page - 1 : null
        }
      };
    } catch (error) {
      throw new Error(`Pagination error: ${error.message}`);
    }
  };
  
  /**
   * Simple paginate without extra metadata
   * Useful when you just need data and count
   */
  schema.statics.simplePaginate = async function(query = {}, page = 1, limit = 20) {
    const skip = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    
    const [data, total] = await Promise.all([
      this.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.countDocuments(query)
    ]);
    
    return { data, total };
  };
  
  /**
   * Cursor-based pagination (for real-time feeds)
   * Better for infinite scroll and real-time data
   */
  schema.statics.cursorPaginate = async function(query = {}, options = {}) {
    const limit = Math.min(100, Math.max(1, parseInt(options.limit) || 20));
    const cursor = options.cursor; // ID of last item from previous page
    const sortField = options.sortField || 'createdAt';
    const sortOrder = options.sortOrder || -1; // -1 for desc, 1 for asc
    
    // Build query with cursor
    let cursorQuery = { ...query };
    
    if (cursor) {
      const cursorDoc = await this.findById(cursor).select(sortField).lean();
      if (cursorDoc) {
        cursorQuery[sortField] = sortOrder === -1 
          ? { $lt: cursorDoc[sortField] }
          : { $gt: cursorDoc[sortField] };
      }
    }
    
    // Fetch one extra to check if there's a next page
    const data = await this.find(cursorQuery)
      .sort({ [sortField]: sortOrder })
      .limit(limit + 1)
      .lean();
    
    const hasNext = data.length > limit;
    if (hasNext) {
      data.pop(); // Remove the extra item
    }
    
    const nextCursor = hasNext && data.length > 0 
      ? data[data.length - 1]._id.toString()
      : null;
    
    return {
      data,
      cursor: {
        next: nextCursor,
        hasNext
      }
    };
  };
};

/**
 * Helper function to parse pagination params from request query
 * 
 * Usage in controller:
 * const paginationParams = parsePaginationParams(req.query);
 * const result = await Model.paginate(query, paginationParams);
 */
export const parsePaginationParams = (queryParams = {}) => {
  return {
    page: parseInt(queryParams.page) || 1,
    limit: parseInt(queryParams.limit) || 20,
    sort: queryParams.sort ? JSON.parse(queryParams.sort) : { createdAt: -1 },
    select: queryParams.select || '',
    populate: queryParams.populate ? JSON.parse(queryParams.populate) : [],
    lean: queryParams.lean !== 'false' // default true unless explicitly set to false
  };
};

/**
 * Helper to build pagination response for API
 */
export const buildPaginationResponse = (result, message = 'Success') => {
  return {
    success: true,
    message,
    data: result.data,
    pagination: result.pagination
  };
};

export default paginationPlugin;
