import mongoose from 'mongoose';
import User from './src/models/user.model.js';
import Driver from './src/models/driver.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function check() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const phone = '918208397400';
    const user = await User.findOne({ phone, isDeleted: false });
    if (user) {
      console.log('User found:', user._id, user.role);
      const driver = await Driver.findOne({ user: user._id, isDeleted: false });
      if (driver) {
        console.log('Driver found:', driver._id, driver.licenseNumber);
      } else {
        console.log('Driver NOT found for this user!');
      }
    } else {
      console.log('User NOT found!');
    }
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
check();