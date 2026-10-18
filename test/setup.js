import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/user.model.js';
import Staff from '../src/models/staff.model.js';
import Permission from '../src/models/permission.model.js';

let mongoServer;

export const startTestDB = async () => {
  if (mongoose.connection.readyState !== 0) return;

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

export const stopTestDB = async () => {
  if (mongoose.connection.readyState === 0) return;

  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

const STAFF_TEST_PERMISSIONS = [
  ['booking', 'assign'], ['booking', 'create'], ['booking', 'read'], ['booking', 'update-status'], ['booking', 'update'],
  ['customer', 'approve'], ['customer', 'create'], ['customer', 'delete'], ['customer', 'read'], ['customer', 'update'],
  ['document', 'delete'],
  ['driver', 'approve'], ['driver', 'block'], ['driver', 'create'], ['driver', 'delete'], ['driver', 'read'], ['driver', 'reject'], ['driver', 'update'],
  ['eway-bill', 'cancel'], ['eway-bill', 'create'], ['eway-bill', 'read'], ['eway-bill', 'update-part-b'],
  ['master-data', 'read'],
  ['notification', 'send'],
  ['organization', 'read'],
  ['payment', 'mark-received'], ['payment', 'read'], ['payment', 'refund'],
  ['reports', 'export'],
  ['staff', 'manage'],
  ['tracking', 'read'],
  ['vehicle', 'create'], ['vehicle', 'delete'], ['vehicle', 'read'], ['vehicle', 'verify'],
];

export const makeAuthHeaderForRole = async (role) => {
  const data = { role, status: 'active' };
  // driver/customer roles require phone
  if (['customer', 'driver'].includes(role)) {
    data.phone = `+1555${Date.now().toString().slice(-7)}`;
  }
  const user = await User.create(data);

  // Staff users in tests are granted the full permission set used by the
  // route guards so that RBAC does not mask unrelated test assertions.
  if (role === 'staff') {
    const permissionIds = [];
    for (const [resource, action] of STAFF_TEST_PERMISSIONS) {
      const key = `${resource}.${action}`;
      const perm = await Permission.findOneAndUpdate(
        { key },
        { key, name: key, resource, action, isActive: true },
        { upsert: true, new: true }
      );
      permissionIds.push(perm._id);
    }
    await Staff.create({ user: user._id, name: `Test Staff ${Date.now()}`, permissions: permissionIds });
  }

  const token = user.generateAccessToken();
  return `Bearer ${token}`;
};

export { app };