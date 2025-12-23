import connectDB from '../config/database.js';
import mongoose from 'mongoose';
import Driver from '../models/driver.model.js';
import logger from '../utils/logger.js';

const findDuplicates = async () => {
  const dupAgg = await Driver.aggregate([
    { $match: { user: { $exists: true } } },
    { $group: { _id: '$user', count: { $sum: 1 }, docs: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } }
  ]);
  return dupAgg;
};

const markExtraDeleted = async (docsToRemove, adminUserId) => {
  for (const id of docsToRemove) {
    await Driver.updateOne({ _id: id }, { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: adminUserId } });
    logger.info(`Marked driver ${id} as deleted`);
  }
};

const main = async () => {
  await connectDB();

  const duplicates = await findDuplicates();

  if (duplicates.length === 0) {
    logger.info('No duplicate drivers by user found');
  } else {
    logger.warn('Found duplicate driver groups by user:');
    console.dir(duplicates, { depth: 5 });

    if (process.argv.includes('--fix')) {
      const adminUserId = process.env.ADMIN_USER_ID;
      if (!adminUserId) {
        logger.error('To auto-fix duplicates set ADMIN_USER_ID environment variable to the admin performing the cleanup');
        process.exit(1);
      }

      for (const group of duplicates) {
        // Keep the first doc, delete others
        const [keep, ...others] = group.docs;
        logger.info(`Keeping ${keep}, removing ${others.length} duplicates`);
        await markExtraDeleted(others, adminUserId);
      }
    } else {
      logger.info('Run with --fix and set ADMIN_USER_ID to automatically mark duplicates as deleted');
    }
  }

  // Try to create the index (will error if duplicates exist)
  try {
    await Driver.collection.createIndex({ user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });
    logger.info('Created/ensured index on drivers.user');
  } catch (err) {
    logger.error('Failed to create index on drivers.user. Resolve duplicates first. Error:', err.message);
  }

  await mongoose.connection.close();
  process.exit(0);
};

main().catch(err => {
  logger.error('Script failed:', err);
  process.exit(1);
});