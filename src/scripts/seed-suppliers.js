/**
 * seed-suppliers.js
 *
 * Seeds 6 company Supplier records (replacing the old MasterData supplier entries)
 * and 2 individual Supplier records linked to existing seeded drivers.
 *
 * Run AFTER:  seed:fresh  (for org data)
 *             seed:transactional  (for drivers)
 *
 * Run:   node --env-file .env src/scripts/seed-suppliers.js
 * Clean: node --env-file .env src/scripts/seed-suppliers.js --clean
 *
 * Idempotent: finds existing records by phone / driver ref before creating.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User     from '../models/user.model.js';
import Driver   from '../models/driver.model.js';
import Vehicle  from '../models/vehicle.model.js';
import Supplier from '../models/supplier.model.js';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
const isClean   = process.argv.includes('--clean');

// Known seeded driver license numbers (from seed-transactional.js)
const KNOWN_LICENSE_NUMBERS = [
  'MH0120230012345',
  'DL0120220054321',
  'GJ0120230078901',
  'KA0120210098765',
  'TN0120220043210',
];

// Company supplier data (mirrors old MasterData entries, now proper entities)
const COMPANY_SUPPLIERS = [
  {
    displayName: 'FastMove Logistics',
    companyName: 'FastMove Logistics Pvt. Ltd.',
    phone: '9876543210',
    email: 'ops@fastmove.in',
    city: 'Mumbai',
    gstin: '27AABCF1234A1Z5',
    bankDetails: { accountNumber: '1234567890', ifscCode: 'HDFC0001234', accountHolderName: 'FastMove Logistics Pvt Ltd', bankName: 'HDFC Bank' },
  },
  {
    displayName: 'SpeedCargo Ltd',
    companyName: 'SpeedCargo Transport Ltd.',
    phone: '9812345678',
    email: 'info@speedcargo.in',
    city: 'Delhi',
    gstin: '07AABCS5678B1Z3',
    bankDetails: { accountNumber: '2345678901', ifscCode: 'ICIC0002345', accountHolderName: 'SpeedCargo Transport Ltd', bankName: 'ICICI Bank' },
  },
  {
    displayName: 'Bharat Transport Co.',
    companyName: 'Bharat Transport Company',
    phone: '9823456789',
    email: 'contact@bharattransport.in',
    city: 'Ahmedabad',
    gstin: '24AABCB9012C1Z1',
    bankDetails: { accountNumber: '3456789012', ifscCode: 'SBIN0003456', accountHolderName: 'Bharat Transport Company', bankName: 'State Bank of India' },
  },
  {
    displayName: 'Shree Ganesh Carriers',
    companyName: 'Shree Ganesh Carriers Pvt. Ltd.',
    phone: '9845678901',
    email: 'ops@shreeganesh.in',
    city: 'Hyderabad',
    gstin: '36AABCS3456D1Z7',
    bankDetails: { accountNumber: '4567890123', ifscCode: 'AXIS0004567', accountHolderName: 'Shree Ganesh Carriers Pvt Ltd', bankName: 'Axis Bank' },
  },
  {
    displayName: 'National Road Lines',
    companyName: 'National Road Lines Pvt. Ltd.',
    phone: '9867890123',
    email: 'admin@nationalroad.in',
    city: 'Delhi',
    gstin: '07AABCN7890E1Z2',
    bankDetails: { accountNumber: '5678901234', ifscCode: 'KOTAK0005678', accountHolderName: 'National Road Lines Pvt Ltd', bankName: 'Kotak Mahindra Bank' },
  },
  {
    displayName: 'Southern Express',
    companyName: 'Southern Express Freight Solutions',
    phone: '9834567890',
    email: 'support@southernexpress.in',
    city: 'Chennai',
    gstin: '33AABCS1234F1Z4',
    bankDetails: { accountNumber: '6789012345', ifscCode: 'HDFC0006789', accountHolderName: 'Southern Express Freight Solutions', bankName: 'HDFC Bank' },
  },
];

// Assignment map: company index → driver license number(s)
// Based on 5 available seeded drivers split across 4 companies
const FLEET_ASSIGNMENTS = {
  0: ['MH0120230012345', 'DL0120220054321'],   // FastMove gets 2 drivers
  1: ['GJ0120230078901'],                       // SpeedCargo gets 1
  2: ['KA0120210098765'],                       // Bharat gets 1
  3: ['TN0120220043210'],                       // Shree Ganesh gets 1
  // indices 4 & 5 (National Road Lines, Southern Express) have no employees yet
};

// Individual supplier drivers (by license number)
// These drivers become individual suppliers while keeping role:'driver'
const INDIVIDUAL_SUPPLIER_LICENSES = [];
// No individual suppliers in this seed — all 5 drivers are assigned to companies.
// Add license numbers here if you want individual suppliers.

async function clean() {
  console.log('🧹 Cleaning supplier seed data...');

  // Remove company supplier Users
  const phoneList = COMPANY_SUPPLIERS.map(s => s.phone);
  const users = await User.find({ phone: { $in: phoneList } });
  const userIds = users.map(u => u._id);

  await User.deleteMany({ _id: { $in: userIds } });
  await Supplier.deleteMany({ $or: [{ user: { $in: userIds } }, { supplierType: 'individual' }] });

  // Reset driver fields that were set by this seed
  await Driver.updateMany(
    { licenseNumber: { $in: KNOWN_LICENSE_NUMBERS } },
    { $set: { supplierOwner: null, driverRole: 'individual', isApprovedBySupplier: true } }
  );
  await Vehicle.updateMany({}, { $set: { supplierOwner: null } });

  console.log('✅ Clean complete.\n');
}

async function seedCompanySuppliers() {
  console.log('\n── Company Suppliers ─────────────────────────────────────');
  const created = [];

  for (const data of COMPANY_SUPPLIERS) {
    let supplier = await Supplier.findOne({ displayName: data.displayName, isDeleted: false });

    if (supplier) {
      console.log(`  ↩  ${data.displayName} already exists`);
      created.push(supplier);
      continue;
    }

    // Create User for company owner
    let user = await User.findOne({ phone: data.phone, isDeleted: false });
    if (!user) {
      user = await User.create({
        phone: data.phone,
        email: data.email,
        role: 'supplier',
        status: 'active',
      });
    }

    supplier = await Supplier.create({
      supplierType: 'company',
      user: user._id,
      displayName: data.displayName,
      companyName: data.companyName,
      gstin: data.gstin,
      phone: data.phone,
      email: data.email,
      city: data.city,
      bankDetails: data.bankDetails,
      verificationStatus: 'verified',
      verifiedAt: new Date(),
    });

    console.log(`  ✔  Created: ${data.displayName} (${data.city})`);
    created.push(supplier);
  }

  return created;
}

async function assignFleet(companySuppliers) {
  console.log('\n── Fleet Assignments ─────────────────────────────────────');

  for (const [idx, licenseNumbers] of Object.entries(FLEET_ASSIGNMENTS)) {
    const supplier = companySuppliers[parseInt(idx)];
    if (!supplier) continue;

    for (const license of licenseNumbers) {
      const driver = await Driver.findOne({ licenseNumber: license });
      if (!driver) {
        console.log(`  ⚠  Driver not found: ${license}`);
        continue;
      }

      if (driver.supplierOwner && !driver.supplierOwner.equals(supplier._id)) {
        console.log(`  ⚠  ${license} already attached to another supplier — skipping`);
        continue;
      }

      driver.supplierOwner = supplier._id;
      driver.driverRole = 'employee';
      driver.isApprovedBySupplier = true;
      await driver.save();

      // Set supplierOwner on driver's vehicles
      const vehicleCount = await Vehicle.countDocuments({ owner: driver._id, isDeleted: false });
      await Vehicle.updateMany(
        { owner: driver._id, isDeleted: false },
        { supplierOwner: supplier._id }
      );

      // Increment fleet stats
      await Supplier.findByIdAndUpdate(supplier._id, {
        $inc: {
          'fleetStats.totalDrivers': 1,
          'fleetStats.activeDrivers': driver.availability === 'available' ? 1 : 0,
        },
      });

      console.log(`  ✔  ${license} → ${supplier.displayName} (${vehicleCount} vehicle(s) updated)`);
    }
  }
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('📦 Connected to MongoDB\n');

  if (isClean) {
    await clean();
    await mongoose.disconnect();
    process.exit(0);
  }

  const companySuppliers = await seedCompanySuppliers();
  await assignFleet(companySuppliers);

  console.log('\n✅ Supplier seed complete.\n');
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
