import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Driver from '../src/models/driver.model.js';
import User from '../src/models/user.model.js';
import Booking from '../src/models/booking.model.js';

describe('GET /api/v1/drivers/my-performance', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('returns performance report for authenticated driver user', async function() {
    // create a driver user and driver doc
    const user = await User.create({ role: 'driver', status: 'active', phone: '+15550001001' });
    const driver = await Driver.create({ user: user._id, name: 'Perf Driver', licenseNumber: 'DL-PERF' });

    // create a customer and some bookings for this driver
    const customerUser = await User.create({ role: 'customer', status: 'active', phone: '+15550002001' });
    const customer = await (await import('../src/models/customer.model.js')).default.create({ user: customerUser._id, companyName: 'TestCo' });

    const baseBooking = {
      customer: customer._id,
      pickup: { city: 'CityA', address: 'Addr A', pincode: '560001', contactPerson: { name: 'A', phone: '+15550000001' }, location: { type: 'Point', coordinates: [77.0, 12.97] } },
      drop: { city: 'CityB', address: 'Addr B', pincode: '110001', contactPerson: { name: 'B', phone: '+15550000002' }, location: { type: 'Point', coordinates: [77.6, 12.90] } },
      materialType: 'FMCG',
      weight: { value: 100 },
      truckTypeNeeded: '17ft',
      bodyType: 'open',
      loadDate: new Date(),
      loadTime: '10:00',
      advanceRequired: 0,
      status: 'delivered',
      finalAmount: 100,
      actualDeliveryTime: new Date(),
      loadDateTime: new Date()
    };

    await Booking.create({ ...baseBooking, driver: driver._id, bookingId: `TESTBK-${Date.now()}-1` });
    await Booking.create({ ...baseBooking, driver: driver._id, finalAmount: 200, bookingId: `TESTBK-${Date.now()}-2` });

    // auth as driver
    const auth = `Bearer ${user.generateAccessToken()}`;

    const res = await request(app)
      .get('/api/v1/drivers/my-performance')
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.data.driver.name).to.equal('Perf Driver');
    expect(res.body.data.stats.totalBookings).to.be.at.least(2);
  });
});