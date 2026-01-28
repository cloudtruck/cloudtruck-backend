import { expect } from 'chai';
import sinon from 'sinon';
import axios from 'axios';
import LocationService from '../src/services/location.service.js';

describe('LocationService (Geocoding)', function() {
  let axiosStub;

  beforeEach(function() {
    axiosStub = sinon.stub(axios, 'get');
    process.env.GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  afterEach(function() {
    axiosStub.restore();
  });

  describe('geocodeAddress', function() {
    it('should return coordinates for a valid address', async function() {
      const mockResponse = {
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: 28.6139, lng: 77.2090 }
              },
              formatted_address: 'New Delhi, Delhi, India',
              place_id: 'ChIJL_P_CXC_DzkRM9_S9_S9S9S'
            }
          ]
        }
      };
      axiosStub.resolves(mockResponse);

      const result = await LocationService.geocodeAddress('New Delhi');

      expect(result).to.not.be.null;
      expect(result.latitude).to.equal(28.6139);
      expect(result.longitude).to.equal(77.2090);
      expect(result.formattedAddress).to.equal('New Delhi, Delhi, India');
    });

    it('should return null when geocoding fails', async function() {
      const mockResponse = {
        data: {
          status: 'ZERO_RESULTS',
          results: []
        }
      };
      axiosStub.resolves(mockResponse);

      const result = await LocationService.geocodeAddress('Invalid Address');

      expect(result).to.be.null;
    });
  });

  describe('calculateRoute', function() {
    it('should return route details for valid points', async function() {
      const mockResponse = {
        data: {
          status: 'OK',
          routes: [
            {
              overview_polyline: { points: 'abc' },
              legs: [
                {
                  distance: { text: '10 km', value: 10000 },
                  duration: { text: '20 mins', value: 1200 }
                }
              ]
            }
          ]
        }
      };
      axiosStub.resolves(mockResponse);

      const result = await LocationService.calculateRoute(
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 }
      );

      expect(result).to.not.be.null;
      expect(result.distance.value).to.equal(10); // 10000 / 1000
      expect(result.duration.value).to.equal(20); // 1200 / 60
    });
  });
});
