import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import AgentContact from '../src/models/agentContact.model.js';

describe('Agent Contacts API', function () {
  let internalAuth;
  let customerAuth;

  before(async function () {
    await startTestDB();
    internalAuth = await makeAuthHeaderForRole('internal');
    customerAuth = await makeAuthHeaderForRole('customer');
  });

  after(async function () {
    await stopTestDB();
  });

  beforeEach(async function () {
    await AgentContact.deleteMany({});
  });

  describe('admin CRUD', function () {
    it('creates a contact and normalizes the phone', async function () {
      const res = await request(app)
        .post('/api/v1/agent-contacts')
        .set('Authorization', internalAuth)
        .send({ state: 'Gujarat', phone: '98765 43210' });

      expect(res.status).to.equal(201);
      expect(res.body.data.state).to.equal('Gujarat');
      expect(res.body.data.phone).to.equal('+919876543210');
    });

    it('rejects an invalid phone', async function () {
      const res = await request(app)
        .post('/api/v1/agent-contacts')
        .set('Authorization', internalAuth)
        .send({ state: 'Gujarat', phone: '123' });
      expect(res.status).to.equal(400);
    });

    it('rejects a duplicate state (case-insensitive)', async function () {
      await AgentContact.create({ state: 'Gujarat', phone: '+919876543210' });
      const res = await request(app)
        .post('/api/v1/agent-contacts')
        .set('Authorization', internalAuth)
        .send({ state: 'gujarat', phone: '+919876543211' });
      expect(res.status).to.equal(409);
    });

    it('lists, updates and deletes', async function () {
      const created = await AgentContact.create({ state: 'Goa', phone: '+919876543210' });

      const list = await request(app).get('/api/v1/agent-contacts').set('Authorization', internalAuth);
      expect(list.status).to.equal(200);
      expect(list.body.data).to.have.length(1);

      const upd = await request(app)
        .patch(`/api/v1/agent-contacts/${created._id}`)
        .set('Authorization', internalAuth)
        .send({ phone: '9123456789' });
      expect(upd.status).to.equal(200);
      expect(upd.body.data.phone).to.equal('+919123456789');

      const del = await request(app)
        .delete(`/api/v1/agent-contacts/${created._id}`)
        .set('Authorization', internalAuth);
      expect(del.status).to.equal(200);
      expect(await AgentContact.countDocuments()).to.equal(0);
    });

    it('forbids customers from managing contacts', async function () {
      const res = await request(app)
        .post('/api/v1/agent-contacts')
        .set('Authorization', customerAuth)
        .send({ state: 'Goa', phone: '9876543210' });
      expect(res.status).to.equal(403);
    });
  });

  describe('GET /lookup?state=', function () {
    it('returns the active contact for the state, case-insensitively', async function () {
      await AgentContact.create({ state: 'Gujarat', phone: '+919876543210' });
      const res = await request(app)
        .get('/api/v1/agent-contacts/lookup?state=GUJARAT')
        .set('Authorization', customerAuth);
      expect(res.status).to.equal(200);
      expect(res.body.data).to.deep.include({ phone: '+919876543210', state: 'Gujarat', isFallback: false });
    });

    it('ignores inactive contacts and returns null phone when no fallback exists', async function () {
      await AgentContact.create({ state: 'Gujarat', phone: '+919876543210', isActive: false });
      const res = await request(app)
        .get('/api/v1/agent-contacts/lookup?state=Gujarat')
        .set('Authorization', customerAuth);
      expect(res.status).to.equal(200);
      expect(res.body.data.phone).to.equal(null);
    });
  });
});
