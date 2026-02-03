import axios from 'axios';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

class LocationService {
  /**
   * Geocode address to coordinates
   * @param {String} address - Full address
   * @returns {Promise<Object>} - {latitude, longitude, formattedAddress}
   */
  static async geocodeAddress(address) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      logger.warn('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address,
          key: apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id
        };
      }

      logger.warn('Geocoding failed:', { address, status: response.data.status });
      return null;
    } catch (error) {
      logger.error('Geocoding error:', error);
      return null;
    }
  }

  /**
   * Calculate route between two points
   * @param {Object} origin - {latitude, longitude}
   * @param {Object} destination - {latitude, longitude}
   * @returns {Promise<Object>} - {polyline, distance, duration}
   */
  static async calculateRoute(origin, destination) {
<<<<<<< Updated upstream
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
=======
    if (!GOOGLE_MAPS_API_KEY) {
>>>>>>> Stashed changes
      logger.warn('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
<<<<<<< Updated upstream
          key: apiKey
=======
          key: GOOGLE_MAPS_API_KEY
>>>>>>> Stashed changes
        }
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const leg = route.legs[0];
        return {
          polyline: route.overview_polyline.points,
          distance: {
            text: leg.distance.text,
            value: leg.distance.value / 1000 // km
          },
          duration: {
            text: leg.duration.text,
            value: leg.duration.value / 60 // minutes
          }
        };
      }

      logger.warn('Route calculation failed:', { status: response.data.status });
      return null;
    } catch (error) {
      logger.error('Route calculation error:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Promise<Object>} - {formattedAddress, city, state, country}
   */
  static async reverseGeocode(latitude, longitude) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      logger.warn('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          latlng: `${latitude},${longitude}`,
          key: apiKey
        }
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const addressComponents = result.address_components;

        const city = addressComponents.find((c) => c.types.includes('locality'))?.long_name;
        const state = addressComponents.find((c) => c.types.includes('administrative_area_level_1'))?.long_name;
        const country = addressComponents.find((c) => c.types.includes('country'))?.long_name;

        return {
          formattedAddress: result.formatted_address,
          city,
          state,
          country,
          placeId: result.place_id
        };
      }

      logger.warn('Reverse geocoding failed:', { latitude, longitude, status: response.data.status });
      return null;
    } catch (error) {
      logger.error('Reverse geocoding error:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points
   * @param {Number} lat1
   * @param {Number} lon1
   * @param {Number} lat2
   * @param {Number} lon2
   * @returns {Number} - Distance in kilometers
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {Number} degrees
   * @returns {Number}
   */
  static toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Get distance and duration using Directions API
   * @param {Object} origin - {latitude, longitude}
   * @param {Object} destination - {latitude, longitude}
   * @returns {Promise<Object>} - {distance, duration, route}
   */
  static async getDirections(origin, destination) {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key not configured');
      // Fallback to Haversine distance
      const distance = this.calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
      return {
        distance: Math.round(distance * 100) / 100,
        duration: null,
        route: null
      };
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
        params: {
          origin: `${origin.latitude},${origin.longitude}`,
          destination: `${destination.latitude},${destination.longitude}`,
          key: GOOGLE_MAPS_API_KEY,
          mode: 'driving'
        }
      });

      if (response.data.status === 'OK' && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        const leg = route.legs[0];

        return {
          distance: leg.distance.value / 1000, // Convert to km
          duration: leg.duration.value / 60, // Convert to minutes
          route: route.overview_polyline.points
        };
      }

      logger.warn('Directions API failed:', { status: response.data.status });
      // Fallback to Haversine
      const distance = this.calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
      return {
        distance: Math.round(distance * 100) / 100,
        duration: null,
        route: null
      };
    } catch (error) {
      logger.error('Directions API error:', error);
      const distance = this.calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
      return {
        distance: Math.round(distance * 100) / 100,
        duration: null,
        route: null
      };
    }
  }

  /**
   * Validate coordinates
   * @param {Number} latitude
   * @param {Number} longitude
   * @returns {Boolean}
   */
  static validateCoordinates(latitude, longitude) {
    return (
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  /**
   * Find nearby locations
   * @param {Number} latitude
   * @param {Number} longitude
   * @param {Number} radius - Radius in kilometers
   * @param {String} type - Place type (e.g., 'gas_station', 'hospital')
   * @returns {Promise<Array>}
   */
  static async findNearbyPlaces(latitude, longitude, radius, type) {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key not configured');
      return [];
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
        params: {
          location: `${latitude},${longitude}`,
          radius: radius * 1000, // Convert to meters
          type,
          key: GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status === 'OK') {
        return response.data.results.map((place) => ({
          name: place.name,
          address: place.vicinity,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating,
          placeId: place.place_id
        }));
      }

      logger.warn('Nearby places search failed:', { status: response.data.status });
      return [];
    } catch (error) {
      logger.error('Nearby places search error:', error);
      return [];
    }
  }

  /**
   * Get autocomplete suggestions for address
   * @param {String} input - User input
   * @param {Object} location - {latitude, longitude} for bias
   * @returns {Promise<Array>}
   */
  static async getPlaceAutocompleteSuggestions(input, location = null) {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key not configured');
      return [];
    }

    try {
      const params = {
        input,
        key: GOOGLE_MAPS_API_KEY,
        components: 'country:in' // Restrict to India
      };

      if (location) {
        params.location = `${location.latitude},${location.longitude}`;
        params.radius = 50000; // 50km radius
      }

      const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        params
      });

      if (response.data.status === 'OK') {
        return response.data.predictions.map((prediction) => ({
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting.main_text,
          secondaryText: prediction.structured_formatting.secondary_text
        }));
      }

      logger.warn('Autocomplete failed:', { status: response.data.status });
      return [];
    } catch (error) {
      logger.error('Autocomplete error:', error);
      return [];
    }
  }

  /**
   * Get place details by place ID
   * @param {String} placeId - Google Place ID
   * @returns {Promise<Object>}
   */
  static async getPlaceDetails(placeId) {
    if (!GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key not configured');
      return null;
    }

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
          place_id: placeId,
          key: GOOGLE_MAPS_API_KEY
        }
      });

      if (response.data.status === 'OK') {
        const place = response.data.result;
        return {
          name: place.name,
          formattedAddress: place.formatted_address,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          phone: place.formatted_phone_number,
          website: place.website,
          rating: place.rating
        };
      }

      logger.warn('Place details failed:', { status: response.data.status });
      return null;
    } catch (error) {
      logger.error('Place details error:', error);
      return null;
    }
  }
}

export default LocationService;
