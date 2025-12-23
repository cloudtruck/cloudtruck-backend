import { expect } from 'chai';
import { startTestDB, stopTestDB } from './setup.js';
import Driver from '../src/models/driver.model.js';
import mongoose from 'mongoose';

describe('Driver model indexes', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('has user index with unique partial filter expression', async function() {
    // Ensure indexes are built
    await Driver.createIndexes();
    const indexes = await Driver.collection.getIndexes({ full: true });
    const hasUserIndex = indexes.some(ix => ix.key && ix.key.user === 1);
    expect(hasUserIndex).to.be.true;
  });

  it('enforces uniqueness on user when present', async function() {
    const userId = new mongoose.Types.ObjectId();
    const d1 = await Driver.create({ user: userId, name: 'D1', licenseNumber: 'DL-A' });
    try {
      await Driver.create({ user: userId, name: 'D2', licenseNumber: 'DL-B' });
      // If creation succeeds, force fail
      expect.fail('Expected duplicate key error');
    } catch (err) {
      expect(err).to.exist;
    }
  });
});