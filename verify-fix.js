import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/user.model.js';

dotenv.config();

async function verifyFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const userId = '699c18bacb9b7e95c1d2898f';
    const user = await User.findById(userId);
    
    if (user) {
      console.log('User ID:', user._id);
      console.log('User Phone:', user.phone);
      console.log('User Role:', user.role);
      
      if (user.role === 'customer') {
        console.log('SUCCESS: User role is verified as customer.');
      } else {
        console.log('FAILURE: User role is still', user.role);
      }
    } else {
      console.log('User not found.');
    }

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
verifyFix();