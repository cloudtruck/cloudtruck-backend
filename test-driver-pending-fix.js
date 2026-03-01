import mongoose from 'mongoose';
import AuthService from './src/services/auth.service.js';
import User from './src/models/user.model.js';
import Driver from './src/models/driver.model.js';
import dotenv from 'dotenv';
dotenv.config();
async function go() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const p1 = '9999933333';
    const p2 = '9999944444';
    const oldUsers = await User.find({ phone: { $in: [p1, p2] } });
    await Driver.deleteMany({ user: { $in: oldUsers.map(u=>u._id) } }); 
    await User.deleteMany({ phone: { $in: [p1, p2] } });
    console.log('1. Start p1');
    await AuthService.mobileLogin(p1, 'driver');
    console.log('2. Start p2');
    await AuthService.mobileLogin(p2, 'driver');
    console.log('--- PASSED ---');
    const finalUsers = await User.find({ phone: { $in: [p1, p2] } });
    await Driver.deleteMany({ user: { $in: finalUsers.map(u=>u._id) } });
    await User.deleteMany({ phone: { $in: [p1, p2] } });
    process.exit(0);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }
}
go();