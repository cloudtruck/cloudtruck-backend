import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Driver from '../src/models/driver.model.js';
import User from '../src/models/user.model.js';

describe('GET /api/v1/drivers/:id (by driver _id)', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('returns driver when requested by document _id', async function() {
    const user = await User.create({ role: 'driver', status: 'active', phone: '+15550000001' });
    const driver = await Driver.create({ user: user._id, name: 'Test Driver', licenseNumber: 'DL-123' });

    const auth = await makeAuthHeaderForRole('staff');

    const res = await request(app)
      .get(`/api/v1/drivers/${driver._id}`)
      .set('Authorization', auth)
      .expect(200);

    // The response may include populated objects; assert on stable fields instead
    expect(res.body.data.licenseNumber).to.equal('DL-123');
    const returnedUserId = res.body.data.user && res.body.data.user._id ? res.body.data.user._id : res.body.data.user;
    expect(String(returnedUserId)).to.equal(user._id.toString());
  });

  it('returns 404 for non-existing driver id', async function() {
    const auth = await makeAuthHeaderForRole('staff');
    await request(app)
      .get('/api/v1/drivers/64a1f2b8e8f4b2d05cfae999')
      .set('Authorization', auth)
      .expect(404);
  });
});