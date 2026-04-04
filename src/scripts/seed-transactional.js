/**
 * seed-transactional.js
 *
 * Seeds realistic transactional data for CloudTruck demo/testing.
 * Covers every tab in the Trips page + Indents page.
 *
 * Creates:
 *   - 4 Customer users + Customer profiles
 *   - 4 Staff users + Staff profiles (ops manager, traffic controller, supervisor, finance)
 *   - 5 Driver users + Driver profiles (all verified)
 *   - 5 Vehicles (all verified/active)
 *   - 20 Bookings covering every status:
 *       created (Available tab), under-review (S Approval), assigned (Confirmed),
 *       driver-en-route, reached-pickup, loaded (Loading tab),
 *       in-transit (Intransit O), reached-destination (Intransit I / Unloading),
 *       delivered (POD Pending), pod-received (POD Received),
 *       closed, cancelled
 *   - All 3 bookingTypes: indent, direct-load, direct-invoice
 *   - New Digitify fields: customerPrice, supplierPrice, laneCode, loadType,
 *       trafficController, supervisor, supplier, exim, isAdhoc
 *   - GPS tracking points for in-transit bookings
 *   - LR details for assigned+ bookings
 *   - POD details for delivered/pod-received/closed bookings
 *   - Payment records (advance + balance)
 *
 * Run:    node --env-file .env src/scripts/seed-transactional.js
 * Clean:  node --env-file .env src/scripts/seed-transactional.js --clean
 *
 * Idempotent: uses SEED_TAG to identify and remove prior run's data.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User      from '../models/user.model.js';
import Customer  from '../models/customer.model.js';
import Driver    from '../models/driver.model.js';
import Vehicle   from '../models/vehicle.model.js';
import Staff     from '../models/staff.model.js';
import Booking   from '../models/booking.model.js';
import Supplier  from '../models/supplier.model.js';

// ─── Tag for idempotent cleanup ───────────────────────────────────────────────
const SEED_TAG = 'SEED_TRANS_V1';
const PHONE_PREFIX = '9100'; // 4-digit numeric prefix for generated phone numbers

// ─── Helpers ──────────────────────────────────────────────────────────────────
const section = (title) => {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(64));
};

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);
const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000);

// Build a GeoJSON Point; coordinates are [lng, lat]
const pt = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] });

// ─── City coordinate lookup [lng, lat] ────────────────────────────────────────
const COORDS = {
  Mumbai:    [72.8777, 19.0760],
  Delhi:     [77.2090, 28.6139],
  Bangalore: [77.5946, 12.9716],
  Chennai:   [80.2707, 13.0827],
  Ahmedabad: [72.5714, 23.0225],
  Pune:      [73.8567, 18.5204],
  Hyderabad: [78.4867, 17.3850],
  Kolkata:   [88.3639, 22.5726],
};

// ─── Address helpers ───────────────────────────────────────────────────────────
const addr = (city, address, state, pincode, contactName = 'Site Manager', contactPhone = '9000000000') => ({
  city,
  state,
  address,
  pincode,
  contactPerson: { name: contactName, phone: contactPhone },
  location: pt(...COORDS[city]),
});

// ─── Suppliers (resolved from Supplier collection by displayName) ─────────────
// Populated at runtime by resolveSuppliers(). Maps index 0-5 to ObjectIds.
// Index:  0=FastMove, 1=SpeedCargo, 2=Bharat, 3=ShreeGanesh, 4=NationalRoad, 5=Southern
let SUPPLIERS = [];

async function resolveSuppliers() {
  const names = [
    'FastMove Logistics',
    'SpeedCargo Ltd',
    'Bharat Transport Co.',
    'Shree Ganesh Carriers',
    'National Road Lines',
    'Southern Express',
  ];
  SUPPLIERS = await Promise.all(
    names.map(async (name) => {
      const s = await Supplier.findOne({ displayName: name, isDeleted: false });
      if (!s) {
        console.warn(`  ⚠  Supplier not found: "${name}" — run seed:suppliers first. Using null.`);
        return null;
      }
      return s._id;
    })
  );
}

// ─── Lane codes (from seed-fresh.js) ──────────────────────────────────────────
const LANES = {
  MUM_DEL: 'mum-del-ln01',
  MUM_BLR: 'mum-blr-ln01',
  DEL_HYD: 'del-hyd-ln01',
  BLR_CHE: 'blr-che-ln01',
  MUM_PUN: 'mum-pun-ln01',
  AHM_DEL: 'ahm-del-ln01',
  MUM_KOL: 'mum-kol-ln01',
  DEL_KOL: 'del-kol-ln01',
};

// Known vehicle/license numbers for hard-fallback cleanup
const KNOWN_VEHICLE_NUMBERS  = ['MH12AB1001','DL08AB2002','GJ01BZ3003','KA03CD4004','TN09EF5005'];
const KNOWN_LICENSE_NUMBERS  = ['MH0120230012345','DL0120220054321','GJ0120230078901','KA0120210098765','TN0120220043210'];

// ══════════════════════════════════════════════════════════════════════════════
// CLEAN
// ══════════════════════════════════════════════════════════════════════════════
const cleanPrevious = async () => {
  section('Cleaning previous seed data');

  // Hard-delete any leftover vehicles/drivers by known identifiers (handles partial prior failures)
  await Vehicle.deleteMany({ vehicleNumber: { $in: KNOWN_VEHICLE_NUMBERS } });
  await Driver.deleteMany({ licenseNumber: { $in: KNOWN_LICENSE_NUMBERS } });

  // Find user IDs tagged with SEED_TAG via email pattern
  const taggedUsers = await User.find({
    email: new RegExp(`\\+${SEED_TAG}@`, 'i'),
    isDeleted: false
  }).lean();

  const userIds = taggedUsers.map(u => u._id);
  const emails  = taggedUsers.map(u => u.email);

  if (userIds.length === 0) {
    console.log('  No prior seed data found — nothing to clean.');
    return;
  }

  // Remove dependent records first
  const customers = await Customer.find({ user: { $in: userIds } }).lean();
  const drivers   = await Driver.find({ user: { $in: userIds } }).lean();
  const staff     = await Staff.find({ user: { $in: userIds } }).lean();

  const customerIds = customers.map(c => c._id);
  const driverIds   = drivers.map(d => d._id);

  await Vehicle.deleteMany({ owner: { $in: driverIds } });
  await Booking.deleteMany({ customer: { $in: customerIds } });
  await Customer.deleteMany({ user: { $in: userIds } });
  await Driver.deleteMany({ user: { $in: userIds } });
  await Staff.deleteMany({ user: { $in: userIds } });
  await User.deleteMany({ _id: { $in: userIds } });

  console.log(`  Removed ${userIds.length} users and all dependent records.`);
};

// ══════════════════════════════════════════════════════════════════════════════
// SEED STAFF
// ══════════════════════════════════════════════════════════════════════════════
const seedStaff = async () => {
  section('Seeding Staff');

  const staffDefs = [
    { email: `ops.manager+${SEED_TAG}@cloudtruck.demo`,    name: 'Arjun Mehta',     department: 'ops',     title: 'Operations Manager' },
    { email: `traffic.ctrl+${SEED_TAG}@cloudtruck.demo`,   name: 'Priya Sharma',    department: 'ops',     title: 'Traffic Controller' },
    { email: `supervisor+${SEED_TAG}@cloudtruck.demo`,     name: 'Vikram Singh',    department: 'ops',     title: 'Supervisor' },
    { email: `finance.exec+${SEED_TAG}@cloudtruck.demo`,   name: 'Neha Gupta',      department: 'finance', title: 'Finance Executive' },
  ];

  const staffRecords = [];
  for (const s of staffDefs) {
    const user = await User.create({
      email: s.email,
      password: 'Staff@123',
      role: 'staff',
      status: 'active',
      phone: null,
    });
    const staffMember = await Staff.create({
      user:       user._id,
      name:       s.name,
      department: s.department,
      title:      s.title,
      isActive:   true,
    });
    staffRecords.push({ user, staff: staffMember, ...s });
    console.log(`  ✔ Staff: ${s.name} (${s.title})`);
  }

  return {
    opsManager:       staffRecords[0],
    trafficController: staffRecords[1],
    supervisor:        staffRecords[2],
    financeExec:       staffRecords[3],
  };
};

// ══════════════════════════════════════════════════════════════════════════════
// SEED CUSTOMERS
// ══════════════════════════════════════════════════════════════════════════════
const seedCustomers = async (staff) => {
  section('Seeding Customers');

  const customerDefs = [
    {
      phone: `+91901${PHONE_PREFIX}01`,
      email: `cust.reliance+${SEED_TAG}@cloudtruck.demo`,
      companyName: 'Reliance Retail Ltd',
      companyType: 'private_limited',
      gst: '27AABCR1234E1Z5',
      paymentTerms: 'credit',
      creditLimit: 2000000,
      customerType: 'Shipper',
      city: 'Mumbai',
      pan: 'AABCR1234E',
      materialType: 'FMCG',
      contactName: 'Rohit Bansal',
      contactPhone: '+919011112222',
    },
    {
      phone: `+91901${PHONE_PREFIX}02`,
      email: `cust.tata+${SEED_TAG}@cloudtruck.demo`,
      companyName: 'Tata Steel Ltd',
      companyType: 'private_limited',
      gst: '21AADCT1234F1Z3',
      paymentTerms: 'postpaid',
      creditLimit: 5000000,
      customerType: 'Shipper',
      city: 'Kolkata',
      pan: 'AADCT1234F',
      materialType: 'steel',
      contactName: 'Suresh Iyer',
      contactPhone: '+919022223333',
    },
    {
      phone: `+91901${PHONE_PREFIX}03`,
      email: `cust.infosys+${SEED_TAG}@cloudtruck.demo`,
      companyName: 'Infosys Logistics Pvt Ltd',
      companyType: 'private_limited',
      gst: '29AABCI1234G1Z1',
      paymentTerms: 'prepaid',
      creditLimit: 0,
      customerType: 'Consignee',
      city: 'Bangalore',
      pan: 'AABCI1234G',
      materialType: 'electronics',
      contactName: 'Anjali Desai',
      contactPhone: '+919033334444',
    },
    {
      phone: `+91901${PHONE_PREFIX}04`,
      email: `cust.pharma+${SEED_TAG}@cloudtruck.demo`,
      companyName: 'Sun Pharma Distributors',
      companyType: 'proprietorship',
      gst: '24AABCS1234H1Z2',
      paymentTerms: 'credit',
      creditLimit: 1000000,
      customerType: 'Shipper',
      city: 'Ahmedabad',
      pan: 'AABCS1234H',
      materialType: 'pharma',
      contactName: 'Dinesh Shah',
      contactPhone: '+919044445555',
    },
  ];

  const records = [];
  for (const c of customerDefs) {
    const user = await User.create({
      phone:  c.phone,
      email:  c.email,
      role:   'customer',
      status: 'active',
    });
    const customer = await Customer.create({
      user:         user._id,
      companyName:  c.companyName,
      companyType:  c.companyType,
      gst:          c.gst,
      contactPerson: { name: c.contactName, phone: c.contactPhone },
      paymentTerms: c.paymentTerms,
      creditLimit:  { amount: c.creditLimit, currency: 'INR', utilized: 0 },
      customerType: c.customerType,
      customerCode: `CC${String(records.length + 1).padStart(3, '0')}`,
      materialType: c.materialType,
      pan:          c.pan,
      isVerified:   true,
      verifiedAt:   daysAgo(30),
      accountManager: staff.opsManager.staff._id,
      address: {
        city:  c.city,
        state: cityToState(c.city),
      },
      bankDetails: [{
        accountNumber:     `1234567890${records.length + 1}`,
        ifscCode:          'HDFC0001234',
        accountHolderName: c.companyName,
        bankName:          'HDFC Bank',
        accountType:       'current',
        isPrimary:         true,
      }],
    });
    records.push({ user, customer, ...c });
    console.log(`  ✔ Customer: ${c.companyName}`);
  }

  return records;
};

// ══════════════════════════════════════════════════════════════════════════════
// SEED DRIVERS + VEHICLES
// ══════════════════════════════════════════════════════════════════════════════
const seedDriversAndVehicles = async () => {
  section('Seeding Drivers & Vehicles');

  const driverDefs = [
    {
      phone: `+91801${PHONE_PREFIX}01`,
      name: 'Ramesh Kumar Yadav',
      licenseNumber: 'MH0120230012345',
      city: 'Mumbai',
      preferredTruckTypes: ['container-20ft', 'container-32ft'],
      // own — Cloudtruck owns this truck, driver operates it
      vehicle: {
        vehicleNumber: 'MH12AB1001',
        ownershipType: 'own',
        truckType: 'container-20ft',
        bodyType: 'container',
        length: { value: 20, unit: 'ft' },
        capacity: { value: 22, unit: 'tons' },
        manufacturer: { brand: 'Tata', model: 'Prima 4028', yearOfManufacture: 2021 },
        registrationCity: 'Mumbai',
      }
    },
    {
      phone: `+91801${PHONE_PREFIX}02`,
      name: 'Suresh Singh Bisht',
      licenseNumber: 'DL0120220054321',
      city: 'Delhi',
      preferredTruckTypes: ['32ft-sxl', '32ft-mxl'],
      // own — Cloudtruck owns this truck
      vehicle: {
        vehicleNumber: 'DL08AB2002',
        ownershipType: 'own',
        truckType: '32ft-sxl',
        bodyType: 'closed',
        length: { value: 32, unit: 'ft' },
        capacity: { value: 18, unit: 'tons' },
        manufacturer: { brand: 'Ashok Leyland', model: 'Boss 1615', yearOfManufacture: 2020 },
        registrationCity: 'Delhi',
      }
    },
    {
      phone: `+91801${PHONE_PREFIX}03`,
      name: 'Mahesh Patel Verma',
      licenseNumber: 'GJ0120230078901',
      city: 'Ahmedabad',
      preferredTruckTypes: ['taurus-25', '32ft-mxl'],
      // leased — financed truck, Cloudtruck operates it
      vehicle: {
        vehicleNumber: 'GJ01BZ3003',
        ownershipType: 'leased',
        truckType: 'taurus-25',
        bodyType: 'open',
        length: { value: 32, unit: 'ft' },
        capacity: { value: 25, unit: 'tons' },
        manufacturer: { brand: 'Mahindra', model: 'Blazo X 35', yearOfManufacture: 2022 },
        registrationCity: 'Ahmedabad',
      }
    },
    {
      phone: `+91801${PHONE_PREFIX}04`,
      name: 'Prakash Nair Pillai',
      licenseNumber: 'KA0120210098765',
      city: 'Bangalore',
      preferredTruckTypes: ['eicher-19ft', 'eicher-17ft'],
      // attached — driver owns this truck (market)
      vehicle: {
        vehicleNumber: 'KA03CD4004',
        ownershipType: 'attached',
        truckType: 'eicher-19ft',
        bodyType: 'closed',
        length: { value: 19, unit: 'ft' },
        capacity: { value: 7, unit: 'tons' },
        manufacturer: { brand: 'Eicher', model: 'Pro 2095', yearOfManufacture: 2023 },
        registrationCity: 'Bangalore',
      }
    },
    {
      phone: `+91801${PHONE_PREFIX}05`,
      name: 'Ganesh Reddy Babu',
      licenseNumber: 'TN0120220043210',
      city: 'Chennai',
      preferredTruckTypes: ['container-32ft', 'container-40ft'],
      // attached — driver owns this truck (market)
      vehicle: {
        vehicleNumber: 'TN09EF5005',
        ownershipType: 'attached',
        truckType: 'container-32ft',
        bodyType: 'container',
        length: { value: 32, unit: 'ft' },
        capacity: { value: 28, unit: 'tons' },
        manufacturer: { brand: 'Volvo', model: 'FH 460', yearOfManufacture: 2022 },
        registrationCity: 'Chennai',
      }
    },
  ];

  const records = [];
  for (const d of driverDefs) {
    const user = await User.create({
      phone:  d.phone,
      role:   'driver',
      status: 'active',
    });

    const driver = await Driver.create({
      user:                user._id,
      name:                d.name,
      licenseNumber:       d.licenseNumber,
      licenseExpiry:       daysFromNow(730), // 2 years from now
      city:                d.city,
      preferredTruckTypes: d.preferredTruckTypes,
      availability:        'available',
      kycStatus:           'verified',
      kycSubmittedAt:      daysAgo(60),
      accountInfoStatus:   'verified',
      isVerified:          true,
      verifiedAt:          daysAgo(30),
      bankDetails: {
        accountNumber:     `9876543210${records.length + 1}`,
        ifscCode:          'SBI0001234',
        accountHolderName: d.name,
        bankName:          'State Bank of India',
      },
      emergencyContact: {
        name:     'Family Member',
        phone:    `+9199000${String(records.length + 1).padStart(5, '0')}`,
        relation: 'Spouse',
      },
      performance: {
        completedTrips:      15 + records.length * 3,
        cancelledTrips:      1,
        onTimeDeliveryRate:  88 + records.length,
        averageRating:       4.2 + records.length * 0.1,
        totalEarnings:       150000 + records.length * 25000,
      },
    });

    const futureExpiry = daysFromNow(365);
    const isAttached = d.vehicle.ownershipType === 'attached';
    const vehicle = await Vehicle.create({
      vehicleNumber:      d.vehicle.vehicleNumber,
      truckType:          d.vehicle.truckType,
      bodyType:           d.vehicle.bodyType,
      length:             d.vehicle.length,
      capacity:           d.vehicle.capacity,
      height:             { value: 8, unit: 'ft' },
      manufacturer:       d.vehicle.manufacturer,
      ownershipType:      d.vehicle.ownershipType,
      // For attached trucks: driver is the RC owner; for own/leased: no external owner
      ...(isAttached ? {
        owner:    driver._id,
        ownerRef: { kind: 'Driver', item: driver._id },
      } : {}),
      registrationCity:   d.vehicle.registrationCity,
      availability:       'available',
      status:             'active',
      verificationStatus: 'verified',
      verificationDetails: { verifiedAt: daysAgo(20) },
      expiryDates: {
        insurance: futureExpiry,
        fitness:   futureExpiry,
        permit:    futureExpiry,
        puc:       futureExpiry,
        roadTax:   futureExpiry,
      },
      features: {
        hasGPS:      true,
        hasFastTag:  true,
        hasTarpaulin: d.vehicle.bodyType === 'open',
      },
      compliance: {
        isCommerciallyRegistered: true,
        hasNationalPermit:        true,
        pollutionCertValid:       true,
      },
      stats: {
        totalTrips:    12 + records.length * 2,
        completedTrips: 11 + records.length * 2,
      },
    });

    // Link vehicle to driver
    await Driver.updateOne({ _id: driver._id }, { $push: { vehicles: vehicle._id } });

    const { vehicle: _vehicleDef, ...dRest } = d;
    records.push({ user, driver: await Driver.findById(driver._id), vehicle, ...dRest });
    console.log(`  ✔ Driver: ${d.name} | Vehicle: ${d.vehicle.vehicleNumber} (${d.vehicle.truckType})`);
  }

  return records;
};

// ══════════════════════════════════════════════════════════════════════════════
// SEED BOOKINGS
// ══════════════════════════════════════════════════════════════════════════════
const seedBookings = async (customers, driverVehicles, staff) => {
  section('Seeding Bookings (all status tabs)');

  const [reliance, tata, infosys, pharma] = customers;
  const [dv1, dv2, dv3, dv4, dv5] = driverVehicles;
  const { trafficController, supervisor } = staff;

  // Base booking fields shared across many bookings
  const base = (overrides) => ({
    advanceRequired:   0,
    bookingSource:     'staff',
    priority:          'medium',
    loadType:          'FTL',
    exim:              'domestic',
    postToSupplier:    true,
    isAdhoc:           false,
    trafficController: trafficController.staff._id,
    supervisor:        supervisor.staff._id,
    createdByStaff:    staff.opsManager.user._id,   // User ObjectId (service enriches to { _id, name })
    ...overrides,
  });

  const bookings = [];

  // ── 1. CREATED (Available tab) ───────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         reliance.customer._id,
    bookingType:      'indent',
    status:           'created',
    materialType:     'FMCG',
    weight:           { value: 15000, unit: 'kg' },
    truckTypeNeeded:  'container-20ft',
    bodyType:         'container',
    loadDate:         daysFromNow(3),
    loadTime:         '09:00',
    expectedDeliveryDate: daysFromNow(5),
    pickup:           addr('Mumbai', 'Reliance Warehouse, JNPT, Nhava Sheva', 'Maharashtra', '400707', 'Sunil Roy', '9011001100'),
    drop:             addr('Delhi', 'Reliance Distribution Centre, Okhla', 'Delhi', '110020', 'Vikram Tiwari', '9022002200'),
    customerPrice:    65000,
    supplierPrice:    52000,
    expectedAmount:   65000,
    advanceRequired:  10000,
    laneCode:         LANES.MUM_DEL,
    supplierEntity:   SUPPLIERS[0],
    loadType:         'FTL',
    expiryTime:       daysFromNow(2),
  })));
  console.log('  ✔ Booking: created (Available)');

  // ── 2. CREATED #2 ────────────────────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         pharma.customer._id,
    bookingType:      'indent',
    status:           'created',
    materialType:     'pharma',
    weight:           { value: 5000, unit: 'kg' },
    truckTypeNeeded:  'eicher-19ft',
    bodyType:         'closed',
    loadDate:         daysFromNow(2),
    loadTime:         '11:00',
    pickup:           addr('Ahmedabad', 'Sun Pharma Plant, Vatva GIDC', 'Gujarat', '382445', 'Raju Desai', '9044001100'),
    drop:             addr('Delhi', 'Pharma Distribution Hub, Shahdara', 'Delhi', '110032', 'Mohan Chand', '9033002200'),
    customerPrice:    28000,
    supplierPrice:    22000,
    expectedAmount:   28000,
    advanceRequired:  5000,
    laneCode:         LANES.AHM_DEL,
    supplierEntity:   SUPPLIERS[4],
    loadType:         'FTL',
    isAdhoc:          true,
  })));
  console.log('  ✔ Booking: created #2 (Available, adhoc)');

  // ── 3. UNDER-REVIEW (S Approval tab) ────────────────────────────────────
  const bkUnderReview1 = await Booking.create(base({
    customer:         tata.customer._id,
    bookingType:      'direct-load',
    status:           'under-review',
    materialType:     'steel',
    weight:           { value: 25000, unit: 'kg' },
    truckTypeNeeded:  'taurus-25',
    bodyType:         'open',
    loadDate:         daysFromNow(1),
    loadTime:         '08:00',
    pickup:           addr('Kolkata', 'Tata Steel Plant, Jamshedpur Rd', 'West Bengal', '700001', 'Bimal Sen', '9033003300'),
    drop:             addr('Delhi', 'Tata Steel Warehouse, Wazirpur', 'Delhi', '110052', 'Ravi Gupta', '9044004400'),
    customerPrice:    95000,
    supplierPrice:    78000,
    expectedAmount:   95000,
    advanceRequired:  20000,
    laneCode:         LANES.DEL_KOL,
    supplierEntity:   SUPPLIERS[1],
    loadType:         'FTL',
    invoiceTo:        'Customer',
    payTo:            'Supplier',
    podType:          'Hard',
  }));
  bookings.push(bkUnderReview1);
  console.log('  ✔ Booking: under-review (S Approval) - direct-load');

  const bkUnderReview2 = await Booking.create(base({
    customer:         infosys.customer._id,
    bookingType:      'indent',
    status:           'under-review',
    materialType:     'electronics',
    weight:           { value: 3000, unit: 'kg' },
    truckTypeNeeded:  'eicher-17ft',
    bodyType:         'closed',
    loadDate:         daysFromNow(2),
    loadTime:         '10:00',
    pickup:           addr('Bangalore', 'Infosys SEZ, Electronic City', 'Karnataka', '560100', 'Jayesh Kumar', '9055005500'),
    drop:             addr('Chennai', 'IT Hub Warehouse, Perungudi', 'Tamil Nadu', '600096', 'Arun Raj', '9066006600'),
    customerPrice:    18000,
    supplierPrice:    13500,
    expectedAmount:   18000,
    advanceRequired:  3000,
    laneCode:         LANES.BLR_CHE,
    supplierEntity:   SUPPLIERS[5],
    loadType:         'LTL',
    invoiceTo:        'Customer',
    payTo:            'Driver',
    podType:          'Soft',
  }));
  bookings.push(bkUnderReview2);
  console.log('  ✔ Booking: under-review #2 (S Approval) - indent LTL');

  // ── 4. ASSIGNED (Confirmed tab) ──────────────────────────────────────────
  const assignedAt1 = daysAgo(1);
  const bkAssigned = await Booking.create(base({
    customer:         reliance.customer._id,
    bookingType:      'direct-invoice',
    status:           'assigned',
    materialType:     'FMCG',
    weight:           { value: 18000, unit: 'kg' },
    truckTypeNeeded:  'container-32ft',
    bodyType:         'container',
    loadDate:         daysFromNow(1),
    loadTime:         '07:00',
    expectedDeliveryDate: daysFromNow(4),
    pickup:           addr('Mumbai', 'Reliance Mega DC, Bhiwandi', 'Maharashtra', '421302', 'Anand Patil', '9077007700'),
    drop:             addr('Bangalore', 'Reliance Smart, Marathahalli', 'Karnataka', '560037', 'Deepak Rao', '9088008800'),
    driver:           dv5.driver._id,
    vehicle:          dv5.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       assignedAt1,
    customerPrice:    72000,
    supplierPrice:    58000,
    expectedAmount:   72000,
    finalAmount:      72000,
    advanceRequired:  15000,
    laneCode:         LANES.MUM_BLR,
    supplierEntity:   SUPPLIERS[3],
    loadType:         'FTL',
    invoiceTo:        'Customer',
    payTo:            'Supplier',
    podType:          'Hard',
    tripKm:           980,
    lrDetails: {
      lrNumber:  'LR2026031001',
      lrDate:    assignedAt1,
      remarks:   'Handle with care',
      uploadedAt: assignedAt1,
    },
    statusHistory: [
      { status: 'created',      timestamp: daysAgo(3) },
      { status: 'under-review', timestamp: daysAgo(2) },
      { status: 'assigned',     timestamp: assignedAt1 },
    ],
  }));
  bookings.push(bkAssigned);

  // Mark driver/vehicle as on-trip
  await Driver.updateOne({ _id: dv5.driver._id }, { availability: 'on-trip', currentBooking: bkAssigned._id });
  await Vehicle.updateOne({ _id: dv5.vehicle._id }, { availability: 'on-trip', currentBooking: bkAssigned._id });
  console.log(`  ✔ Booking: assigned (Confirmed) - direct-invoice | Driver: ${dv5.name}`);

  // ── 5. DRIVER-EN-ROUTE (Loading tab) ────────────────────────────────────
  const enRouteAt = hoursAgo(8);
  const bkEnRoute = await Booking.create(base({
    customer:         pharma.customer._id,
    bookingType:      'indent',
    status:           'driver-en-route',
    materialType:     'pharma',
    weight:           { value: 8000, unit: 'kg' },
    truckTypeNeeded:  'eicher-19ft',
    bodyType:         'closed',
    loadDate:         new Date(),
    loadTime:         '14:00',
    pickup:           addr('Ahmedabad', 'Sun Pharma Factory, Ankleshwar', 'Gujarat', '393002', 'Kishore Mehta', '9099009900'),
    drop:             addr('Mumbai', 'Pharma Dist Centre, Kurla', 'Maharashtra', '400070', 'Paresh Shah', '9010001000'),
    driver:           dv3.driver._id,
    vehicle:          dv3.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(1),
    customerPrice:    22000,
    supplierPrice:    17000,
    expectedAmount:   22000,
    finalAmount:      22000,
    advanceRequired:  5000,
    laneCode:         LANES.MUM_PUN,
    supplierEntity:   SUPPLIERS[2],
    loadType:         'FTL',
    podType:          'Soft',
    tripKm:           530,
    lrDetails: {
      lrNumber:  'LR2026031002',
      lrDate:    daysAgo(1),
      uploadedAt: daysAgo(1),
    },
    statusHistory: [
      { status: 'created',          timestamp: daysAgo(3) },
      { status: 'under-review',     timestamp: daysAgo(2) },
      { status: 'assigned',         timestamp: daysAgo(1) },
      { status: 'driver-en-route',  timestamp: enRouteAt },
    ],
  }));
  bookings.push(bkEnRoute);
  console.log(`  ✔ Booking: driver-en-route (Loading tab) | Driver: ${dv3.name}`);

  // ── 6. REACHED-PICKUP (Loading tab) ──────────────────────────────────────
  const reachedPickupAt = hoursAgo(4);
  const bkReachedPickup = await Booking.create(base({
    customer:         tata.customer._id,
    bookingType:      'direct-load',
    status:           'reached-pickup',
    materialType:     'steel',
    weight:           { value: 20000, unit: 'kg' },
    truckTypeNeeded:  '32ft-sxl',
    bodyType:         'open',
    loadDate:         new Date(),
    loadTime:         '10:00',
    pickup:           addr('Delhi', 'Tata Steel Store, Naraina Ind Area', 'Delhi', '110028', 'Bharat Lal', '9021002100'),
    drop:             addr('Kolkata', 'JISCO Steel Depot, Liluah', 'West Bengal', '711204', 'Niladri Das', '9032003200'),
    driver:           dv2.driver._id,
    vehicle:          dv2.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(1),
    customerPrice:    88000,
    supplierPrice:    72000,
    expectedAmount:   88000,
    finalAmount:      88000,
    advanceRequired:  18000,
    laneCode:         LANES.DEL_KOL,
    supplierEntity:   SUPPLIERS[1],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           1530,
    lrDetails: {
      lrNumber:  'LR2026031003',
      lrDate:    daysAgo(1),
      uploadedAt: daysAgo(1),
    },
    statusHistory: [
      { status: 'created',         timestamp: daysAgo(4) },
      { status: 'under-review',    timestamp: daysAgo(3) },
      { status: 'assigned',        timestamp: daysAgo(1) },
      { status: 'driver-en-route', timestamp: hoursAgo(6) },
      { status: 'reached-pickup',  timestamp: reachedPickupAt },
    ],
  }));
  bookings.push(bkReachedPickup);
  console.log(`  ✔ Booking: reached-pickup (Loading tab) | Driver: ${dv2.name}`);

  // ── 7. LOADED (Loading tab) ───────────────────────────────────────────────
  const loadedAt = hoursAgo(2);
  const bkLoaded = await Booking.create(base({
    customer:         infosys.customer._id,
    bookingType:      'indent',
    status:           'loaded',
    materialType:     'electronics',
    weight:           { value: 4500, unit: 'kg' },
    truckTypeNeeded:  'eicher-17ft',
    bodyType:         'closed',
    loadDate:         new Date(),
    loadTime:         '09:00',
    pickup:           addr('Bangalore', 'Infosys Campus, Mysore Rd', 'Karnataka', '560026', 'Harish Rao', '9043004300'),
    drop:             addr('Hyderabad', 'IT Infrastructure Hub, Gachibowli', 'Telangana', '500032', 'Sridhar Rao', '9054005400'),
    driver:           dv4.driver._id,
    vehicle:          dv4.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(2),
    customerPrice:    14500,
    supplierPrice:    11000,
    expectedAmount:   14500,
    finalAmount:      14500,
    advanceRequired:  3000,
    laneCode:         LANES.DEL_HYD,
    supplierEntity:   SUPPLIERS[3],
    loadType:         'LTL',
    podType:          'Soft',
    tripKm:           600,
    lrDetails: {
      lrNumber:  'LR2026031004',
      lrDate:    daysAgo(1),
      uploadedAt: loadedAt,
    },
    statusHistory: [
      { status: 'created',         timestamp: daysAgo(4) },
      { status: 'under-review',    timestamp: daysAgo(3) },
      { status: 'assigned',        timestamp: daysAgo(2) },
      { status: 'driver-en-route', timestamp: hoursAgo(10) },
      { status: 'reached-pickup',  timestamp: hoursAgo(5) },
      { status: 'loaded',          timestamp: loadedAt },
    ],
  }));
  bookings.push(bkLoaded);
  console.log(`  ✔ Booking: loaded (Loading tab) | Driver: ${dv4.name}`);

  // ── 8. IN-TRANSIT (Intransit O tab) ──────────────────────────────────────
  const inTransitAt = hoursAgo(12);
  const bkInTransit = await Booking.create(base({
    customer:         reliance.customer._id,
    bookingType:      'direct-invoice',
    status:           'in-transit',
    materialType:     'FMCG',
    weight:           { value: 22000, unit: 'kg' },
    truckTypeNeeded:  'container-20ft',
    bodyType:         'container',
    loadDate:         daysAgo(1),
    loadTime:         '06:00',
    expectedDeliveryDate: daysFromNow(1),
    pickup:           addr('Mumbai', 'Reliance JIO Point, Dharavi', 'Maharashtra', '400017', 'Suresh More', '9065006500'),
    drop:             addr('Delhi', 'Reliance Fresh Hub, Connaught Place', 'Delhi', '110001', 'Ashish Jain', '9076007600'),
    driver:           dv1.driver._id,
    vehicle:          dv1.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(2),
    customerPrice:    68000,
    supplierPrice:    55000,
    expectedAmount:   68000,
    finalAmount:      68000,
    advanceRequired:  15000,
    laneCode:         LANES.MUM_DEL,
    supplierEntity:   SUPPLIERS[0],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           1400,
    lastKnownLocation: pt(76.2, 25.1), // somewhere between Mumbai and Delhi
    lastLocationUpdate: hoursAgo(1),
    lrDetails: {
      lrNumber:  'LR2026031005',
      lrDate:    daysAgo(2),
      uploadedAt: daysAgo(1),
    },
    statusHistory: [
      { status: 'created',         timestamp: daysAgo(5) },
      { status: 'under-review',    timestamp: daysAgo(4) },
      { status: 'assigned',        timestamp: daysAgo(2) },
      { status: 'driver-en-route', timestamp: daysAgo(2) },
      { status: 'reached-pickup',  timestamp: daysAgo(1) },
      { status: 'loaded',          timestamp: daysAgo(1) },
      { status: 'in-transit',      timestamp: inTransitAt },
    ],
  }));
  bookings.push(bkInTransit);
  console.log(`  ✔ Booking: in-transit (Intransit O) | Driver: ${dv1.name}`);

  // ── 9. IN-TRANSIT #2 ─────────────────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         tata.customer._id,
    bookingType:      'direct-load',
    status:           'in-transit',
    materialType:     'steel',
    weight:           { value: 24000, unit: 'kg' },
    truckTypeNeeded:  'taurus-25',
    bodyType:         'open',
    loadDate:         daysAgo(2),
    loadTime:         '08:00',
    expectedDeliveryDate: daysFromNow(1),
    pickup:           addr('Ahmedabad', 'Gujarat Steel Corp, Sanand', 'Gujarat', '382110', 'Dinesh Patel', '9087008700'),
    drop:             addr('Delhi', 'Steel Market, Wazirpur', 'Delhi', '110035', 'Ranjit Sharma', '9098009800'),
    driver:           dv3.driver._id,
    vehicle:          dv3.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(3),
    customerPrice:    82000,
    supplierPrice:    66000,
    expectedAmount:   82000,
    finalAmount:      82000,
    advanceRequired:  16000,
    laneCode:         LANES.AHM_DEL,
    supplierEntity:   SUPPLIERS[2],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           930,
    lastKnownLocation: pt(74.9, 26.4), // between Ahmedabad and Delhi
    lastLocationUpdate: hoursAgo(2),
    lrDetails: {
      lrNumber:  'LR2026031006',
      lrDate:    daysAgo(3),
      uploadedAt: daysAgo(2),
    },
    statusHistory: [
      { status: 'created',         timestamp: daysAgo(6) },
      { status: 'under-review',    timestamp: daysAgo(5) },
      { status: 'assigned',        timestamp: daysAgo(3) },
      { status: 'driver-en-route', timestamp: daysAgo(3) },
      { status: 'reached-pickup',  timestamp: daysAgo(2) },
      { status: 'loaded',          timestamp: daysAgo(2) },
      { status: 'in-transit',      timestamp: hoursAgo(20) },
    ],
  })));
  console.log('  ✔ Booking: in-transit #2 (Intransit O)');

  // ── 10. REACHED-DESTINATION (Intransit I / Unloading tab) ─────────────────
  const reachedDestAt = hoursAgo(6);
  bookings.push(await Booking.create(base({
    customer:         infosys.customer._id,
    bookingType:      'indent',
    status:           'reached-destination',
    materialType:     'electronics',
    weight:           { value: 6000, unit: 'kg' },
    truckTypeNeeded:  'container-20ft',
    bodyType:         'container',
    loadDate:         daysAgo(3),
    loadTime:         '07:00',
    expectedDeliveryDate: new Date(),
    pickup:           addr('Bangalore', 'Infosys SEZ Gate 2, Hebbal', 'Karnataka', '560024', 'Naresh BT', '9060006000'),
    drop:             addr('Chennai', 'Tamil Nadu Electronics Depot, Ambattur', 'Tamil Nadu', '600053', 'Jayaraman S', '9071007100'),
    driver:           dv4.driver._id,
    vehicle:          dv4.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(4),
    customerPrice:    15000,
    supplierPrice:    11500,
    expectedAmount:   15000,
    finalAmount:      15000,
    advanceRequired:  3000,
    laneCode:         LANES.BLR_CHE,
    supplierEntity:   SUPPLIERS[5],
    loadType:         'FTL',
    podType:          'Soft',
    tripKm:           345,
    lrDetails: {
      lrNumber:  'LR2026031007',
      lrDate:    daysAgo(4),
      uploadedAt: daysAgo(3),
    },
    statusHistory: [
      { status: 'created',              timestamp: daysAgo(7) },
      { status: 'under-review',         timestamp: daysAgo(6) },
      { status: 'assigned',             timestamp: daysAgo(4) },
      { status: 'driver-en-route',      timestamp: daysAgo(4) },
      { status: 'reached-pickup',       timestamp: daysAgo(3) },
      { status: 'loaded',               timestamp: daysAgo(3) },
      { status: 'in-transit',           timestamp: daysAgo(2) },
      { status: 'reached-destination',  timestamp: reachedDestAt },
    ],
  })));
  console.log('  ✔ Booking: reached-destination (Intransit I / Unloading)');

  // ── 11. DELIVERED (POD Pending tab) ──────────────────────────────────────
  const deliveredAt = daysAgo(1);
  bookings.push(await Booking.create(base({
    customer:         reliance.customer._id,
    bookingType:      'direct-invoice',
    status:           'delivered',
    materialType:     'FMCG',
    weight:           { value: 20000, unit: 'kg' },
    truckTypeNeeded:  'container-32ft',
    bodyType:         'container',
    loadDate:         daysAgo(5),
    loadTime:         '08:00',
    expectedDeliveryDate: daysAgo(2),
    pickup:           addr('Mumbai', 'Reliance DC, LBS Marg, Vikhroli', 'Maharashtra', '400083', 'Anil Chavan', '9082008200'),
    drop:             addr('Kolkata', 'Reliance Store, Park Street', 'West Bengal', '700016', 'Koushik Dey', '9093009300'),
    driver:           dv5.driver._id,
    vehicle:          dv5.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(6),
    customerPrice:    105000,
    supplierPrice:    86000,
    expectedAmount:   105000,
    finalAmount:      105000,
    advanceRequired:  25000,
    laneCode:         LANES.MUM_KOL,
    supplierEntity:   SUPPLIERS[0],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           2050,
    paymentStatus:    'partial',
    lrDetails: {
      lrNumber:  'LR2026031008',
      lrDate:    daysAgo(6),
      uploadedAt: daysAgo(5),
    },
    statusHistory: [
      { status: 'created',             timestamp: daysAgo(9) },
      { status: 'under-review',        timestamp: daysAgo(8) },
      { status: 'assigned',            timestamp: daysAgo(6) },
      { status: 'driver-en-route',     timestamp: daysAgo(5) },
      { status: 'reached-pickup',      timestamp: daysAgo(5) },
      { status: 'loaded',              timestamp: daysAgo(5) },
      { status: 'in-transit',          timestamp: daysAgo(4) },
      { status: 'reached-destination', timestamp: daysAgo(2) },
      { status: 'delivered',           timestamp: deliveredAt },
    ],
  })));
  console.log('  ✔ Booking: delivered (POD Pending)');

  // ── 12. DELIVERED #2 (POD Pending tab) ──────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         tata.customer._id,
    bookingType:      'direct-load',
    status:           'delivered',
    materialType:     'steel',
    weight:           { value: 18000, unit: 'kg' },
    truckTypeNeeded:  '32ft-sxl',
    bodyType:         'open',
    loadDate:         daysAgo(4),
    loadTime:         '07:00',
    pickup:           addr('Delhi', 'Tata Steel Yard, Okhla Phase II', 'Delhi', '110020', 'Girish Kumar', '9065106500'),
    drop:             addr('Hyderabad', 'Hyderabad Steel Market, Balanagar', 'Telangana', '500037', 'Anand Rao', '9076107600'),
    driver:           dv2.driver._id,
    vehicle:          dv2.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(5),
    customerPrice:    62000,
    supplierPrice:    50000,
    expectedAmount:   62000,
    finalAmount:      62000,
    advanceRequired:  12000,
    laneCode:         LANES.DEL_HYD,
    supplierEntity:   SUPPLIERS[1],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           1580,
    paymentStatus:    'partial',
    lrDetails: {
      lrNumber:  'LR2026031009',
      lrDate:    daysAgo(5),
      uploadedAt: daysAgo(4),
    },
    statusHistory: [
      { status: 'created',             timestamp: daysAgo(8) },
      { status: 'under-review',        timestamp: daysAgo(7) },
      { status: 'assigned',            timestamp: daysAgo(5) },
      { status: 'driver-en-route',     timestamp: daysAgo(4) },
      { status: 'reached-pickup',      timestamp: daysAgo(4) },
      { status: 'loaded',              timestamp: daysAgo(3) },
      { status: 'in-transit',          timestamp: daysAgo(3) },
      { status: 'reached-destination', timestamp: daysAgo(1) },
      { status: 'delivered',           timestamp: daysAgo(1) },
    ],
  })));
  console.log('  ✔ Booking: delivered #2 (POD Pending)');

  // ── 13. POD-RECEIVED (POD Received tab) ──────────────────────────────────
  const podReceivedAt = daysAgo(1);
  bookings.push(await Booking.create(base({
    customer:         infosys.customer._id,
    bookingType:      'indent',
    status:           'pod-received',
    materialType:     'electronics',
    weight:           { value: 5500, unit: 'kg' },
    truckTypeNeeded:  'eicher-19ft',
    bodyType:         'closed',
    loadDate:         daysAgo(7),
    loadTime:         '09:00',
    pickup:           addr('Bangalore', 'Infosys Tower, Sarjapur Rd', 'Karnataka', '560035', 'Vivek Babu', '9087108700'),
    drop:             addr('Mumbai', 'Infosys BPO, Airoli', 'Maharashtra', '400708', 'Preeti Shah', '9098109800'),
    driver:           dv4.driver._id,
    vehicle:          dv4.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(8),
    customerPrice:    32000,
    supplierPrice:    25000,
    expectedAmount:   32000,
    finalAmount:      32000,
    advanceRequired:  8000,
    laneCode:         LANES.MUM_BLR,
    supplierEntity:   SUPPLIERS[3],
    loadType:         'FTL',
    podType:          'Soft',
    tripKm:           980,
    podUploadedAt:    podReceivedAt,
    paymentStatus:    'partial',
    podDetails: {
      receiverName:   'Preethi Shah',
      receiverPhone:  '9098109800',
      deliveredAt:    daysAgo(2),
      remarks:        'Goods received in good condition',
    },
    lrDetails: {
      lrNumber:  'LR2026031010',
      lrDate:    daysAgo(8),
      uploadedAt: daysAgo(7),
    },
    statusHistory: [
      { status: 'created',             timestamp: daysAgo(11) },
      { status: 'under-review',        timestamp: daysAgo(10) },
      { status: 'assigned',            timestamp: daysAgo(8) },
      { status: 'driver-en-route',     timestamp: daysAgo(7) },
      { status: 'reached-pickup',      timestamp: daysAgo(7) },
      { status: 'loaded',              timestamp: daysAgo(7) },
      { status: 'in-transit',          timestamp: daysAgo(6) },
      { status: 'reached-destination', timestamp: daysAgo(3) },
      { status: 'delivered',           timestamp: daysAgo(2) },
      { status: 'pod-received',        timestamp: podReceivedAt },
    ],
  })));
  console.log('  ✔ Booking: pod-received (POD Received tab)');

  // ── 14. POD-RECEIVED #2 ──────────────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         reliance.customer._id,
    bookingType:      'direct-invoice',
    status:           'pod-received',
    materialType:     'FMCG',
    weight:           { value: 16000, unit: 'kg' },
    truckTypeNeeded:  'container-20ft',
    bodyType:         'container',
    loadDate:         daysAgo(8),
    loadTime:         '07:00',
    pickup:           addr('Mumbai', 'Reliance Smart Distribution, Panvel', 'Maharashtra', '410206', 'Manoj Patil', '9059105900'),
    drop:             addr('Pune', 'Reliance Fresh, Hinjewadi', 'Maharashtra', '411057', 'Dilip Shinde', '9070007000'),
    driver:           dv1.driver._id,
    vehicle:          dv1.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(9),
    customerPrice:    12000,
    supplierPrice:    9200,
    expectedAmount:   12000,
    finalAmount:      12000,
    advanceRequired:  3000,
    laneCode:         LANES.MUM_PUN,
    supplierEntity:   SUPPLIERS[0],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           150,
    podUploadedAt:    daysAgo(5),
    paymentStatus:    'paid',
    podDetails: {
      receiverName:   'Dilip Shinde',
      receiverPhone:  '9070007000',
      deliveredAt:    daysAgo(6),
      remarks:        'All packages intact',
    },
    lrDetails: {
      lrNumber:  'LR2026031011',
      lrDate:    daysAgo(9),
      uploadedAt: daysAgo(8),
    },
    statusHistory: [
      { status: 'created',             timestamp: daysAgo(12) },
      { status: 'under-review',        timestamp: daysAgo(11) },
      { status: 'assigned',            timestamp: daysAgo(9) },
      { status: 'driver-en-route',     timestamp: daysAgo(8) },
      { status: 'reached-pickup',      timestamp: daysAgo(8) },
      { status: 'loaded',              timestamp: daysAgo(8) },
      { status: 'in-transit',          timestamp: daysAgo(7) },
      { status: 'reached-destination', timestamp: daysAgo(6) },
      { status: 'delivered',           timestamp: daysAgo(6) },
      { status: 'pod-received',        timestamp: daysAgo(5) },
    ],
  })));
  console.log('  ✔ Booking: pod-received #2');

  // ── 15. CLOSED ───────────────────────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         pharma.customer._id,
    bookingType:      'direct-load',
    status:           'closed',
    materialType:     'pharma',
    weight:           { value: 7000, unit: 'kg' },
    truckTypeNeeded:  'eicher-17ft',
    bodyType:         'closed',
    loadDate:         daysAgo(14),
    loadTime:         '10:00',
    pickup:           addr('Ahmedabad', 'Sun Pharma HQ, Vapi', 'Gujarat', '396191', 'Hemant Dave', '9041004100'),
    drop:             addr('Bangalore', 'Apollo Pharmacy Dist, Tumkur Rd', 'Karnataka', '560073', 'Manu Sharma', '9052005200'),
    driver:           dv3.driver._id,
    vehicle:          dv3.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(15),
    customerPrice:    26000,
    supplierPrice:    20000,
    expectedAmount:   26000,
    finalAmount:      26000,
    advanceRequired:  6000,
    laneCode:         LANES.MUM_BLR,
    supplierEntity:   SUPPLIERS[2],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           1620,
    paymentStatus:    'paid',
    podUploadedAt:    daysAgo(7),
    podDetails: {
      receiverName:   'Manu Sharma',
      receiverPhone:  '9052005200',
      deliveredAt:    daysAgo(9),
      remarks:        'Temperature maintained. Cold chain intact.',
    },
    lrDetails: {
      lrNumber:  'LR2026031012',
      lrDate:    daysAgo(15),
      uploadedAt: daysAgo(14),
    },
    statusHistory: [
      { status: 'created',             timestamp: daysAgo(18) },
      { status: 'under-review',        timestamp: daysAgo(17) },
      { status: 'assigned',            timestamp: daysAgo(15) },
      { status: 'driver-en-route',     timestamp: daysAgo(14) },
      { status: 'reached-pickup',      timestamp: daysAgo(14) },
      { status: 'loaded',              timestamp: daysAgo(13) },
      { status: 'in-transit',          timestamp: daysAgo(12) },
      { status: 'reached-destination', timestamp: daysAgo(10) },
      { status: 'delivered',           timestamp: daysAgo(9) },
      { status: 'pod-received',        timestamp: daysAgo(7) },
      { status: 'closed',              timestamp: daysAgo(5) },
    ],
  })));
  console.log('  ✔ Booking: closed');

  // ── 16. CLOSED #2 (older, for dashboard history) ─────────────────────────
  bookings.push(await Booking.create(base({
    customer:         tata.customer._id,
    bookingType:      'indent',
    status:           'closed',
    materialType:     'steel',
    weight:           { value: 22000, unit: 'kg' },
    truckTypeNeeded:  'taurus-25',
    bodyType:         'open',
    loadDate:         daysAgo(20),
    loadTime:         '08:00',
    pickup:           addr('Delhi', 'Tata Steel Depot, Naraina', 'Delhi', '110028', 'Brijesh Kumar', '9020002000'),
    drop:             addr('Mumbai', 'Tata Steel Store, Malad', 'Maharashtra', '400064', 'Sanjay More', '9031003100'),
    driver:           dv2.driver._id,
    vehicle:          dv2.vehicle._id,
    assignedBy:       staff.opsManager.staff._id,
    assignedAt:       daysAgo(21),
    customerPrice:    71000,
    supplierPrice:    58000,
    expectedAmount:   71000,
    finalAmount:      71000,
    advanceRequired:  14000,
    laneCode:         LANES.MUM_DEL,
    supplierEntity:   SUPPLIERS[1],
    loadType:         'FTL',
    podType:          'Hard',
    tripKm:           1400,
    paymentStatus:    'paid',
    podUploadedAt:    daysAgo(14),
    podDetails: {
      receiverName:  'Sanjay More',
      receiverPhone: '9031003100',
      deliveredAt:   daysAgo(15),
      remarks:       'No damages',
    },
    lrDetails: {
      lrNumber:  'LR2026031013',
      lrDate:    daysAgo(21),
      uploadedAt: daysAgo(20),
    },
    statusHistory: [
      { status: 'created',             timestamp: daysAgo(24) },
      { status: 'under-review',        timestamp: daysAgo(23) },
      { status: 'assigned',            timestamp: daysAgo(21) },
      { status: 'driver-en-route',     timestamp: daysAgo(20) },
      { status: 'reached-pickup',      timestamp: daysAgo(20) },
      { status: 'loaded',              timestamp: daysAgo(19) },
      { status: 'in-transit',          timestamp: daysAgo(18) },
      { status: 'reached-destination', timestamp: daysAgo(16) },
      { status: 'delivered',           timestamp: daysAgo(15) },
      { status: 'pod-received',        timestamp: daysAgo(14) },
      { status: 'closed',              timestamp: daysAgo(12) },
    ],
  })));
  console.log('  ✔ Booking: closed #2 (history)');

  // ── 17. CANCELLED ────────────────────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         pharma.customer._id,
    bookingType:      'indent',
    status:           'cancelled',
    materialType:     'pharma',
    weight:           { value: 3000, unit: 'kg' },
    truckTypeNeeded:  'eicher-14ft',
    bodyType:         'closed',
    loadDate:         daysAgo(10),
    loadTime:         '11:00',
    pickup:           addr('Ahmedabad', 'Cadila Healthcare, Dholka', 'Gujarat', '387810', 'Bhavesh Joshi', '9042004200'),
    drop:             addr('Kolkata', 'Pharma Depot, Ultadanga', 'West Bengal', '700067', 'Rajib Roy', '9053005300'),
    advanceRequired:  0,
    customerPrice:    45000,
    supplierPrice:    0,
    expectedAmount:   45000,
    laneCode:         LANES.MUM_KOL,
    supplierEntity:   SUPPLIERS[4],
    loadType:         'LTL',
    isDeleted:        false,
    cancellationDetails: {
      cancelledAt:          daysAgo(9),
      reason:               'Customer requested cancellation due to change in delivery destination',
      cancellationCharges:  0,
    },
    statusHistory: [
      { status: 'created',    timestamp: daysAgo(11) },
      { status: 'cancelled',  timestamp: daysAgo(9) },
    ],
  })));
  console.log('  ✔ Booking: cancelled');

  // ── 18. CANCELLED #2 ─────────────────────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         infosys.customer._id,
    bookingType:      'direct-load',
    status:           'cancelled',
    materialType:     'electronics',
    weight:           { value: 2000, unit: 'kg' },
    truckTypeNeeded:  'tata-407',
    bodyType:         'closed',
    loadDate:         daysAgo(15),
    loadTime:         '12:00',
    pickup:           addr('Bangalore', 'Infosys Finacle, Electronics City', 'Karnataka', '560100', 'Madan Raj', '9063006300'),
    drop:             addr('Chennai', 'IT Park, Sholinganallur', 'Tamil Nadu', '600119', 'Senthil Kumar', '9074007400'),
    advanceRequired:  0,
    customerPrice:    8500,
    supplierPrice:    0,
    expectedAmount:   8500,
    laneCode:         LANES.BLR_CHE,
    supplierEntity:   SUPPLIERS[5],
    loadType:         'LTL',
    cancellationDetails: {
      cancelledAt:          daysAgo(14),
      reason:               'No suitable driver available for the required truck type',
      cancellationCharges:  0,
    },
    statusHistory: [
      { status: 'created',      timestamp: daysAgo(16) },
      { status: 'under-review', timestamp: daysAgo(15) },
      { status: 'cancelled',    timestamp: daysAgo(14) },
    ],
  })));
  console.log('  ✔ Booking: cancelled #2');

  // ── 19. ADDITIONAL INDENT (for Indents page) ─────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         reliance.customer._id,
    bookingType:      'indent',
    status:           'created',
    materialType:     'FMCG',
    weight:           { value: 12000, unit: 'kg' },
    truckTypeNeeded:  'eicher-17ft',
    bodyType:         'closed',
    loadDate:         daysFromNow(5),
    loadTime:         '10:00',
    pickup:           addr('Mumbai', 'Reliance Mart, Chembur', 'Maharashtra', '400071', 'Pankaj Mishra', '9055155500'),
    drop:             addr('Pune', 'Reliance Smart, FC Road', 'Maharashtra', '411004', 'Nikhil Deshpande', '9066266600'),
    customerPrice:    11000,
    supplierPrice:    8500,
    expectedAmount:   11000,
    advanceRequired:  2000,
    laneCode:         LANES.MUM_PUN,
    supplierEntity:   SUPPLIERS[0],
    loadType:         'LTL',
    expiryTime:       daysFromNow(4),
    remarks:          'Priority delivery required. Handle fragile items carefully.',
  })));
  console.log('  ✔ Booking: indent (Indents page - LTL)');

  // ── 20. DIRECT-INVOICE UNDER-REVIEW ─────────────────────────────────────
  bookings.push(await Booking.create(base({
    customer:         tata.customer._id,
    bookingType:      'direct-invoice',
    status:           'under-review',
    materialType:     'steel',
    weight:           { value: 30000, unit: 'kg' },
    truckTypeNeeded:  'container-40ft',
    bodyType:         'container',
    loadDate:         daysFromNow(1),
    loadTime:         '06:00',
    pickup:           addr('Kolkata', 'Tata Steel Port, Haldia', 'West Bengal', '721657', 'Pradyut Ghosh', '9077177700'),
    drop:             addr('Mumbai', 'Jawaharlal Nehru Port, Nhava Sheva', 'Maharashtra', '400707', 'Rajesh Kamble', '9088188800'),
    customerPrice:    130000,
    supplierPrice:    108000,
    expectedAmount:   130000,
    advanceRequired:  30000,
    laneCode:         LANES.MUM_KOL,
    supplierEntity:   SUPPLIERS[1],
    loadType:         'FTL',
    exim:             'export',
    podType:          'Hard',
    invoiceTo:        'Customer',
    payTo:            'Supplier',
    boeNumber:        'BOE2026001234',
    jobNo:            'JOB2026031001',
    remarks:          'Export consignment. All documents mandatory.',
  })));
  console.log('  ✔ Booking: direct-invoice under-review (export, S Approval)');

  console.log(`\n  Total bookings created: ${bookings.length}`);
  return bookings;
};

// ─── City → State lookup ──────────────────────────────────────────────────────
function cityToState(city) {
  const map = {
    Mumbai:    'Maharashtra',
    Delhi:     'Delhi',
    Bangalore: 'Karnataka',
    Chennai:   'Tamil Nadu',
    Ahmedabad: 'Gujarat',
    Pune:      'Maharashtra',
    Hyderabad: 'Telangana',
    Kolkata:   'West Bengal',
  };
  return map[city] || 'India';
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
const run = async () => {
  const isClean = process.argv.includes('--clean');

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          CLOUDTRUCK — SEED TRANSACTIONAL DATA               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`  Mode: ${isClean ? 'CLEAN ONLY' : 'SEED'}`);
  console.log(`  Tag:  ${SEED_TAG}`);

  await mongoose.connect(mongoURI);
  console.log('\n📦 Connected to MongoDB\n');

  await cleanPrevious();

  if (isClean) {
    console.log('\n✅ Clean complete.\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Resolve Supplier ObjectIds from the Supplier collection (run seed:suppliers first)
  await resolveSuppliers();

  const staffRecords    = await seedStaff();
  const customerRecords = await seedCustomers(staffRecords);
  const driverVehicles  = await seedDriversAndVehicles();
  const bookings        = await seedBookings(customerRecords, driverVehicles, staffRecords);

  section('Summary');
  console.log(`  Staff:     ${Object.keys(staffRecords).length}`);
  console.log(`  Customers: ${customerRecords.length}`);
  console.log(`  Drivers:   ${driverVehicles.length}`);
  console.log(`  Vehicles:  ${driverVehicles.length}`);
  console.log(`  Bookings:  ${bookings.length}`);
  console.log('\n  Status breakdown:');

  const statusCounts = {};
  for (const b of bookings) {
    statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
  }
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`    ${status.padEnd(22)} ${count}`);
  }

  console.log('\n✅ Transactional seed complete!\n');
  console.log('  Staff login:    Staff@123');
  console.log('  Seed tag:       ' + SEED_TAG);
  console.log('  Clean up:       npm run seed:demo:clean\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Error:', err?.message || err);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
