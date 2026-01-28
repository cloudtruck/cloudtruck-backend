import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Permission from '../src/models/permission.model.js';

describe('Permission Management API', function() {
  let adminAuth;

  before(async function() {
    await startTestDB();
    adminAuth = await makeAuthHeaderForRole('super-admin');
  });

  after(async function() {
    await stopTestDB();
  });

  describe('POST /api/v1/permissions', function() {
    it('should create a new permission', async function() {
      const res = await request(app)
        .post('/api/v1/permissions')
        .set('Authorization', adminAuth)
        .send({
          key: 'test.create',
          name: 'Test Create',
          resource: 'test',
          action: 'create'
        });

      expect(res.status).to.equal(201);
      expect(res.body.success).to.be.true;
      expect(res.body.data.key).to.equal('test.create');
    });

    it('should fail with duplicate key', async function() {
      await Permission.create({
        key: 'test.duplicate',
        name: 'Duplicate',
        resource: 'test',
        action: 'duplicate'
      });

      const res = await request(app)
        .post('/api/v1/permissions')
        .set('Authorization', adminAuth)
        .send({
          key: 'test.duplicate',
          name: 'Duplicate 2',
          resource: 'test',
          action: 'duplicate'
        });

      expect(res.status).to.equal(400);
      expect(res.body.success).to.be.false;
    });
  });

  describe('GET /api/v1/permissions', function() {
    it('should return all permissions', async function() {
      const res = await request(app)
        .get('/api/v1/permissions')
        .set('Authorization', adminAuth);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
    });

    it('should filter by resource', async function() {
      const res = await request(app)
        .get('/api/v1/permissions?resource=test')
        .set('Authorization', adminAuth);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('array');
      res.body.data.forEach(p => expect(p.resource).to.equal('test'));
    });
  });

  describe('GET /api/v1/permissions/grouped', function() {
    it('should return grouped permissions', async function() {
      const res = await request(app)
        .get('/api/v1/permissions/grouped')
        .set('Authorization', adminAuth);

      expect(res.status).to.equal(200);
      expect(res.body.data).to.be.an('object');
      expect(res.body.data).to.have.property('test');
    });
  });

  describe('PUT /api/v1/permissions/:id', function() {
    it('should update a permission', async function() {
      const permission = await Permission.create({
        key: 'test.update',
        name: 'Update Me',
        resource: 'test',
        action: 'update'
      });

      const res = await request(app)
        .put(`/api/v1/permissions/${permission._id}`)
        .set('Authorization', adminAuth)
        .send({ name: 'Updated' });

      expect(res.status).to.equal(200);
      expect(res.body.data.name).to.equal('Updated');
    });
  });

  describe('DELETE /api/v1/permissions/:id', function() {
    it('should soft delete a permission', async function() {
      const permission = await Permission.create({
        key: 'test.delete',
        name: 'Delete Me',
        resource: 'test',
        action: 'delete'
      });

      const res = await request(app)
        .delete(`/api/v1/permissions/${permission._id}`)
        .set('Authorization', adminAuth);

      expect(res.status).to.equal(200);
      
      const deletedPermission = await Permission.findById(permission._id);
      expect(deletedPermission.isDeleted).to.be.true;
    });
  });
});
