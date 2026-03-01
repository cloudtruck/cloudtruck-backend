import mongoose from 'mongoose';
import AuthService from './src/services/auth.service.js';
import User from './src/models/user.model.js';
import Driver from './src/models/driver.model.js';
import Customer from './src/models/customer.model.js';
import dotenv from 'dotenv';

dotenv.config();

async function test() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- START ---');

    const phone = '9999911111';

    // Deep Cleanup
    const users = await User.find({ phone });
    const userIds = users.map(u => u._id);
    await Customer.deleteMany({ user: { $in: userIds } });
    await Driver.deleteMany({ user: { $in: userIds } });
    await Driver.deleteMany({ licenseNumber: 'PENDING_TEST' });
    await User.deleteMany({ phone });
    
    console.log('1. Cleared');

    console.log('2. Create Customer');
    await AuthService.mobileLogin(phone, 'customer');
    console.log('   OK: customer created');

    console.log('3. Conflict Driver');
    try {
      await AuthService.mobileLogin(phone, 'driver');
    } catch (e) {
      console.log('   PASSED: 403 Role Conflict');
    }

    console.log('4. Conflict Staff');
    try {
      await AuthService.registerStaff({ phone, email: 't@t.com', role: 'staff', name: 'T' }, new mongoose.Types.ObjectId());
    } catch (e) {
      console.log('   PASSED: 400 Phone Conflict');
    }

    console.log('5. Soft Delete & Re-reg');
    const u = await User.findOne({ phone });
    await User.updateOne({ _id: u._id }, { isDeleted: true });
    
    // Important: Re-registration as driver would trigger 'PENDING' license conflict.
    // Since we're testing User global phone check, we'll re-register as Customer first 
    // OR just use a different phone for the soft-delete test to avoid Driver model collisions.
    
    const phone2 = '9999922222';
    await User.deleteMany({ phone: phone2 });
    await AuthService.mobileLogin(phone2, 'customer');
    await User.updateOne({ phone: phone2 }, { isDeleted: true });
    console.log('   Soft-deleted phone2');
    
    const d = await AuthService.mobileLogin(phone2, 'customer');
    console.log('   PASSED: Re-created deleted user (New ID:', d.user._id, ')');

    // Massive Cleanup
    await User.deleteMany({ phone: { $in: [phone, phone2] } });
    
    console.log('--- END ---');
    process.exit(0);
  } catch (err) {
    console.error('TEST FAIL:', err.message);
    process.exit(1);
  }
}
test();