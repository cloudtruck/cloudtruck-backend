import mongoose from 'mongoose';
import Driver from './src/models/driver.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function fix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Fixing indexes...');
    await Driver.collection.dropIndex('licenseNumber_1');
    console.log('Index dropped. Mongoose will recreate it on next start with the updated partialFilterExpression.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
fix();