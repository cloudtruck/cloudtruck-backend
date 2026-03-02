import MarketRate from '../models/marketRate.model.js';
import ApiError from '../utils/ApiError.js';

class MarketRateService {
  /**
   * Get market rates with filters and pagination
   */
  static async getMarketRates({ fromCity, toCity, truckType, page, limit }) {
    const query = { isDeleted: false, isActive: true };

    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, 'i') };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, 'i') };
    if (truckType) query.truckType = truckType;

    const result = await MarketRate.paginate(query, {
      page: page || 1,
      limit: limit || 20,
      sort: { bookingCount: -1, createdAt: -1 },
      select: '-priceTrends'
    });

    return result;
  }

  /**
   * Get a single market rate by ID
   */
  static async getMarketRateById(id) {
    const rate = await MarketRate.findOne({ _id: id, isDeleted: false }).lean();
    if (!rate) {
      throw new ApiError(404, 'Market rate not found');
    }
    return rate;
  }

  /**
   * Get price trends for a route
   */
  static async getPriceTrends({ fromCity, toCity, truckType }) {
    const query = { isDeleted: false, isActive: true };

    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, 'i') };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, 'i') };
    if (truckType) query.truckType = truckType;

    const rates = await MarketRate.find(query)
      .select('fromCity toCity truckType price priceTrends')
      .lean();

    return rates;
  }

  /**
   * Get distinct cities from market rates
   */
  static async getCities() {
    const [fromCities, toCities] = await Promise.all([
      MarketRate.distinct('fromCity', { isDeleted: false, isActive: true }),
      MarketRate.distinct('toCity', { isDeleted: false, isActive: true })
    ]);

    const cities = [...new Set([...fromCities, ...toCities])].sort();
    return cities;
  }

  /**
   * Create a new market rate (admin)
   */
  static async createMarketRate(data) {
    const rate = await MarketRate.create(data);
    return rate;
  }

  /**
   * Update a market rate (admin)
   */
  static async updateMarketRate(id, data) {
    const rate = await MarketRate.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!rate) {
      throw new ApiError(404, 'Market rate not found');
    }

    return rate;
  }

  /**
   * Soft delete a market rate (admin)
   */
  static async deleteMarketRate(id, userId) {
    const rate = await MarketRate.findOne({ _id: id, isDeleted: false });
    if (!rate) {
      throw new ApiError(404, 'Market rate not found');
    }

    await rate.softDelete(userId);
    return rate;
  }
}

export default MarketRateService;
