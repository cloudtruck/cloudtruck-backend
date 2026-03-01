import mongoose from 'mongoose';
import AuthService from './src/services/auth.service.js';
import User from './src/models/user.model.js';
import Driver from './src/models/driver.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function go() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const phone = '9999955555';
    const oldUsers = await User.find({ phone });
    await Driver.deleteMany({ user: { $in: oldUsers.map(u=>u._id) } }); 
    await User.deleteMany({ phone });
    
    await AuthService.mobileLogin(phone, 'driver');
    const u = await User.findOne({ phone });
    const d = await Driver.findOne({ user: u._id });
    if (d) console.log('CREATED'); else console.log('MISSING');

    await User.deleteMany({ phone });
    await Driver.deleteMany({ user: u._id });
    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
go();