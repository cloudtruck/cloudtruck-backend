
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './src/models/user.model.js';

dotenv.config();

const updateRole = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const phone = process.argv[2];
        if (!phone) {
            console.error('Please provide a phone number: node fix-role.js 918459727003');
            process.exit(1);
        }

        const user = await User.findOne({ phone: phone });
        if (!user) {
            console.error('User not found');
            process.exit(1);
        }

        console.log(`Current user: ${user.phone}, Role: ${user.role}`);
        
        user.role = 'driver';
        user.status = 'active';
        await user.save();

        console.log(`User ${user.phone} updated to role: ${user.role}`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

updateRole();
