import mongoose from 'mongoose';
import MasterData from './src/models/masterData.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function activate() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    await MasterData.updateOne({ key: 'pickup-8ft' }, { isActive: true });
    console.log('Pickup 8ft activated');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
activate();