import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import User from '../src/models/user.model.js';

let mongoServer;

export const startTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
};

export const stopTestDB = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

export const makeAuthHeaderForRole = async (role) => {
  const data = { role, status: 'active' };
  // driver/customer roles require phone
  if (['customer', 'driver'].includes(role)) {
    data.phone = `+1555${Date.now().toString().slice(-7)}`;
  }
  const user = await User.create(data);
  const token = user.generateAccessToken();
  return `Bearer ${token}`;
};

export { app };