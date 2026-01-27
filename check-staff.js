/**
 * Quick script to check staff records in database
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';

async function checkStaff() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check Staff collection
    const staffCount = await mongoose.connection.db.collection('staffs').countDocuments();
    console.log(`\n📊 Total Staff records: ${staffCount}`);

    const activeStaff = await mongoose.connection.db.collection('staffs').countDocuments({ isDeleted: false });
    console.log(`✓ Active Staff: ${activeStaff}`);

    const deletedStaff = await mongoose.connection.db.collection('staffs').countDocuments({ isDeleted: true });
    console.log(`🗑️  Deleted Staff: ${deletedStaff}`);

    // Get sample staff records
    const staffRecords = await mongoose.connection.db.collection('staffs')
      .find({ isDeleted: false })
      .limit(5)
      .toArray();

    console.log('\n📋 Sample Staff Records:');
    staffRecords.forEach((staff, index) => {
      console.log(`\n${index + 1}. ${staff.name || 'N/A'}`);
      console.log(`   ID: ${staff._id}`);
      console.log(`   User ID: ${staff.user || 'N/A'}`);
      console.log(`   Department: ${staff.department || 'N/A'}`);
      console.log(`   Title: ${staff.title || 'N/A'}`);
      console.log(`   Active: ${staff.isActive}`);
      console.log(`   Created: ${staff.createdAt}`);
    });

    // Check Users with staff role
    const userCount = await mongoose.connection.db.collection('users').countDocuments({ 
      role: { $in: ['staff', 'internal', 'super-admin'] },
      isDeleted: false 
    });
    console.log(`\n👥 Users with staff roles: ${userCount}`);

    // Check for users without staff profiles
    const staffUserIds = staffRecords.map(s => s.user?.toString());
    const staffUsers = await mongoose.connection.db.collection('users')
      .find({ 
        role: { $in: ['staff', 'internal', 'super-admin'] },
        isDeleted: false 
      })
      .toArray();

    console.log('\n🔍 User-Staff Profile Mapping:');
    staffUsers.forEach((user, index) => {
      const hasProfile = staffUserIds.includes(user._id.toString());
      console.log(`${index + 1}. ${user.email} - Role: ${user.role} - Has Profile: ${hasProfile ? '✓' : '✗'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

checkStaff();
