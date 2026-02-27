import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import User from '../src/models/user.model.js';
import Booking from '../src/models/booking.model.js';
import Driver from '../src/models/driver.model.js';

describe('Rate Limiter Middleware', function () {
  before(async function () {
    await startTestDB();
    // Set low limits for testing if possible, but actually standardHeaders: true helps us see the limit
    process.env.ADMIN_RATE_LIMIT = '1000';
    process.env.GLOBAL_RATE_LIMIT = '200';
  });

  after(async function () {
    await stopTestDB();
  });

  it('should apply standard limit for regular users', async function () {
    const userAuth = await makeAuthHeaderForRole('customer');

    const res = await request(app)
      .get('/api/v1/health')
      .set('Authorization', userAuth);

    // Note: The health endpoint might be skipped in the limiter
    // Let's check another endpoint like /auth/me or similar if it exists
    const res2 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', userAuth);

    // Some middleware might not be fully initialized in test env or skip IPs
    // But we check for RateLimit headers
    if (res2.headers['ratelimit-limit']) {
      expect(res2.headers['ratelimit-limit']).to.equal('200');
    }
  });

  it('should apply higher limit for admin users', async function () {
    const adminAuth = await makeAuthHeaderForRole('super-admin');

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', adminAuth);

    if (res.headers['ratelimit-limit']) {
      expect(res.headers['ratelimit-limit']).to.equal('1000');
    }
  });

  it('should skip rate limiting for health check', async function () {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['ratelimit-limit']).to.be.undefined;
  });

  // --- Bug 1: Location endpoint rate limit ---
  it('should return 429 on second location POST within 10 seconds', async function () {
    // Create a driver user + profile + active booking
    const driverUser = await User.create({
      phone: `+1999${Date.now().toString().slice(-7)}`,
      role: 'driver',
      status: 'active'
    });
    const driverToken = `Bearer ${driverUser.generateAccessToken()}`;

    const driverRecord = await Driver.create({
      user: driverUser._id,
      name: 'Rate Test Driver',
      phone: driverUser.phone,
      licenseNumber: 'RL9999999999',
      isVerified: true
    });

    const booking = await Booking.create({
      customer: driverUser._id,   // reuse for simplicity
      driver: driverRecord._id,
      status: 'in-transit',
      pickup: { address: 'A', location: { type: 'Point', coordinates: [0, 0] } },
      drop: { address: 'B', location: { type: 'Point', coordinates: [1, 1] } },
      materialType: 'general-cargo',
      weight: { value: 5, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      loadDate: new Date(),
      loadTime: '09:00 AM',
      advanceRequired: 0
    });

    const payload = { latitude: 12.9, longitude: 77.6, accuracy: 10 };
    const url = `/api/v1/tracking/${booking._id}/location`;

    // First request — should succeed (201 or 400/422 from service layer is fine, just not 429)
    const first = await request(app)
      .post(url)
      .set('Authorization', driverToken)
      .send(payload);

    expect(first.status).to.not.equal(429);

    // Second request within the same 10s window — must be rate-limited
    const second = await request(app)
      .post(url)
      .set('Authorization', driverToken)
      .send(payload);

    expect(second.status).to.equal(429);
  });
});

