import mongoose from 'mongoose';
import MasterData from './src/models/masterData.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function checkTruck() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const truckTypes = await MasterData.find({ category: 'truck-type' });
    console.log('Available Truck Types:');
    truckTypes.forEach(t => console.log('- Key:', t.key, '| Active:', t.isActive));
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
checkTruck();