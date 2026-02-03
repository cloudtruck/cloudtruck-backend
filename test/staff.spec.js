import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import User from '../src/models/user.model.js';
import Staff from '../src/models/staff.model.js';

describe('Staff API', function() {
  let internalAuth;

  before(async function() {
    await startTestDB();
    internalAuth = await makeAuthHeaderForRole('internal');
  });

  after(async function() {
    await stopTestDB();
  });

  describe('POST /api/v1/staff', function() {
    it('creates a staff profile when email and password provided', async function() {
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', internalAuth)
        .send({
          email: 'staff1@example.com',
          password: 'Password123!',
          name: 'Alice Staff',
          department: 'Operations',
          title: 'Operator'
        });

      expect(res.status).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data).to.have.property('_id');
      expect(res.body.data.name).to.equal('Alice Staff');
      expect(res.body.data).to.have.property('user');

      const staff = await Staff.findById(res.body.data._id);
      expect(staff).to.exist;
      expect(staff.name).to.equal('Alice Staff');
    });

    it('rejects creation when email/password are missing and no userId', async function() {
      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', internalAuth)
        .send({ name: 'NoCred' });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });

    it('rejects creation if user with email already exists', async function() {
      await User.create({ email: 'existing@example.com', role: 'staff', status: 'active', password: 'x' });

      const res = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', internalAuth)
        .send({ email: 'existing@example.com', password: 'Password1!', name: 'Duplicate' });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/v1/staff/:id', function() {
    it('returns staff by id', async function() {
      // Create staff first
      const createRes = await request(app)
        .post('/api/v1/staff')
        .set('Authorization', internalAuth)
        .send({ email: 'staff2@example.com', password: 'Password123!', name: 'Bob Staff' });

      expect(createRes.status).to.equal(201);
      const staffId = createRes.body.data._id;

      const getRes = await request(app)
        .get(`/api/v1/staff/${staffId}`)
        .set('Authorization', internalAuth);

      expect(getRes.status).to.equal(200);
      expect(getRes.body.success).to.be.true;
      expect(getRes.body.data._id).to.equal(staffId);
    });
  });
});
