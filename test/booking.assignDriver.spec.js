import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Booking from '../src/models/booking.model.js';
import Customer from '../src/models/customer.model.js';
import User from '../src/models/user.model.js';
import Driver from '../src/models/driver.model.js';
import Vehicle from '../src/models/vehicle.model.js';

describe('POST /api/v1/bookings/:id/assign-driver', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('assigns driver and marks driver/vehicle as on-trip (and removes from available list)', async function() {
    // Create a staff user and corresponding staff profile (assigner)
    const staffUser = await User.create({ role: 'staff', status: 'active', phone: `+15551${Date.now().toString().slice(-6)}` });
    const staffAuth = `Bearer ${staffUser.generateAccessToken()}`;
    const Staff = (await import('../src/models/staff.model.js')).default;
    await Staff.create({ user: staffUser._id, name: 'Assigning Staff' });

    // Create customer and booking
    const user = await User.create({ role: 'customer', status: 'active', phone: `+1555000${Date.now().toString().slice(-6)}` });
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

    // Create a verified driver and a verified vehicle (both available)
    const driverUser = await User.create({ role: 'driver', status: 'active', phone: `+15552${Date.now().toString().slice(-6)}` });
    const driver = await Driver.create({ user: driverUser._id, name: 'Test Driver', licenseNumber: `DL${Date.now()}`, isVerified: true, availability: 'available' });

    const vehicle = await Vehicle.create({
      vehicleNumber: `DL01AB${String(Date.now()).slice(-4)}`,
      truckType: '17ft',
      length: { value: 20, unit: 'ft' },
      capacity: { value: 10, unit: 'tons' },
      bodyType: 'closed',
      expiryDates: { insurance: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) },
      owner: driver._id,
      availability: 'available',
      verificationStatus: 'verified'
    });

    // Assign
    const res = await request(app)
      .post(`/api/v1/bookings/${b._id}/assign-driver`)
      .set('Authorization', staffAuth)
      .send({ driverId: driver._id, vehicleId: vehicle._id })
      .expect(200);

    expect(res.body.data).to.have.property('_id');

    // Fetch driver and vehicle
    const dRes = await request(app)
      .get(`/api/v1/drivers/${driver._id}`)
      .set('Authorization', staffAuth)
      .expect(200);

    expect(dRes.body.data).to.have.property('status');
    expect(dRes.body.data.status).to.equal('on-trip');

    // Available drivers list should not include this driver
    const availableRes = await request(app)
      .get('/api/v1/drivers/available')
      .set('Authorization', staffAuth)
      .expect(200);

    const ids = availableRes.body.data.map(d => d._id);
    expect(ids).to.not.include(String(driver._id));
  });

  it('rolls back booking if a later update (e.g., vehicle.save) fails', async function() {
    const sinon = (await import('sinon')).default;

    const staffUser = await User.create({ role: 'staff', status: 'active', phone: `+15553${Date.now().toString().slice(-6)}` });
    const staffAuth = `Bearer ${staffUser.generateAccessToken()}`;
    const Staff = (await import('../src/models/staff.model.js')).default;
    await Staff.create({ user: staffUser._id, name: 'Assigning Staff' });

    // Create customer and booking
    const user = await User.create({ role: 'customer', status: 'active', phone: `+1555001${Date.now().toString().slice(-6)}` });
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

    const driverUser = await User.create({ role: 'driver', status: 'active', phone: `+15554${Date.now().toString().slice(-6)}` });
    const driver = await Driver.create({ user: driverUser._id, name: 'Bad Vehicle Driver', licenseNumber: `DL${Date.now()}`, isVerified: true, availability: 'available' });

    const vehicle = await Vehicle.create({
      vehicleNumber: `DL01AB${String(Date.now()).slice(-4)}`,
      truckType: '17ft',
      length: { value: 20, unit: 'ft' },
      capacity: { value: 10, unit: 'tons' },
      bodyType: 'closed',
      expiryDates: { insurance: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) },
      owner: driver._id,
      availability: 'available',
      verificationStatus: 'verified'
    });

    // Stub vehicle.save to throw
    const origSave = Vehicle.prototype.save;
    const stub = sinon.stub(Vehicle.prototype, 'save').callsFake(function() {
      if (this._id && String(this._id) === String(vehicle._id)) {
        throw new Error('simulate vehicle save failure');
      }
      return origSave.apply(this, arguments);
    });

    // Attempt assign - should result in 500 and booking should remain unassigned
    await request(app)
      .post(`/api/v1/bookings/${b._id}/assign-driver`)
      .set('Authorization', staffAuth)
      .send({ driverId: driver._id, vehicleId: vehicle._id })
      .expect(500);

    const updatedBooking = await Booking.findById(b._id);
    expect(updatedBooking.driver).to.be.null;
    expect(updatedBooking.status).to.equal('created');

    stub.restore();
  });
});
