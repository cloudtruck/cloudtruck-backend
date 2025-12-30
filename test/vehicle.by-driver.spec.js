import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Driver from '../src/models/driver.model.js';
import User from '../src/models/user.model.js';
import Vehicle from '../src/models/vehicle.model.js';

describe('GET /api/v1/vehicles/driver/:driverId', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('returns vehicles for a given driver', async function() {
    const user = await User.create({ role: 'driver', status: 'active', phone: '+15550000002' });
    const driver = await Driver.create({ user: user._id, name: 'Veh Driver', licenseNumber: 'DL-1111' });

    const vehicle = await Vehicle.create({
      vehicleNumber: 'KA01AB1234',
      truckType: '14ft',
      length: { value: 14, unit: 'ft' },
      capacity: { value: 1.5, unit: 'tons' },
      bodyType: 'open',
      owner: driver._id,
      createdBy: user._id,
      expiryDates: { insurance: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) }
    });

    const auth = await makeAuthHeaderForRole('staff');

    const res = await request(app)
      .get(`/api/v1/vehicles/driver/${driver._id}`)
      .set('Authorization', auth)
      .expect(200);

    expect(Array.isArray(res.body.data)).to.equal(true);
    expect(res.body.data.length).to.be.greaterThan(0);
    expect(res.body.data[0].vehicleNumber).to.equal('KA01AB1234');
  });

  it('returns 404 for non-existing driver id', async function() {
    const auth = await makeAuthHeaderForRole('staff');
    await request(app)
      .get('/api/v1/vehicles/driver/64a1f2b8e8f4b2d05cfae999')
      .set('Authorization', auth)
      .expect(404);
  });
});