import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Booking from '../src/models/booking.model.js';
import AuditLog from '../src/models/auditLog.model.js';

describe('Dashboard endpoints', function () {
  before(async function () {
    await startTestDB();
  });

  after(async function () {
    await stopTestDB();
  });

  it('returns activities mapped from audit logs', async function () {
    const staffAuth = await makeAuthHeaderForRole('staff');

    // Create a customer and a booking and audit logs
    const User = (await import('../src/models/user.model.js')).default;
    const Customer = (await import('../src/models/customer.model.js')).default;
    const user = await User.create({ role: 'customer', status: 'active', phone: `+1555${Date.now().toString().slice(-6)}` });
    const customer = await Customer.create({ user: user._id, companyName: 'TestCo' });

    const b = await Booking.create({
      bookingId: `BK${Date.now()}`,
      customer: customer._id,
      pickup: { city: 'A', address: 'a', location: { type: 'Point', coordinates: [77, 12] } },
      drop: { city: 'B', address: 'b', location: { type: 'Point', coordinates: [77, 13] } },
      materialType: 'FMCG',
      weight: { value: 1, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      advanceRequired: 0,
      loadDate: new Date(),
      loadTime: '10:00',
      status: 'created'
    });

    await AuditLog.create({ user: b._id, action: 'CREATE_BOOKING', entityType: 'booking', entityId: b._id, context: { description: 'Booking created for test' } });
    await AuditLog.create({ user: b._id, action: 'ASSIGN_DRIVER', entityType: 'booking', entityId: b._id, context: { description: 'Driver assigned' } });

    const res = await request(app).get('/api/v1/bookings/dashboard/activities').set('Authorization', staffAuth).expect(200);

    expect(res.body.data).to.be.an('array');
    expect(res.body.data.some(a => a.type === 'booking_created')).to.be.true;
    expect(res.body.data.some(a => a.type === 'driver_assigned')).to.be.true;

    // Now test stats with percent-change: create some bookings in the previous and current period
    const now = new Date();
    const prevDate = new Date(now);
    prevDate.setDate(now.getDate() - 10); // outside current 7-day window -> previous period

    // Create one booking in previous period (assigned)
    await Booking.create({
      bookingId: `BK${Date.now()}p`,
      customer: customer._id,
      pickup: { city: 'P', address: 'p', location: { type: 'Point', coordinates: [77, 12] } },
      drop: { city: 'Q', address: 'q', location: { type: 'Point', coordinates: [77, 13] } },
      materialType: 'FMCG',
      weight: { value: 1, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      advanceRequired: 0,
      loadDate: prevDate,
      loadTime: '10:00',
      status: 'assigned',
      createdAt: prevDate,
      updatedAt: prevDate
    });

    // Create two bookings in current period (created -> so newRequests increases)
    const d1 = new Date(); d1.setDate(now.getDate() - 1);
    const d2 = new Date(); d2.setDate(now.getDate() - 2);

    await Booking.create({
      bookingId: `BK${Date.now()}c1`,
      customer: customer._id,
      pickup: { city: 'C', address: 'c', location: { type: 'Point', coordinates: [77, 12] } },
      drop: { city: 'D', address: 'd', location: { type: 'Point', coordinates: [77, 13] } },
      materialType: 'FMCG',
      weight: { value: 1, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      advanceRequired: 0,
      loadDate: d1,
      loadTime: '10:00',
      status: 'created',
      createdAt: d1,
      updatedAt: d1
    });

    await Booking.create({
      bookingId: `BK${Date.now()}c2`,
      customer: customer._id,
      pickup: { city: 'E', address: 'e', location: { type: 'Point', coordinates: [77, 12] } },
      drop: { city: 'F', address: 'f', location: { type: 'Point', coordinates: [77, 13] } },
      materialType: 'FMCG',
      weight: { value: 1, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      advanceRequired: 0,
      loadDate: d2,
      loadTime: '10:00',
      status: 'created',
      createdAt: d2,
      updatedAt: d2
    });

    const statsRes = await request(app).get('/api/v1/bookings/stats').set('Authorization', staffAuth).expect(200);
    const stats = statsRes.body.data;

    expect(stats).to.have.property('newRequests');
    expect(stats).to.have.property('newRequestsChange');
    expect(stats.newRequests).to.be.greaterThan(0);
    expect(stats.newRequestsChange).to.be.an('object');
    expect(typeof stats.newRequestsChange.value).to.equal('number');
    expect(typeof stats.newRequestsChange.isPositive).to.equal('boolean');
  });

  it('returns trends for last N days', async function () {
    const staffAuth = await makeAuthHeaderForRole('staff');

    // Create bookings on different days
    const User = (await import('../src/models/user.model.js')).default;
    const Customer = (await import('../src/models/customer.model.js')).default;
    const u = await User.create({ role: 'customer', status: 'active', phone: `+1555${Date.now().toString().slice(-6)}` });
    const c = await Customer.create({ user: u._id, companyName: 'TestCo' });

    const now = new Date();
    for (let i = 0; i < 3; i++) {
      const dt = new Date(now);
      dt.setDate(now.getDate() - i);
      await Booking.create({
        bookingId: `BK${Date.now()}${i}`,
        customer: c._id,
        pickup: { city: 'A', address: 'a', location: { type: 'Point', coordinates: [77, 12] } },
        drop: { city: 'B', address: 'b', location: { type: 'Point', coordinates: [77, 13] } },
        materialType: 'FMCG',
        weight: { value: 1, unit: 'tons' },
        truckTypeNeeded: '17ft',
        bodyType: 'open',
        advanceRequired: 0,
        loadDate: dt,
        loadTime: '10:00',
        status: 'created',
        createdAt: dt,
        updatedAt: dt
      });
    }

    const res = await request(app).get('/api/v1/bookings/dashboard/trends?days=3').set('Authorization', staffAuth).expect(200);
    expect(res.body.data).to.be.an('array').with.length(3);
    res.body.data.forEach(d => {
      expect(d).to.have.keys(['date', 'bookings', 'delivered']);
    });
  });

  it('returns status breakdown counts', async function () {
    const staffAuth = await makeAuthHeaderForRole('staff');

    const User = (await import('../src/models/user.model.js')).default;
    const Customer = (await import('../src/models/customer.model.js')).default;
    const u2 = await User.create({ role: 'customer', status: 'active', phone: `+1555${Date.now().toString().slice(-6)}` });
    const c2 = await Customer.create({ user: u2._id, companyName: 'TestCo' });

    await Booking.create({
      bookingId: `BK${Date.now()}x`,
      customer: c2._id,
      pickup: { city: 'A', address: 'a', location: { type: 'Point', coordinates: [77, 12] } },
      drop: { city: 'B', address: 'b', location: { type: 'Point', coordinates: [77, 13] } },
      materialType: 'FMCG',
      weight: { value: 1, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      advanceRequired: 0,
      loadDate: new Date(),
      loadTime: '10:00',
      status: 'assigned'
    });

    const res = await request(app).get('/api/v1/bookings/dashboard/status').set('Authorization', staffAuth).expect(200);
    expect(res.body.data).to.be.an('object');
    expect(res.body.data).to.have.property('assigned');
  });
});
