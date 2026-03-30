/**
 * clear-data.js
 *
 * Drops all transactional + entity collections while preserving:
 *   - users            (login accounts — explicitly kept)
 *   - organizationSettings (company config — explicitly kept)
 *   - refreshTokens    (active sessions — explicitly kept)
 *
 * Also wipes reference collections that will be fully re-seeded
 * by seed-fresh.js immediately after:
 *   - permissions, roleTemplates, masterData, marketRates,
 *     accounts, branches, staff
 *
 * Run: node --env-file .env src/scripts/clear-data.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Collections to drop (transactional + entity + stale reference data)
const COLLECTIONS_TO_DROP = [
  // Entity data (will be re-seeded fresh)
  'permissions',
  'roletemplates',
  'masterdatas',
  'marketrates',
  'accounts',
  'branches',
  'staffs',

  // Transactional / operational data
  'bookings',
  'customers',
  'drivers',
  'vehicles',
  'payments',
  'documents',
  'ewaybills',
  'trackings',
  'notifications',
  'auditlogs',
  'conversations',
  'messages',
  'wallets',
  'supporttickets',
  'routes',

  // Auto-generated counters (reset so bookingId starts from BK001 again)
  'counters',
];

// Collections explicitly preserved (never touched)
const PRESERVED = ['users', 'organizationsettings', 'refreshtokens'];

const run = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              CLOUDTRUCK — CLEAR DATA                ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log('⚠️  This will permanently delete the listed collections.');
  console.log('    Preserved: users, organizationsettings, refreshtokens\n');

  await mongoose.connect(mongoURI);
  console.log('📦 Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const existingCollections = (await db.listCollections().toArray()).map(c => c.name.toLowerCase());

  let dropped = 0;
  let skipped = 0;

  for (const col of COLLECTIONS_TO_DROP) {
    if (PRESERVED.includes(col)) {
      console.log(`  🔒 Preserved (skipped): ${col}`);
      skipped++;
      continue;
    }
    if (!existingCollections.includes(col)) {
      console.log(`  ⬜ Not found (skipped): ${col}`);
      skipped++;
      continue;
    }
    await db.collection(col).drop();
    console.log(`  🗑️  Dropped: ${col}`);
    dropped++;
  }

  console.log(`\n✅ Done. Dropped: ${dropped}  Skipped/not-found: ${skipped}`);
  console.log('\n📝 Next step: node --env-file .env src/scripts/seed-fresh.js\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
