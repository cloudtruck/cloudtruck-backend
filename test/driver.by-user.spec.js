import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Driver from '../src/models/driver.model.js';
import User from '../src/models/user.model.js';

describe('GET /api/v1/drivers/by-user/:userId (by user id)', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('returns driver when requested by user id via by-user route', async function() {
    const user = await User.create({ role: 'driver', status: 'active', phone: '+15550000002' });
    const driver = await Driver.create({ user: user._id, name: 'User Driver', licenseNumber: 'DL-222' });

    const auth = await makeAuthHeaderForRole('staff');

    const res = await request(app)
      .get(`/api/v1/drivers/by-user/${user._id}`)
      .set('Authorization', auth)
      .expect(200);

    const returnedUserId = res.body.data.user && res.body.data.user._id ? res.body.data.user._id : res.body.data.user;
    expect(String(returnedUserId)).to.equal(user._id.toString());
    expect(res.body.data.licenseNumber).to.equal('DL-222');
  });

  it('fallback: GET /api/v1/drivers/:id with user id returns driver', async function() {
    const user = await User.create({ role: 'driver', status: 'active', phone: '+15550000003' });
    const driver = await Driver.create({ user: user._id, name: 'Fallback Driver', licenseNumber: 'DL-333' });

    const auth = await makeAuthHeaderForRole('staff');

    const res = await request(app)
      .get(`/api/v1/drivers/${user._id}`)
      .set('Authorization', auth)
      .expect(200);

    expect(res.body.data.licenseNumber).to.equal('DL-333');
    const returnedUserId2 = res.body.data.user && res.body.data.user._id ? res.body.data.user._id : res.body.data.user;
    expect(String(returnedUserId2)).to.equal(user._id.toString());
  });
});