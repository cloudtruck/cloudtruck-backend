import 'dotenv/config';
import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema({
  bookingId: String,
  lrPdf: {
    cloudinaryId: String,
    url: String,
    generatedAt: Date
  },
  lrDetails: {
    lrNumber: String
  }
}, { strict: false });

const Booking = mongoose.model('Booking', BookingSchema);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Search by the UUID in the URL
    const uuid = '4c68eabd-dcc8-4328-8310-0dd66c5c62ad';
    const booking = await Booking.findOne({
      $or: [
        { 'lrPdf.url': { $regex: uuid } },
        { 'lrPdf.cloudinaryId': { $regex: uuid } },
        { bookingId: uuid }
      ]
    }).lean();

    if (booking) {
      console.log('Found Booking:', JSON.stringify(booking, null, 2));
    } else {
      console.log('No booking found matching UUID:', uuid);
      // Let's find any booking with lrPdf to see the pattern
      const sample = await Booking.findOne({ 'lrPdf.url': { $exists: true } }).lean();
      console.log('Sample Booking with lrPdf:', JSON.stringify(sample, null, 2));
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
