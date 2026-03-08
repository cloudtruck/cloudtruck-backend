/**
 * seed-chat.js
 * Seeds conversations and messages for driver ↔ staff chat system.
 * Requires seed-demo.js to have been run first (needs seeded bookings + drivers).
 *
 * Run: node --env-file .env src/scripts/seed-chat.js
 * Clean + re-seed: node --env-file .env src/scripts/seed-chat.js --clean
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model.js';
import Driver from '../models/driver.model.js';
import Booking from '../models/booking.model.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';

const CLEAN = process.argv.includes('--clean');

// ─── Helpers ─────────────────────────────────────────────────────────────────
const hoursAgo = (n) => new Date(Date.now() - n * 3600000);
const minsAgo  = (n) => new Date(Date.now() - n * 60000);

// The two driver phones created by seed-demo.js
const DRIVER_PHONES = ['+919800100001', '+919800100002'];

// Conversation message threads per booking status
// Format: { text, fromDriver: bool, hoursBack }
const MESSAGE_THREADS = {
  assigned: [
    { text: 'Hello, I am assigned to your booking. Can you confirm the pickup address?', fromDriver: true,  hoursBack: 5 },
    { text: 'Yes, please come to Plot 12, Industrial Area Phase 1. Contact Ajay Sharma on 9712300005.', fromDriver: false, hoursBack: 4.8 },
    { text: 'Understood. I will reach the pickup point by tomorrow 10 AM.', fromDriver: true,  hoursBack: 4.5 },
    { text: 'Great, the goods are ready for loading. Please carry the LR form.', fromDriver: false, hoursBack: 4 },
    { text: 'Ok, noted. Will carry all documents.', fromDriver: true, hoursBack: 3.5 },
  ],
  'in-transit': [
    { text: 'I have loaded the goods and started the journey.', fromDriver: true,  hoursBack: 28 },
    { text: 'Good. Please update your location regularly. Expected delivery is tomorrow.', fromDriver: false, hoursBack: 27.5 },
    { text: 'Currently at Khandwa. On schedule.', fromDriver: true,  hoursBack: 22 },
    { text: 'Ok. Keep going. Customer is waiting at the destination.', fromDriver: false, hoursBack: 21.5 },
    { text: 'Reached Burhanpur. Taking a short break, will continue in 30 mins.', fromDriver: true,  hoursBack: 16 },
    { text: 'Please keep the break short, delivery deadline is tomorrow morning.', fromDriver: false, hoursBack: 15.8 },
    { text: 'Understood. Back on road now.', fromDriver: true, hoursBack: 15.3 },
    { text: 'Currently near Dhule. All going well.', fromDriver: true, hoursBack: 6 },
    { text: 'Noted. You should reach Mumbai by early morning. Contact Anita Desai on arrival.', fromDriver: false, hoursBack: 5.5 },
  ],
  'reached-destination': [
    { text: 'I have reached the destination. Waiting for unloading team.', fromDriver: true,  hoursBack: 8 },
    { text: 'Good work! The unloading team will be there in 30 mins. Please wait.', fromDriver: false, hoursBack: 7.5 },
    { text: 'Ok, waiting at the gate.', fromDriver: true,  hoursBack: 7.4 },
    { text: 'Unloading is complete. Please get the POD signed from Pooja Nair.', fromDriver: false, hoursBack: 4 },
    { text: 'POD signed. Do I upload it now?', fromDriver: true,  hoursBack: 3.5 },
    { text: 'Yes, please upload the POD photo from the app immediately.', fromDriver: false, hoursBack: 3.2 },
    { text: 'Uploaded. Please confirm receipt.', fromDriver: true, hoursBack: 2 },
  ],
  delivered: [
    { text: 'Delivery done. Goods unloaded successfully at Nagpur.', fromDriver: true,  hoursBack: 72 },
    { text: 'Thank you. Was the receiver available at the time of delivery?', fromDriver: false, hoursBack: 71.5 },
    { text: 'Yes, Rekha Shinde was present. She signed the receipt.', fromDriver: true,  hoursBack: 71 },
    { text: 'Perfect. The balance payment will be processed after POD verification.', fromDriver: false, hoursBack: 70 },
    { text: 'Okay, when can I expect the payment?', fromDriver: true,  hoursBack: 69 },
    { text: 'Within 2-3 working days after POD is approved by accounts team.', fromDriver: false, hoursBack: 68 },
    { text: 'Thanks for the update.', fromDriver: true, hoursBack: 67 },
  ],
  'pod-received': [
    { text: 'POD uploaded. Please confirm.', fromDriver: true,  hoursBack: 48 },
    { text: 'POD received and verified. Your payment is being processed.', fromDriver: false, hoursBack: 47 },
    { text: 'How long will the balance payment take?', fromDriver: true,  hoursBack: 46 },
    { text: 'The full payment of ₹15,000 has been initiated. You will receive it within 24 hours.', fromDriver: false, hoursBack: 45 },
    { text: 'Received. Thank you CloudTruck!', fromDriver: true, hoursBack: 24 },
    { text: 'Great working with you. We will assign you more loads soon.', fromDriver: false, hoursBack: 23 },
  ],
  closed: [
    { text: 'Trip completed. Will I get a review from the customer?', fromDriver: true,  hoursBack: 120 },
    { text: 'Yes, customer ratings are sent after trip closure. You have a 4.8 rating for this trip!', fromDriver: false, hoursBack: 119 },
    { text: 'That is great to hear. Happy to work with CloudTruck again.', fromDriver: true,  hoursBack: 118 },
    { text: 'We value your service. You will receive new load assignments soon. Stay online!', fromDriver: false, hoursBack: 117 },
  ],
};

async function seed() {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  await mongoose.connect(mongoURI);
  console.log('📦 Connected to MongoDB');

  // ── Clean existing chat data ───────────────────────────────────────────────
  if (CLEAN) {
    await Message.deleteMany({});
    await Conversation.deleteMany({});
    console.log('🧹 Cleaned all conversations and messages');
  }

  // ── 1. Find the two seeded driver users and mark them fully onboarded ───────
  const driverUsers = [];
  for (const phone of DRIVER_PHONES) {
    const user = await User.findOne({ phone, isDeleted: false });
    if (!user) {
      console.warn(`⚠️  Driver user not found for phone ${phone}. Run seed-demo.js first.`);
      continue;
    }
    const driver = await Driver.findOne({ user: user._id });
    if (!driver) {
      console.warn(`⚠️  Driver profile not found for user ${user._id}`);
      continue;
    }

    // Patch driver so Login.js routes to Tab (not onboarding screens)
    const needsPatch = driver.kycStatus !== 'verified' || driver.accountInfoStatus !== 'verified';
    if (needsPatch) {
      await Driver.findByIdAndUpdate(driver._id, {
        kycStatus: 'verified',
        accountInfoStatus: 'verified',
        'pan.number': `ABCDE100${driverUsers.length}F`,
        city: 'Indore',
        licenseNumber: `MP09-2018${String(driverUsers.length).padStart(7, '0')}`,
        'bankDetails.accountHolderName': driver.name || 'Driver',
        'bankDetails.accountNumber': `9000100000${driverUsers.length}`,
        'bankDetails.ifscCode': 'SBIN0001234',
        'bankDetails.bankName': 'State Bank of India',
      });
      // Refresh the driver object
      const updatedDriver = await Driver.findById(driver._id);
      driverUsers.push({ user, driver: updatedDriver });
      console.log(`✅  Patched driver ${driver.name || phone}: kycStatus=verified, accountInfoStatus=verified`);
    } else {
      driverUsers.push({ user, driver });
      console.log(`✅  Driver ${driver.name || phone} already onboarded`);
    }
  }

  if (driverUsers.length === 0) {
    console.error('❌  No driver users found. Run seed-demo.js first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  // ── 2. Find or create a staff user for the conversations ──────────────────
  let staffUser = await User.findOne({ role: { $in: ['staff', 'internal', 'super-admin'] }, isDeleted: false });
  if (!staffUser) {
    // Create a minimal staff user for seeding purposes
    staffUser = await User.create({
      phone: '+919900000001',
      name: 'CloudTruck Support',
      role: 'internal',
      status: 'active',
    });
    console.log('✅  Created staff user: CloudTruck Support');
  } else {
    console.log(`✅  Using staff user: ${staffUser.name || staffUser.phone} (${staffUser.role})`);
  }

  // ── 3. Find bookings with assigned drivers ─────────────────────────────────
  const driverDocIds = driverUsers.map(d => d.driver._id);
  const bookings = await Booking.find({
    driver: { $in: driverDocIds },
    status: { $in: ['assigned', 'in-transit', 'reached-destination', 'delivered', 'pod-received', 'closed'] },
    isDeleted: false,
  })
    .select('_id bookingId driver status pickup drop')
    .sort({ createdAt: -1 });

  if (bookings.length === 0) {
    console.error('❌  No assigned bookings found. Run seed-demo.js first.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`\n📋  Found ${bookings.length} bookings with assigned drivers`);

  // ── 4. Create conversations + messages ────────────────────────────────────
  let convCount = 0;
  let msgCount  = 0;

  for (const booking of bookings) {
    // Find which driver user is assigned to this booking
    const match = driverUsers.find(d => d.driver._id.equals(booking.driver));
    if (!match) continue;

    const driverUserId = match.user._id;
    const thread = MESSAGE_THREADS[booking.status];
    if (!thread) continue;

    // Skip if conversation already exists
    const existing = await Conversation.findOne({ booking: booking._id, driver: driverUserId });
    if (existing) {
      console.log(`   ⏭  Conversation already exists for ${booking.bookingId}`);
      continue;
    }

    const participants = [driverUserId, staffUser._id];

    // Create conversation
    const lastMsg = thread[thread.length - 1];
    const lastSender = lastMsg.fromDriver ? driverUserId : staffUser._id;

    const conversation = await Conversation.create({
      booking: booking._id,
      driver: driverUserId,
      participants,
      lastMessage: {
        text: lastMsg.text,
        sender: lastSender,
        sentAt: hoursAgo(lastMsg.hoursBack),
      },
      unreadCounts: new Map([
        [driverUserId.toString(), lastMsg.fromDriver ? 0 : 1],
        [staffUser._id.toString(), lastMsg.fromDriver ? 1 : 0],
      ]),
    });

    convCount++;
    console.log(`\n   ✅  Conversation created: ${booking.bookingId} [${booking.status}]`);
    console.log(`       ${booking.pickup?.city} → ${booking.drop?.city}`);

    // Create messages
    for (const msg of thread) {
      const sender = msg.fromDriver ? driverUserId : staffUser._id;
      const senderRole = msg.fromDriver ? 'driver' : 'internal';

      await Message.create({
        conversation: conversation._id,
        sender,
        senderRole,
        text: msg.text,
        status: 'read',
        createdAt: hoursAgo(msg.hoursBack),
        updatedAt: hoursAgo(msg.hoursBack),
      });
      msgCount++;
      console.log(`       💬  [${msg.fromDriver ? 'Driver' : 'Staff '}] ${msg.text.slice(0, 60)}...`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────');
  console.log(`✅  Chat seed complete!`);
  console.log(`   Conversations created : ${convCount}`);
  console.log(`   Messages created      : ${msgCount}`);
  console.log('\nDriver phones for testing:');
  for (const d of driverUsers) {
    console.log(`   ${d.driver.name || 'Driver'} — phone: ${d.user.phone}`);
  }
  console.log(`\nStaff user (admin panel): ${staffUser.name || staffUser.phone} (${staffUser.role})`);
  console.log('─────────────────────────────────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Chat seed failed:', err.message || err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
