import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Booking from '../src/models/booking.model.js';
import Customer from '../src/models/customer.model.js';
import User from '../src/models/user.model.js';

describe('GET /api/v1/bookings', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('returns bookings array with pagination and filters work', async function() {
    const staffAuth = await makeAuthHeaderForRole('staff');

    // Create customer and booking
    const user = await User.create({ role: 'customer', status: 'active', phone: '+155500001' });
    const customer = await Customer.create({ user: user._id, companyName: 'TestCo' });

    const b = await Booking.create({
      bookingId: `BK${Date.now()}`,
      customer: customer._id,
      pickup: { city: 'CityA', address: 'Addr', location: { type: 'Point', coordinates: [77.5946, 12.9716] } },
      drop: { city: 'CityB', address: 'Addr', location: { type: 'Point', coordinates: [77.7046, 12.9716] } },
      materialType: 'FMCG',
      weight: { value: 1, unit: 'tons' },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      advanceRequired: 0,
      loadDate: new Date(),
      loadTime: '10:00',
      status: 'created'
    });

    const resAll = await request(app)
      .get('/api/v1/bookings')
      .set('Authorization', staffAuth)
      .expect(200);

    expect(resAll.body.data).to.have.property('bookings');
    expect(resAll.body.data).to.have.property('pagination');
    expect(resAll.body.data.bookings.length).to.be.greaterThan(0);

    // Filter by status
    const resFilter = await request(app)
      .get('/api/v1/bookings?status=created')
      .set('Authorization', staffAuth)
      .expect(200);

    expect(resFilter.body.data.bookings.some(x => String(x._id) === String(b._id))).to.be.true;
  });
});