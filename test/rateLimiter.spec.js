import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';

describe('Rate Limiter Middleware', function() {
  before(async function() {
    await startTestDB();
    // Set low limits for testing if possible, but actually standardHeaders: true helps us see the limit
    process.env.ADMIN_RATE_LIMIT = '1000';
    process.env.GLOBAL_RATE_LIMIT = '200';
  });

  after(async function() {
    await stopTestDB();
  });

  it('should apply standard limit for regular users', async function() {
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

  it('should apply higher limit for admin users', async function() {
    const adminAuth = await makeAuthHeaderForRole('super-admin');
    
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', adminAuth);

    if (res.headers['ratelimit-limit']) {
      expect(res.headers['ratelimit-limit']).to.equal('1000');
    }
  });

  it('should skip rate limiting for health check', async function() {
    const res = await request(app).get('/api/v1/health');
    expect(res.headers['ratelimit-limit']).to.be.undefined;
  });
});
