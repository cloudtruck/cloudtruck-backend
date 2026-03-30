
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/user.model.js';
import Staff from './src/models/staff.model.js';

dotenv.config();

async function checkAdmin() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  console.log('Connecting to:', mongoURI);
  await mongoose.connect(mongoURI);

  try {
    const adminUser = await User.findOne({ role: 'super-admin', isDeleted: false });
    if (!adminUser) {
      console.log('No super-admin user found.');
      return;
    }

    console.log('Found Admin User:', {
      id: adminUser._id,
      email: adminUser.email,
      role: adminUser.role
    });

    const staffProfile = await Staff.findOne({ user: adminUser._id });
    if (staffProfile) {
      console.log('Staff profile exists for this admin.');
    } else {
      console.log('WARNING: No Staff profile found for this admin user!');
      
      // Check if we should create it
      console.log('Creating staff profile for admin...');
      await Staff.create({
        user: adminUser._id,
        name: 'Admin User',
        department: 'management',
        title: 'Super Admin',
        isActive: true
      });
      console.log('Staff profile created successfully.');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkAdmin();
