import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Driver from '../src/models/driver.model.js';
import User from '../src/models/user.model.js';
import AuditLog from '../src/models/auditLog.model.js';

describe('POST /api/v1/drivers/:id/reject', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('rejects a driver with a reason and creates an audit log', async function() {
    const staffAuth = await makeAuthHeaderForRole('staff');

    const driverUser = await User.create({ role: 'driver', status: 'active', phone: `+1555${Date.now().toString().slice(-7)}` });
    const driver = await Driver.create({ user: driverUser._id, name: 'Rejectable', licenseNumber: 'DL-REJ-1' });

    const reason = 'Documents do not meet KYC requirements';

    const res = await request(app)
      .post(`/api/v1/drivers/${driver._id}/reject`)
      .set('Authorization', staffAuth)
      .send({ reason })
      .expect(200);

    expect(res.body.data.rejectionReason).to.equal(reason);

    const updated = await Driver.findById(driver._id);
    expect(updated.rejectionReason).to.equal(reason);
    expect(updated.isVerified).to.be.false;

    const audit = await AuditLog.findOne({ action: 'REJECT_DRIVER', entityId: driver._id });
    expect(audit).to.exist;
  });

  it('returns 400 when reason is too short', async function() {
    const staffAuth = await makeAuthHeaderForRole('staff');

    const driverUser = await User.create({ role: 'driver', status: 'active', phone: `+1555${(Date.now()+1).toString().slice(-7)}` });
    const driver = await Driver.create({ user: driverUser._id, name: 'Rejectable2', licenseNumber: 'DL-REJ-2' });

    await request(app)
      .post(`/api/v1/drivers/${driver._id}/reject`)
      .set('Authorization', staffAuth)
      .send({ reason: 'short' })
      .expect(400);
  });
});
