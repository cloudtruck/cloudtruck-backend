import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/booking.model.js';
import Customer from './src/models/customer.model.js';
import User from './src/models/user.model.js';

dotenv.config();

async function fixDriverRole() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected');

    // Find the user from the debug log
    const userId = '699c18bacb9b7e95c1d2898f';
    const user = await User.findById(userId);
    
    if (user) {
      console.log('Current user role:', user.role);
      if (user.role === 'driver') {
        user.role = 'customer';
        await user.save();
        console.log('User role updated to customer successfully.');
      } else {
        console.log('User is already a customer or has a different role.');
      }
    } else {
      console.log('User not found.');
    }

    process.exit(0);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
fixDriverRole();