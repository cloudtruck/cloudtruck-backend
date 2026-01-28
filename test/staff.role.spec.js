import { expect } from 'chai';
import request from 'supertest';
import { startTestDB, stopTestDB, makeAuthHeaderForRole, app } from './setup.js';
import Staff from '../src/models/staff.model.js';
import User from '../src/models/user.model.js';
import RoleTemplate from '../src/models/roleTemplate.model.js';
import Permission from '../src/models/permission.model.js';

describe('Staff Creation with Role Template', function() {
  let adminAuth;
  let adminUser;
  let testPermission;

  before(async function() {
    await startTestDB();
    const token = await makeAuthHeaderForRole('super-admin');
    adminAuth = token;
    // Extract user from token or just find it
    adminUser = await User.findOne({ role: 'super-admin' });
    
    testPermission = await Permission.create({
      key: 'test.staff',
      name: 'Test Staff',
      resource: 'staff',
      action: 'test'
    });
  });

  after(async function() {
    await stopTestDB();
  });

  it('should create staff and new user from role template name', async function() {
    const template = await RoleTemplate.create({
      templateName: 'Ops Manager',
      description: 'Operations Manager',
      permissions: [testPermission._id],
      category: 'operations'
    });

    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', adminAuth)
      .send({
        name: 'John Staff',
        email: 'john.staff@example.com',
        password: 'Password123!',
        roleTemplate: 'Ops Manager'
      });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.be.true;
    expect(res.body.data.name).to.equal('John Staff');
    
    // Check user creation
    const user = await User.findOne({ email: 'john.staff@example.com' });
    expect(user).to.exist;
    expect(user.role).to.equal('staff');
    
    // Check staff permissions
    const staff = await Staff.findById(res.body.data._id);
    expect(staff.permissions.map(p => p.toString())).to.include(testPermission._id.toString());
    expect(staff.roleTemplate.toString()).to.equal(template._id.toString());
  });

  it('should create staff and new user from role template ID', async function() {
    const template = await RoleTemplate.create({
      templateName: 'Exec Manager',
      description: 'Executive Manager',
      permissions: [testPermission._id],
      category: 'management'
    });

    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', adminAuth)
      .send({
        name: 'Jane Staff',
        email: 'jane.staff@example.com',
        password: 'Password123!',
        roleTemplate: template._id.toString()
      });

    expect(res.status).to.equal(201);
    expect(res.body.success).to.be.true;
    expect(res.body.data.roleTemplate.toString()).to.equal(template._id.toString());
  });

  it('should fail if email already exists', async function() {
    await User.create({
      email: 'duplicate@example.com',
      password: 'Password123!',
      role: 'staff'
    });

    const res = await request(app)
      .post('/api/v1/staff')
      .set('Authorization', adminAuth)
      .send({
        name: 'Duplicate',
        email: 'duplicate@example.com',
        password: 'Password123!',
        roleTemplate: 'Ops Manager'
      });

    expect(res.status).to.equal(400);
    expect(res.body.message).to.equal('Email already registered');
  });
});
