import mongoose from 'mongoose';
import { config } from 'dotenv';
config();

const MONGODB_URI = process.env.MONGODB_URI;

async function migrate() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.collection('vehicles');

  const docs = await collection
    .find({ owner: { $exists: true, $ne: null }, 'ownerRef.item': { $exists: false } })
    .toArray();

  console.log(`Found ${docs.length} vehicles to migrate`);

  if (docs.length === 0) {
    console.log('Nothing to migrate.');
    await mongoose.disconnect();
    return;
  }

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { ownerRef: { kind: 'Driver', item: doc.owner } } },
    },
  }));

  const result = await collection.bulkWrite(ops);
  console.log(`Migrated ${result.modifiedCount} vehicles successfully`);

  await mongoose.disconnect();
  console.log('Done.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
