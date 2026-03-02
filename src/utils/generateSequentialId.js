import mongoose from 'mongoose';

/**
 * Atomically generates a sequential human-readable ID using a counters collection.
 * Retries up to 5 times if the generated ID already exists (handles counter resets).
 *
 * @param {Object} opts
 * @param {string} opts.counterKey  - Counter _id in the counters collection (e.g. 'booking')
 * @param {string} opts.collection  - MongoDB collection to check for uniqueness (e.g. 'bookings')
 * @param {string} opts.idField     - Field name to check (e.g. 'bookingId')
 * @param {string} opts.prefix      - ID prefix (e.g. 'BK', 'TIC')
 * @returns {Promise<string>}
 */
export async function generateSequentialId({ counterKey, collection, idField, prefix }) {
  const counters = mongoose.connection.collection('counters');
  const col = mongoose.connection.collection(collection);
  const date = new Date();
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await counters.findOneAndUpdate(
      { _id: counterKey },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = result ? result.seq : 1;
    const id = `${prefix}${year}${month}${String(seq).padStart(6, '0')}`;
    if (!await col.findOne({ [idField]: id })) return id;
  }

  // Fallback: timestamp suffix when counter is severely out of sync
  return `${prefix}${year}${month}${Date.now().toString().slice(-6)}`;
}
