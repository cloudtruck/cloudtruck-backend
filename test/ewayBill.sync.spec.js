import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import EwayBill from '../src/models/ewayBill.model.js';
import Staff from '../src/models/staff.model.js';
import User from '../src/models/user.model.js';
import Booking from '../src/models/booking.model.js';

describe('POST /api/v1/eway-bills/sync', function() {
  let staffAuth;
  let staffRecord;

  before(async function() {
    await startTestDB();
    staffAuth = await makeAuthHeaderForRole('staff');
    const user = await User.findOne({ role: 'staff' });
    staffRecord = await Staff.create({
      user: user._id,
      name: 'Sync Staff',
      department: 'Operations',
      title: 'Dispatcher'
    });
  });

  after(async function() {
    await stopTestDB();
  });

  it('should sync an existing e-way bill', async function() {
    // Create a dummy booking first
    const booking = await Booking.create({
      bookingId: 'BK-SYNC-1',
      customer: new User()._id,
      pickup: { address: 'A', location: { type: 'Point', coordinates: [0, 0] } },
      drop: { address: 'B', location: { type: 'Point', coordinates: [0, 0] } },
      materialType: 'general-cargo',
      weight: { value: 10, unit: 'tons' },
      truckTypeNeeded: 'Taurus',
      bodyType: 'open',
      loadDate: new Date(),
      loadTime: '10:00 AM',
      advanceRequired: 10000
    });

    const ewayBill = await EwayBill.create({
      ewayBillNumber: '123456789012',
      bookingId: booking._id,
      status: 'active',
      fromGstin: '07AAAAA0000A1Z5',
      toGstin: '07BBBBB0000B1Z5',
      documentNumber: 'INV001',
      documentDate: new Date(),
      itemList: [{
        hsnCode: '1234',
        description: 'Test Item',
        quantity: 1,
        unit: 'TON',
        taxableValue: 1000
      }],
      partATotalValue: 1000,
      totalTax: 180,
      expiryTracking: {
        validFrom: new Date(),
        validUpto: new Date(Date.now() + 86400000)
      },
      createdBy: staffRecord._id
    });

    const res = await request(app)
      .post('/api/v1/eway-bills/sync')
      .set('Authorization', staffAuth)
      .send({ ewayBillNumber: '123456789012' });

    expect(res.status).to.equal(200);
    expect(res.body.success).to.be.true;
    expect(res.body.data.syncMetadata.syncStatus).to.equal('success');
    expect(res.body.data.syncMetadata.lastSyncAt).to.exist;
  });

  it('should return 404 for non-existing e-way bill', async function() {
    const res = await request(app)
      .post('/api/v1/eway-bills/sync')
      .set('Authorization', staffAuth)
      .send({ ewayBillNumber: '999999999999' });

    expect(res.status).to.equal(404);
    expect(res.body.success).to.be.false;
  });

  it('should return 400 for missing e-way bill number', async function() {
    const res = await request(app)
      .post('/api/v1/eway-bills/sync')
      .set('Authorization', staffAuth)
      .send({});

    expect(res.status).to.equal(400);
  });
});
