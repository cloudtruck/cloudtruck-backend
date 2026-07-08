import mongoose from 'mongoose';
import dotenv from 'dotenv';
import OrganizationSettings from '../models/organizationSettings.model.js';

dotenv.config();

const seedCompanyDetails = async () => {
  console.log('Seeding company details into OrganizationSettings...');

  const settings = await OrganizationSettings.getInstance();

  settings.companyName = 'Cloud Truck Pvt Ltd';
  settings.gstNumber = '24AANCC5682Q1ZU';
  settings.panNumber = 'AANCC5682Q';
  settings.cinNumber = 'U52290GJ2026PTC173772';
  settings.companyAddress = {
    street: '3rd Floor, Block A, Surya Shreeji 66, Motera Road, Near Motera Temple',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380005',
    country: 'India',
  };
  settings.contactDetails = {
    ...(settings.contactDetails?.toObject?.() ?? settings.contactDetails ?? {}),
    phone: '+91 91655 96666',
    email: 'supply@cloudtruck.in',
  };
  settings.bank = {
    accountName: 'CLOUD TRUCK PVT LTD',
    accountNo: '771305000395',
    name: 'ICICI Bank',
    ifsc: 'ICIC0004611',
    branch: 'Motera Road'
  };

  const primaryAddress = {
    name: 'Head Office',
    address: '3rd Floor, Block A, Surya Shreeji 66, Motera Road, Near Motera Temple',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380005',
    country: 'India',
    gstin: '24AANCC5682Q1ZU',
    pan: 'AANCC5682Q',
    series: 'CTPL/07', // CTPL = Cloud Truck Pvt Ltd, 07 = branch code
    isPrimary: true,
    isActive: true,
  };

  const existingIndex = settings.addresses.findIndex((a) => a.series === 'CTPL/07');
  if (existingIndex >= 0) {
    Object.assign(settings.addresses[existingIndex], primaryAddress);
  } else {
    settings.addresses.forEach((a) => { a.isPrimary = false; });
    settings.addresses.push(primaryAddress);
  }

  await settings.save();

  console.log('✅ Company details seeded successfully');
  console.log({
    companyName: settings.companyName,
    gstNumber: settings.gstNumber,
    panNumber: settings.panNumber,
    cinNumber: settings.cinNumber,
    companyAddress: settings.companyAddress,
    lrSeries: primaryAddress.series,
  });
};

const seed = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
    await mongoose.connect(mongoURI);
    console.log('📦 Connected to MongoDB');

    await seedCompanyDetails();

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding company details:', err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

seed();
