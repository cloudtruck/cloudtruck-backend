import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Driver from '../src/models/driver.model.js';
import User from '../src/models/user.model.js';

describe('GET /api/v1/drivers', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('returns drivers array with pagination and status field', async function() {
    const staffAuth = await makeAuthHeaderForRole('staff');
    const u = await User.create({ role: 'driver', status: 'active', phone: '+15550123456' });
    const d = await Driver.create({ user: u._id, name: 'ListDriver', licenseNumber: 'DL-LIST-1' });

    const beforeCount = await Driver.countDocuments();
    const res = await request(app)
      .get('/api/v1/drivers')
      .set('Authorization', staffAuth)
      .expect(200);

    expect(res.body.data).to.have.property('drivers');
    expect(res.body.data).to.have.property('pagination');
    expect(res.body.data.drivers.length).to.be.greaterThan(0);
    const driver = res.body.data.drivers.find(x => String(x._id) === String(d._id));
    expect(driver).to.exist;
    expect(driver).to.have.property('status');
  });

  it('filters by isVerified=false', async function() {
    const staffAuth = await makeAuthHeaderForRole('staff');
    // Create unverified driver
    const u = await User.create({ role: 'driver', status: 'active', phone: `+1555${Date.now().toString().slice(-7)}` });
    const d = await Driver.create({ user: u._id, name: 'Unverified', licenseNumber: 'DL-UNV-1', isVerified: false });

    const res = await request(app)
      .get('/api/v1/drivers?isVerified=false')
      .set('Authorization', staffAuth)
      .expect(200);

    expect(res.body.data.drivers.some(x => String(x._id) === String(d._id))).to.be.true;
  });
});