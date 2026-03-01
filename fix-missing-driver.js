import mongoose from 'mongoose';
import AuthService from './src/services/auth.service.js';
import User from './src/models/user.model.js';
import Driver from './src/models/driver.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function fix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const userId = '69a3fe60477635bc77fa7bab';
    const driver = await Driver.findOne({ user: userId });
    if (driver) {
       console.log('Found existing driver (maybe deleted). Resurrecting.');
       driver.isDeleted = false;
       await driver.save();
    } else {
       console.log('Creating missing driver profile...');
       await Driver.create({
         user: userId,
         name: 'New Driver',
         licenseNumber: 'PENDING',
         createdBy: userId
       });
    }
    console.log('SUCCESS: Driver profile fixed.');
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
fix();