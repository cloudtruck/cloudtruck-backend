/**
 * seed-dashboard.js
 * Creates ~50 rich bookings across ALL pipeline stages with realistic timestamps.
 * Ensures every ring on the dashboard (Ontime, >12H, >24H, Untracked, Total) has
 * non-zero real data.
 *
 * Run: node --env-file .env src/scripts/seed-dashboard.js
 * Clean: node --env-file .env src/scripts/seed-dashboard.js --clean
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model.js';
import Customer from '../models/customer.model.js';
import Driver from '../models/driver.model.js';
import Vehicle from '../models/vehicle.model.js';
import Booking from '../models/booking.model.js';

const CLEAN_MODE = process.argv.includes('--clean');
const SEED_TAG = 'DASH26';  // prefix used to identify and clean up seeded bookings

// ─── City data ───────────────────────────────────────────────────────────────
const CITIES = {
  ahmedabad:  { city: 'Ahmedabad',  state: 'Gujarat',          pincode: '380001', coords: [72.5714, 23.0225] },
  mumbai:     { city: 'Mumbai',     state: 'Maharashtra',      pincode: '400001', coords: [72.8777, 19.0760] },
  pune:       { city: 'Pune',       state: 'Maharashtra',      pincode: '411001', coords: [73.8567, 18.5204] },
  delhi:      { city: 'Delhi',      state: 'Delhi',            pincode: '110001', coords: [77.2090, 28.6139] },
  indore:     { city: 'Indore',     state: 'Madhya Pradesh',   pincode: '452001', coords: [75.8577, 22.7196] },
  bangalore:  { city: 'Bangalore',  state: 'Karnataka',        pincode: '560001', coords: [77.5946, 12.9716] },
  hyderabad:  { city: 'Hyderabad',  state: 'Telangana',        pincode: '500001', coords: [78.4867, 17.3850] },
  chennai:    { city: 'Chennai',    state: 'Tamil Nadu',       pincode: '600001', coords: [80.2707, 13.0827] },
  jaipur:     { city: 'Jaipur',     state: 'Rajasthan',        pincode: '302001', coords: [75.7873, 26.9124] },
  surat:      { city: 'Surat',      state: 'Gujarat',          pincode: '395001', coords: [72.8311, 21.1702] },
  nagpur:     { city: 'Nagpur',     state: 'Maharashtra',      pincode: '440001', coords: [79.0882, 21.1458] },
  lucknow:    { city: 'Lucknow',    state: 'Uttar Pradesh',    pincode: '226001', coords: [80.9462, 26.8467] },
};

const addr = (cityKey, address = 'Industrial Area, Sector 1') => {
  const c = CITIES[cityKey];
  return {
    city: c.city, state: c.state, address,
    pincode: c.pincode,
    contactPerson: { name: 'Site Manager', phone: '9800000001' },
    location: { type: 'Point', coordinates: c.coords },
  };
};

const hoursAgo  = (n) => new Date(Date.now() - n * 3600_000);
const minsAgo   = (n) => new Date(Date.now() - n * 60_000);
const daysAgo   = (n) => new Date(Date.now() - n * 86_400_000);

// ─── Lanes ───────────────────────────────────────────────────────────────────
const LANES = [
  'AMD-BOM-001', 'AMD-PNE-002', 'DEL-BOM-003', 'IND-BLR-004',
  'BOM-HYD-005', 'PNE-CHN-006', 'AMD-DEL-007', 'BOM-JAI-008',
];

// ─── Truck types ─────────────────────────────────────────────────────────────
const TRUCK_TYPES = [
  { type: 'container-20ft', body: 'container',  label: '20 Feet' },
  { type: 'container-32ft', body: 'container',  label: '32 Feet Multi Axle' },
  { type: 'eicher-17ft',    body: 'closed',     label: '17 Feet Eicher' },
  { type: 'trailer-40ft',   body: 'flatbed',    label: '40 Feet Trailer' },
  { type: 'tata-407',       body: 'open',       label: '24 Feet' },
];

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Bootstrap: find or create test customer + drivers + vehicles ─────────────
async function bootstrap() {
  // Customer
  let customerUser = await User.findOne({ phone: '919000000001', isDeleted: false });
  if (!customerUser) {
    customerUser = await User.create({
      phone: '919000000001', role: 'customer', status: 'active',
    });
  }
  let customer = await Customer.findOne({ user: customerUser._id });
  if (!customer) {
    customer = await Customer.create({
      user: customerUser._id,
      companyName: 'Dashboard Test Co.',
      contactPerson: 'Test Admin',
      phone: '919000000001',
      email: 'dashtest@cloudtruck.in',
      address: { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', address: 'Test House' },
      gstNumber: '24DASHTEST001Z1',
    });
  }

  // Drivers (2)
  const driverDefs = [
    { phone: '919000000002', name: 'Ramesh Dashboard', license: 'GJ01DA0000001' },
    { phone: '919000000003', name: 'Suresh Dashboard', license: 'GJ01DB0000002' },
  ];
  const drivers = [];
  for (const dd of driverDefs) {
    let dUser = await User.findOne({ phone: dd.phone, isDeleted: false });
    if (!dUser) dUser = await User.create({ phone: dd.phone, role: 'driver', status: 'active' });
    let driver = await Driver.findOne({ user: dUser._id });
    if (!driver) {
      driver = await Driver.create({
        user: dUser._id, name: dd.name,
        licenseNumber: dd.license,
        isVerified: true, kycStatus: 'verified', accountInfoStatus: 'verified',
        availability: 'available',
        pan: { number: 'DASHPAN0001' },
        city: 'Ahmedabad',
      });
    }
    drivers.push(driver);
  }

  // Vehicles (2)
  const vehicleDefs = [
    { number: 'GJ01AA0001', type: 'container-20ft', body: 'container', owner: drivers[0]._id },
    { number: 'GJ01BB0002', type: 'container-32ft', body: 'container', owner: drivers[1]._id },
  ];
  const vehicles = [];
  for (const vd of vehicleDefs) {
    let vehicle = await Vehicle.findOne({ vehicleNumber: vd.number });
    if (!vehicle) {
      vehicle = await Vehicle.create({
        vehicleNumber: vd.number, truckType: vd.type, bodyType: vd.body,
        owner: vd.owner, ownershipType: 'own',
        verificationStatus: 'verified', status: 'active', availability: 'available',
        registrationCity: 'Ahmedabad',
        length:   { value: 20, unit: 'ft' },
        capacity: { value: 20, unit: 'tons' },
        expiryDates: {
          insurance: new Date(Date.now() + 365 * 86_400_000),
          fitness:   new Date(Date.now() + 365 * 86_400_000),
          permit:    new Date(Date.now() + 365 * 86_400_000),
          puc:       new Date(Date.now() + 365 * 86_400_000),
        },
      });
    }
    vehicles.push(vehicle);
  }

  return { customer, drivers, vehicles };
}

// ─── Build booking definitions ────────────────────────────────────────────────
function buildDefs({ customer, drivers, vehicles }) {
  const [d0, d1] = drivers;
  const [v0, v1] = vehicles;

  const base = (pickup, drop, truck, extra = {}) => ({
    customer: customer._id,
    pickup: addr(pickup),
    drop:   addr(drop),
    truckTypeNeeded: truck.type,
    bodyType:        truck.body,
    materialType: rnd(['electronics', 'textiles', 'FMCG', 'steel', 'furniture', 'general-cargo']),
    weight:       { value: rnd([5000, 8000, 12000, 15000, 20000]), unit: 'kg' },
    expectedAmount:  rnd([25000, 35000, 45000, 55000, 70000]),
    advanceRequired: rnd([5000, 8000, 10000, 15000]),
    paymentStatus: 'unpaid',
    bookingSource: 'web',
    priority: rnd(['medium', 'high', 'low']),
    isAdhoc: true,
    indentType: 'FTL',
    exim: 'domestic',
    laneCode: rnd(LANES),
    trafficManager: rnd(['ROHITH', 'AMIT', 'PRIYA']),
    loadDate: hoursAgo(-24),
    loadTime: '09:00',
    isDeleted: false,
    ...extra,
  });

  const defs = [];

  // ── Stage 0: Indents (created / under-review) ─────────────────────────────
  // 3 × Ontime: created < 12H ago
  defs.push(base('ahmedabad', 'pune',      rnd(TRUCK_TYPES), { status: 'created',      laneCode: 'AMD-PNE-002', statusHistory: [{ status: 'created', timestamp: hoursAgo(2) }],  createdAt: hoursAgo(2) }));
  defs.push(base('delhi',     'mumbai',    rnd(TRUCK_TYPES), { status: 'created',      laneCode: 'DEL-BOM-003', statusHistory: [{ status: 'created', timestamp: hoursAgo(5) }],  createdAt: hoursAgo(5) }));
  defs.push(base('indore',    'bangalore', rnd(TRUCK_TYPES), { status: 'created',      laneCode: 'IND-BLR-004', statusHistory: [{ status: 'created', timestamp: hoursAgo(9) }],  createdAt: hoursAgo(9) }));

  // 3 × Delayed: created > 12H ago, not yet assigned
  defs.push(base('ahmedabad', 'delhi',     rnd(TRUCK_TYPES), { status: 'created',      laneCode: 'AMD-DEL-007', statusHistory: [{ status: 'created', timestamp: hoursAgo(15) }], createdAt: hoursAgo(15) }));
  defs.push(base('mumbai',    'jaipur',    rnd(TRUCK_TYPES), { status: 'created',      laneCode: 'BOM-JAI-008', statusHistory: [{ status: 'created', timestamp: hoursAgo(20) }], createdAt: hoursAgo(20) }));
  defs.push(base('surat',     'nagpur',    rnd(TRUCK_TYPES), { status: 'created',      laneCode: 'AMD-BOM-001', statusHistory: [{ status: 'created', timestamp: hoursAgo(36) }], createdAt: hoursAgo(36) }));

  // 3 × Under-review
  defs.push(base('pune',      'hyderabad', rnd(TRUCK_TYPES), { status: 'under-review', laneCode: 'PNE-CHN-006', statusHistory: [{ status: 'created', timestamp: hoursAgo(8) }, { status: 'under-review', timestamp: hoursAgo(6) }], createdAt: hoursAgo(8) }));
  defs.push(base('chennai',   'bangalore', rnd(TRUCK_TYPES), { status: 'under-review', laneCode: 'IND-BLR-004', statusHistory: [{ status: 'created', timestamp: hoursAgo(18) }, { status: 'under-review', timestamp: hoursAgo(14) }], createdAt: hoursAgo(18) }));
  defs.push(base('lucknow',   'delhi',     rnd(TRUCK_TYPES), { status: 'under-review', laneCode: 'AMD-DEL-007', statusHistory: [{ status: 'created', timestamp: hoursAgo(30) }, { status: 'under-review', timestamp: hoursAgo(25) }], createdAt: hoursAgo(30) }));

  // ── Stage 1: Confirmed (assigned) ─────────────────────────────────────────
  // 2 × Ontime: assigned < 12H ago
  defs.push(base('ahmedabad', 'mumbai', TRUCK_TYPES[0], { status: 'assigned', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(4),  statusHistory: [{ status: 'created', timestamp: hoursAgo(6) }, { status: 'assigned', timestamp: hoursAgo(4) }],  createdAt: hoursAgo(6) }));
  defs.push(base('delhi',     'jaipur', TRUCK_TYPES[1], { status: 'assigned', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(8),  statusHistory: [{ status: 'created', timestamp: hoursAgo(10) }, { status: 'assigned', timestamp: hoursAgo(8) }], createdAt: hoursAgo(10) }));

  // 3 × Pending: assigned > 12H ago, not yet dispatched
  defs.push(base('mumbai',    'pune',      TRUCK_TYPES[2], { status: 'assigned', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(16), statusHistory: [{ status: 'created', timestamp: hoursAgo(20) }, { status: 'assigned', timestamp: hoursAgo(16) }], createdAt: hoursAgo(20) }));
  defs.push(base('bangalore', 'hyderabad', TRUCK_TYPES[3], { status: 'assigned', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(20), statusHistory: [{ status: 'created', timestamp: hoursAgo(24) }, { status: 'assigned', timestamp: hoursAgo(20) }], createdAt: hoursAgo(24) }));
  defs.push(base('indore',    'nagpur',    TRUCK_TYPES[4], { status: 'assigned', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(30), statusHistory: [{ status: 'created', timestamp: hoursAgo(36) }, { status: 'assigned', timestamp: hoursAgo(30) }], createdAt: hoursAgo(36) }));

  // ── Stage 2: Loading (driver-en-route / reached-pickup / loaded) ───────────
  const loadingStatusHistory = (createdH, assignedH, enRouteH) => [
    { status: 'created',         timestamp: hoursAgo(createdH) },
    { status: 'assigned',        timestamp: hoursAgo(assignedH) },
    { status: 'driver-en-route', timestamp: hoursAgo(enRouteH) },
  ];

  // 2 × Tracked + normal (< 24H in loading, has recent GPS)
  defs.push(base('ahmedabad', 'surat',   TRUCK_TYPES[0], { status: 'driver-en-route', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(10), lastLocationUpdate: minsAgo(30),  lastKnownLocation: { type: 'Point', coordinates: [72.5714, 23.0225] }, statusHistory: loadingStatusHistory(14, 10, 6),  createdAt: hoursAgo(14) }));
  defs.push(base('mumbai',    'nagpur',  TRUCK_TYPES[1], { status: 'reached-pickup',  driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(12), lastLocationUpdate: minsAgo(45),  lastKnownLocation: { type: 'Point', coordinates: [72.8777, 19.0760] }, statusHistory: [...loadingStatusHistory(16, 12, 8), { status: 'reached-pickup', timestamp: hoursAgo(5) }], createdAt: hoursAgo(16) }));

  // 2 × Delayed (> 24H in loading)
  defs.push(base('delhi',     'lucknow', TRUCK_TYPES[2], { status: 'loaded',          driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(30), lastLocationUpdate: hoursAgo(3),  lastKnownLocation: { type: 'Point', coordinates: [77.2090, 28.6139] }, statusHistory: [...loadingStatusHistory(40, 30, 26), { status: 'loaded', timestamp: hoursAgo(25) }], createdAt: hoursAgo(40) }));
  defs.push(base('pune',      'chennai', TRUCK_TYPES[3], { status: 'driver-en-route', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(28), lastLocationUpdate: hoursAgo(2),  lastKnownLocation: { type: 'Point', coordinates: [73.8567, 18.5204] }, statusHistory: loadingStatusHistory(36, 28, 25), createdAt: hoursAgo(36) }));

  // 2 × Untracked (no GPS update > 2H)
  defs.push(base('indore',    'bangalore', TRUCK_TYPES[0], { status: 'loaded',         driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(18), lastLocationUpdate: hoursAgo(5),  statusHistory: [...loadingStatusHistory(24, 18, 14), { status: 'loaded', timestamp: hoursAgo(10) }], createdAt: hoursAgo(24) }));
  defs.push(base('jaipur',    'mumbai',    TRUCK_TYPES[1], { status: 'reached-pickup', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(14), lastLocationUpdate: null,          statusHistory: [...loadingStatusHistory(20, 14, 10), { status: 'reached-pickup', timestamp: hoursAgo(6) }], createdAt: hoursAgo(20) }));

  // ── Stage 3: Intransit (in-transit) ───────────────────────────────────────
  const transitHistory = (createdH, assignedH, loadedH, inTransitH) => [
    { status: 'created',         timestamp: hoursAgo(createdH) },
    { status: 'assigned',        timestamp: hoursAgo(assignedH) },
    { status: 'driver-en-route', timestamp: hoursAgo(loadedH + 4) },
    { status: 'loaded',          timestamp: hoursAgo(loadedH) },
    { status: 'in-transit',      timestamp: hoursAgo(inTransitH) },
  ];

  // 2 × Normal (< 12H in transit, tracked)
  defs.push(base('ahmedabad', 'pune',      TRUCK_TYPES[0], { status: 'in-transit', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(14), lastLocationUpdate: minsAgo(20), lastKnownLocation: { type: 'Point', coordinates: [73.2, 21.5] }, statusHistory: transitHistory(18, 14, 10, 8),  createdAt: hoursAgo(18) }));
  defs.push(base('delhi',     'jaipur',    TRUCK_TYPES[1], { status: 'in-transit', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(16), lastLocationUpdate: minsAgo(40), lastKnownLocation: { type: 'Point', coordinates: [76.5, 27.8] }, statusHistory: transitHistory(20, 16, 12, 10), createdAt: hoursAgo(20) }));
  defs.push(base('mumbai',    'bangalore', TRUCK_TYPES[2], { status: 'in-transit', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(20), lastLocationUpdate: minsAgo(55), lastKnownLocation: { type: 'Point', coordinates: [76.1, 16.4] }, statusHistory: transitHistory(24, 20, 16, 11), createdAt: hoursAgo(24) }));

  // 3 × Delayed (> 12H in transit)
  defs.push(base('indore',    'chennai',   TRUCK_TYPES[3], { status: 'in-transit', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(30), lastLocationUpdate: hoursAgo(1),  lastKnownLocation: { type: 'Point', coordinates: [78.5, 15.5] }, statusHistory: transitHistory(36, 30, 22, 14), createdAt: hoursAgo(36) }));
  defs.push(base('surat',     'hyderabad', TRUCK_TYPES[4], { status: 'in-transit', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(32), lastLocationUpdate: hoursAgo(1),  lastKnownLocation: { type: 'Point', coordinates: [77.8, 16.2] }, statusHistory: transitHistory(40, 32, 24, 16), createdAt: hoursAgo(40) }));
  defs.push(base('nagpur',    'lucknow',   TRUCK_TYPES[0], { status: 'in-transit', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(40), lastLocationUpdate: hoursAgo(2),  lastKnownLocation: { type: 'Point', coordinates: [79.5, 23.5] }, statusHistory: transitHistory(48, 40, 30, 20), createdAt: hoursAgo(48) }));

  // 3 × Untracked (no GPS > 2H)
  defs.push(base('pune',      'delhi',     TRUCK_TYPES[1], { status: 'in-transit', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(22), lastLocationUpdate: hoursAgo(3),  statusHistory: transitHistory(28, 22, 16, 9),  createdAt: hoursAgo(28) }));
  defs.push(base('bangalore', 'mumbai',    TRUCK_TYPES[2], { status: 'in-transit', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(18), lastLocationUpdate: hoursAgo(4),  statusHistory: transitHistory(22, 18, 14, 7),  createdAt: hoursAgo(22) }));
  defs.push(base('jaipur',    'chennai',   TRUCK_TYPES[3], { status: 'in-transit', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(26), lastLocationUpdate: null,          statusHistory: transitHistory(32, 26, 20, 11), createdAt: hoursAgo(32) }));

  // ── Stage 4: Unloading (reached-destination) ──────────────────────────────
  const unloadHistory = (createdH, assignedH, inTransitH, reachedH) => [
    { status: 'created',              timestamp: hoursAgo(createdH) },
    { status: 'assigned',             timestamp: hoursAgo(assignedH) },
    { status: 'driver-en-route',      timestamp: hoursAgo(assignedH - 2) },
    { status: 'loaded',               timestamp: hoursAgo(inTransitH + 4) },
    { status: 'in-transit',           timestamp: hoursAgo(inTransitH) },
    { status: 'reached-destination',  timestamp: hoursAgo(reachedH) },
  ];

  // 2 × Normal (< 24H at destination, tracked)
  defs.push(base('ahmedabad', 'mumbai',    TRUCK_TYPES[0], { status: 'reached-destination', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(30), lastLocationUpdate: minsAgo(30), lastKnownLocation: { type: 'Point', coordinates: [72.8777, 19.0760] }, statusHistory: unloadHistory(48, 30, 18, 6),  createdAt: hoursAgo(48) }));
  defs.push(base('delhi',     'lucknow',   TRUCK_TYPES[1], { status: 'reached-destination', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(28), lastLocationUpdate: minsAgo(60), lastKnownLocation: { type: 'Point', coordinates: [80.9462, 26.8467] }, statusHistory: unloadHistory(44, 28, 16, 8),  createdAt: hoursAgo(44) }));

  // 2 × Delayed (> 24H at destination — stuck at unloading)
  defs.push(base('mumbai',    'hyderabad', TRUCK_TYPES[2], { status: 'reached-destination', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(52), lastLocationUpdate: hoursAgo(6), statusHistory: unloadHistory(72, 52, 36, 26), createdAt: hoursAgo(72) }));
  defs.push(base('indore',    'nagpur',    TRUCK_TYPES[3], { status: 'reached-destination', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(60), lastLocationUpdate: hoursAgo(3), statusHistory: unloadHistory(80, 60, 40, 30), createdAt: hoursAgo(80) }));

  // 2 × Untracked
  defs.push(base('surat',     'bangalore', TRUCK_TYPES[4], { status: 'reached-destination', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(40), lastLocationUpdate: null,         statusHistory: unloadHistory(60, 40, 28, 18), createdAt: hoursAgo(60) }));

  // ── Stage 5: Delivered ────────────────────────────────────────────────────
  const deliveredHistory = (createdH, assignedH, inTransitH, deliveredH) => [
    { status: 'created',             timestamp: hoursAgo(createdH) },
    { status: 'assigned',            timestamp: hoursAgo(assignedH) },
    { status: 'driver-en-route',     timestamp: hoursAgo(assignedH - 2) },
    { status: 'loaded',              timestamp: hoursAgo(inTransitH + 4) },
    { status: 'in-transit',          timestamp: hoursAgo(inTransitH) },
    { status: 'reached-destination', timestamp: hoursAgo(deliveredH + 2) },
    { status: 'delivered',           timestamp: hoursAgo(deliveredH) },
  ];

  // 3 × Ontime delivered (in-transit < 24H)
  defs.push(base('ahmedabad', 'pune',      TRUCK_TYPES[0], { status: 'delivered', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(30), paymentStatus: 'partial', podDetails: { receiverName: 'Ankit Shah',  receiverPhone: '9900000001', deliveredAt: hoursAgo(2),  remarks: 'Good condition' }, statusHistory: deliveredHistory(36, 30, 18, 2),  createdAt: hoursAgo(36) }));
  defs.push(base('delhi',     'jaipur',    TRUCK_TYPES[1], { status: 'delivered', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(28), paymentStatus: 'partial', podDetails: { receiverName: 'Sita Devi',   receiverPhone: '9900000002', deliveredAt: hoursAgo(4),  remarks: 'On time' },      statusHistory: deliveredHistory(34, 28, 16, 4),  createdAt: hoursAgo(34) }));
  defs.push(base('mumbai',    'surat',     TRUCK_TYPES[2], { status: 'delivered', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(24), paymentStatus: 'paid',    podDetails: { receiverName: 'Rajesh Patel', receiverPhone: '9900000003', deliveredAt: hoursAgo(6),  remarks: 'All items ok' }, statusHistory: deliveredHistory(30, 24, 12, 6),  createdAt: hoursAgo(30) }));

  // 2 × Late delivered (in-transit > 24H)
  defs.push(base('indore',    'bangalore', TRUCK_TYPES[3], { status: 'delivered', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(60), paymentStatus: 'partial', podDetails: { receiverName: 'Sudhir K',   receiverPhone: '9900000004', deliveredAt: hoursAgo(8),  remarks: 'Delayed due to road block' }, statusHistory: deliveredHistory(72, 60, 36, 8),  createdAt: hoursAgo(72) }));
  defs.push(base('bangalore', 'chennai',   TRUCK_TYPES[4], { status: 'delivered', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(48), paymentStatus: 'partial', podDetails: { receiverName: 'Meena R',    receiverPhone: '9900000005', deliveredAt: hoursAgo(10), remarks: 'Minor delay' },             statusHistory: deliveredHistory(60, 48, 30, 10), createdAt: hoursAgo(60) }));

  // ── Stage 6: POD Received ─────────────────────────────────────────────────
  const podHistory = (createdH, deliveredH) => [
    { status: 'created',             timestamp: hoursAgo(createdH) },
    { status: 'assigned',            timestamp: hoursAgo(createdH - 6) },
    { status: 'in-transit',          timestamp: hoursAgo(createdH - 14) },
    { status: 'delivered',           timestamp: hoursAgo(deliveredH + 4) },
    { status: 'pod-received',        timestamp: hoursAgo(deliveredH) },
  ];

  defs.push(base('ahmedabad', 'delhi',    TRUCK_TYPES[0], { status: 'pod-received', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(50), paymentStatus: 'paid',    podUploadedAt: hoursAgo(12), podDetails: { receiverName: 'Vijay M',    receiverPhone: '9900000006', deliveredAt: hoursAgo(16), remarks: 'POD received' }, statusHistory: podHistory(72, 12), createdAt: hoursAgo(72) }));
  defs.push(base('mumbai',    'nagpur',   TRUCK_TYPES[1], { status: 'pod-received', driver: d1._id, vehicle: v1._id, assignedAt: hoursAgo(44), paymentStatus: 'paid',    podUploadedAt: hoursAgo(8),  podDetails: { receiverName: 'Kavita S',   receiverPhone: '9900000007', deliveredAt: hoursAgo(12), remarks: 'Signed' },       statusHistory: podHistory(60, 8),  createdAt: hoursAgo(60) }));
  defs.push(base('pune',      'chennai',  TRUCK_TYPES[2], { status: 'pod-received', driver: d0._id, vehicle: v0._id, assignedAt: hoursAgo(52), paymentStatus: 'partial', podUploadedAt: hoursAgo(6),  podDetails: { receiverName: 'Arjun T',    receiverPhone: '9900000008', deliveredAt: hoursAgo(10), remarks: 'Partial docs' }, statusHistory: podHistory(80, 6),  createdAt: hoursAgo(80) }));

  // ── Stage 7: Closed ───────────────────────────────────────────────────────
  defs.push(base('delhi',     'bangalore', TRUCK_TYPES[3], { status: 'closed', driver: d0._id, vehicle: v0._id, assignedAt: daysAgo(5), paymentStatus: 'paid',    podUploadedAt: daysAgo(2), statusHistory: [{ status: 'created', timestamp: daysAgo(7) }, { status: 'assigned', timestamp: daysAgo(5) }, { status: 'in-transit', timestamp: daysAgo(4) }, { status: 'delivered', timestamp: daysAgo(3) }, { status: 'pod-received', timestamp: daysAgo(2) }, { status: 'closed', timestamp: daysAgo(1) }], createdAt: daysAgo(7) }));
  defs.push(base('mumbai',    'jaipur',    TRUCK_TYPES[4], { status: 'closed', driver: d1._id, vehicle: v1._id, assignedAt: daysAgo(6), paymentStatus: 'paid',    podUploadedAt: daysAgo(3), statusHistory: [{ status: 'created', timestamp: daysAgo(8) }, { status: 'assigned', timestamp: daysAgo(6) }, { status: 'in-transit', timestamp: daysAgo(5) }, { status: 'delivered', timestamp: daysAgo(4) }, { status: 'pod-received', timestamp: daysAgo(3) }, { status: 'closed', timestamp: daysAgo(2) }], createdAt: daysAgo(8) }));

  // ── Stage 8: Cancelled ────────────────────────────────────────────────────
  defs.push(base('ahmedabad', 'hyderabad', rnd(TRUCK_TYPES), { status: 'cancelled', paymentStatus: 'unpaid', cancellationDetails: { cancelledAt: hoursAgo(10), reason: 'Customer request' }, statusHistory: [{ status: 'created', timestamp: hoursAgo(14) }, { status: 'cancelled', timestamp: hoursAgo(10) }], createdAt: hoursAgo(14) }));
  defs.push(base('lucknow',   'pune',      rnd(TRUCK_TYPES), { status: 'cancelled', paymentStatus: 'unpaid', cancellationDetails: { cancelledAt: hoursAgo(6),  reason: 'No truck available' }, statusHistory: [{ status: 'created', timestamp: hoursAgo(8) },  { status: 'cancelled', timestamp: hoursAgo(6) }],  createdAt: hoursAgo(8) }));

  return defs;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  if (CLEAN_MODE) {
    // Remove all bookings that match our seed customers
    let cUser = await User.findOne({ phone: '919000000001', isDeleted: false });
    if (cUser) {
      let cust = await Customer.findOne({ user: cUser._id });
      if (cust) {
        const result = await Booking.deleteMany({ customer: cust._id });
        console.log(`Cleaned ${result.deletedCount} dashboard seed bookings`);
      }
    }
    await mongoose.disconnect();
    return;
  }

  const { customer, drivers, vehicles } = await bootstrap();
  console.log(`Customer: ${customer.companyName}`);
  console.log(`Drivers:  ${drivers.map(d => d.name).join(', ')}`);
  console.log(`Vehicles: ${vehicles.map(v => v.vehicleNumber).join(', ')}`);

  const defs = buildDefs({ customer, drivers, vehicles });
  console.log(`\nSeeding ${defs.length} bookings...\n`);

  const summary = {};
  for (const [i, def] of defs.entries()) {
    const booking = new Booking(def);
    await booking.save();
    summary[def.status] = (summary[def.status] || 0) + 1;
    console.log(`  ${String(i + 1).padStart(2)}. ${booking.bookingId}  [${def.status.padEnd(22)}]  ${def.pickup.city} → ${def.drop.city}`);
  }

  console.log('\n── Summary ──────────────────────────────');
  for (const [status, count] of Object.entries(summary)) {
    console.log(`  ${status.padEnd(24)} ${count}`);
  }
  console.log(`  ${'TOTAL'.padEnd(24)} ${defs.length}`);
  console.log('\nDone ✓');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
