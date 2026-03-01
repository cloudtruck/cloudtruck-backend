import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Booking from './src/models/booking.model.js';
import Customer from './src/models/customer.model.js';
import User from './src/models/user.model.js';

dotenv.config();

async function debugAccess() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    // Handle potential unescaped characters in password
    let uri = mongoUri;
    if (uri && uri.includes('@')) {
        const authPart = uri.split('@')[0];
        const restPart = uri.split('@')[1];
        const protocol = authPart.split('://')[0];
        const userPass = authPart.split('://')[1];
        if (userPass && userPass.includes(':')) {
           const user = userPass.split(':')[0];
           const pass = userPass.split(':')[1];
           uri = protocol + '://' + encodeURIComponent(user) + ':' + encodeURIComponent(pass) + '@' + restPart;
        }
    }
    
    await mongoose.connect(uri);
    console.log('Connected');

    const booking = await Booking.findOne({}).sort({ createdAt: -1 });
    if (!booking) { console.log('No booking found'); process.exit(0); }

    const customerDocIdFromBooking = booking.customer.toString();
    const customerDoc = await Customer.findById(customerDocIdFromBooking);
    
    if (!customerDoc) {
      console.log('Customer profile not found for booking.customer ID:', customerDocIdFromBooking);
      process.exit(0);
    }

    const userDoc = await User.findById(customerDoc.user);
    
    console.log('--- DEBUG INFO ---');
    console.log('Booking ID:', booking._id);
    console.log('Booking.customer (Raw ID):', customerDocIdFromBooking);
    console.log('Customer Profile ID:', customerDoc._id.toString());
    console.log('Associated User ID:', userDoc?._id.toString());
    console.log('User Role:', userDoc?.role);
    
    // Simulate the check in booking.service.js
    // if (userRole === 'customer' && booking.customer._id.toString() !== customerDocId)
    const simulatedBookingIdStr = booking.customer._id ? booking.customer._id.toString() : booking.customer.toString();
    const result = simulatedBookingIdStr === customerDoc._id.toString();
    
    console.log('Does booking.customer match customer profile ID?', result);
    console.log('------------------');

    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
debugAccess();
