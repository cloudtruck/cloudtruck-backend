/**
 * seed-demo.js
 * Creates demo bookings, payments, and tracking data for "New Customer".
 * Covers all booking statuses, payment methods, and GPS tracking scenarios.
 * Run: node --env-file .env src/scripts/seed-demo.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../models/user.model.js';
import Customer from '../models/customer.model.js';
import Driver from '../models/driver.model.js';
import Vehicle from '../models/vehicle.model.js';
import Booking from '../models/booking.model.js';
import Payment from '../models/payment.model.js';
import Tracking from '../models/tracking.model.js';
import Document from '../models/document.model.js';

// ─── CLI args ────────────────────────────────────────────────────────────────
// --phone 919270083791        → use Customer linked to this phone
// --reassign 919270083791     → update all seeded bookings to this Customer (by phone)
// --reassign --customer-id <id> → update all seeded bookings to this Customer _id directly
const args = process.argv.slice(2);
const phoneArgIdx = args.indexOf('--phone');
const PHONE_ARG = phoneArgIdx !== -1 ? args[phoneArgIdx + 1] : null;
const reassignArgIdx = args.indexOf('--reassign');
const REASSIGN_PHONE = (reassignArgIdx !== -1 && args[reassignArgIdx + 1] && !args[reassignArgIdx + 1].startsWith('--'))
  ? args[reassignArgIdx + 1] : null;
const customerIdArgIdx = args.indexOf('--customer-id');
const CUSTOMER_ID_ARG = customerIdArgIdx !== -1 ? args[customerIdArgIdx + 1] : null;
const REASSIGN_MODE = reassignArgIdx !== -1;

// ─── City coordinates [lng, lat] ────────────────────────────────────────────
const CITIES = {
  indore:      { city: 'Indore',      state: 'Madhya Pradesh', pincode: '452001', coords: [75.8577, 22.7196] },
  mumbai:      { city: 'Mumbai',      state: 'Maharashtra',    pincode: '400001', coords: [72.8777, 19.0760] },
  delhi:       { city: 'Delhi',       state: 'Delhi',          pincode: '110001', coords: [77.2090, 28.6139] },
  bhopal:      { city: 'Bhopal',      state: 'Madhya Pradesh', pincode: '462001', coords: [77.4126, 23.2599] },
  ahmedabad:   { city: 'Ahmedabad',   state: 'Gujarat',        pincode: '380001', coords: [72.5714, 23.0225] },
  jaipur:      { city: 'Jaipur',      state: 'Rajasthan',      pincode: '302001', coords: [75.7873, 26.9124] },
  pune:        { city: 'Pune',        state: 'Maharashtra',    pincode: '411001', coords: [73.8567, 18.5204] },
  nagpur:      { city: 'Nagpur',      state: 'Maharashtra',    pincode: '440001', coords: [79.0882, 21.1458] },
  surat:       { city: 'Surat',       state: 'Gujarat',        pincode: '395001', coords: [72.8311, 21.1702] },
  chandigarh:  { city: 'Chandigarh',  state: 'Punjab',         pincode: '160001', coords: [76.7794, 30.7333] },
};

const addr = (cityKey, address, contact = {}) => {
  const c = CITIES[cityKey];
  return {
    city: c.city,
    state: c.state,
    address,
    pincode: c.pincode,
    contactPerson: { name: contact.name || 'Site Manager', phone: contact.phone || '9800000000' },
    location: { type: 'Point', coordinates: c.coords },
  };
};

// Days ago helper
const daysAgo  = (n) => new Date(Date.now() - n * 86400000);
const hoursAgo = (n) => new Date(Date.now() - n * 3600000);

// ─── GPS waypoints ────────────────────────────────────────────────────────────
// Interpolate N intermediate points between two coordinates
function interpolate(from, to, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push([
      +(from[0] + (to[0] - from[0]) * t).toFixed(4),
      +(from[1] + (to[1] - from[1]) * t).toFixed(4),
    ]);
  }
  return pts;
}

// Indore → Mumbai  via Khandwa, Burhanpur, Dhule (~590 km)
// Truck is ~65% through (near Dhule area)
const ROUTE_INDORE_MUMBAI = [
  { coords: [75.8577, 22.7196], place: 'Dewas Naka Warehouse Complex, Indore',  city: 'Indore',     state: 'Madhya Pradesh' },
  { coords: [76.1200, 22.4000], place: 'NH-47, Dewas Bypass',                   city: 'Dewas',      state: 'Madhya Pradesh' },
  { coords: [76.3527, 21.8285], place: 'NH-47, Khandwa',                         city: 'Khandwa',    state: 'Madhya Pradesh' },
  { coords: [76.2325, 21.3157], place: 'NH-52, Burhanpur',                        city: 'Burhanpur',  state: 'Madhya Pradesh' },
  { coords: [75.8000, 21.0000], place: 'NH-52, Shirpur',                          city: 'Shirpur',    state: 'Maharashtra'    },
  { coords: [74.7748, 20.9015], place: 'NH-52, Dhule',                            city: 'Dhule',      state: 'Maharashtra'    },
];

// Delhi → Jaipur via Gurugram, Rewari, Alwar (~270 km)
// Truck is ~45% through (near Alwar)
const ROUTE_DELHI_JAIPUR = [
  { coords: [77.2090, 28.6139], place: 'Okhla Industrial Phase 3, Delhi',         city: 'Delhi',      state: 'Delhi'       },
  { coords: [76.9000, 28.3500], place: 'NH-48, Gurugram',                          city: 'Gurugram',   state: 'Haryana'     },
  { coords: [76.6240, 28.1960], place: 'NH-48, Rewari',                            city: 'Rewari',     state: 'Haryana'     },
  { coords: [76.6125, 27.5530], place: 'NH-48, Alwar',                             city: 'Alwar',      state: 'Rajasthan'   },
];

function makeTrackingPoints(waypointList, driverId, bookingId, baseHoursAgo) {
  return waypointList.map((wp, i) => ({
    driver:   driverId,
    booking:  bookingId,
    location: { type: 'Point', coordinates: wp.coords },
    speed:    i === 0 ? 0 : 55 + Math.floor(Math.random() * 20),
    heading:  180 + Math.floor(Math.random() * 40),
    accuracy: 8 + Math.floor(Math.random() * 10),
    battery:  90 - i * 4,
    isMoving: i > 0,
    activity: i === 0 ? 'still' : 'driving',
    source:   'app',
    place:    wp.place,
    city:     wp.city,
    state:    wp.state,
    ts: new Date(Date.now() - (baseHoursAgo - i * 1.5) * 3600000),
  }));
}

// ─── Helpers ────────────────────────────────────────────────────────────────
async function findCustomerByPhone(phone) {
  // Normalize phone: try both with and without +91 prefix
  const variants = [phone, phone.replace(/^\+/, ''), `+${phone.replace(/^\+/, '')}`];
  const user = await User.findOne({ phone: { $in: variants }, isDeleted: false });
  if (!user) throw new Error(`No user found for phone: ${phone}`);
  const customer = await Customer.findOne({ user: user._id, isDeleted: false });
  if (!customer) throw new Error(`No Customer profile for user: ${user._id} (phone: ${phone})`);
  return customer;
}

// ─── Reassign existing seeded bookings ──────────────────────────────────────
async function reassign({ phone, customerId }) {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  await mongoose.connect(mongoURI);
  console.log('📦 Connected to MongoDB');

  let customer;
  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer) throw new Error(`No Customer found with _id: ${customerId}`);
  } else {
    customer = await findCustomerByPhone(phone);
  }
  console.log(`✅  Customer found: ${customer.companyName} (${customer._id})`);

  // Find the seed customer (first "New Customer" — the one seed script defaults to)
  const seedCustomer = await Customer.findOne({ companyName: 'New Customer', isDeleted: false }).sort({ createdAt: 1 });

  // Find all bookings that belong to the seed customer but NOT yet to the target customer
  const query = seedCustomer && !seedCustomer._id.equals(customer._id)
    ? { customer: seedCustomer._id, isDeleted: false }
    : { customer: customer._id, isDeleted: false }; // already correct, just refresh payments

  const bookings = await Booking.find(query).select('_id bookingId');
  const bookingIds = bookings.map(b => b._id);

  const result = await Booking.updateMany(
    { _id: { $in: bookingIds } },
    { $set: { customer: customer._id } }
  );
  const pRes = await Payment.updateMany(
    { booking: { $in: bookingIds } },
    { $set: { customer: customer._id } }
  );

  console.log(`✅  Updated ${result.modifiedCount} bookings → customer ${customer._id}`);
  console.log(`✅  Updated ${pRes.modifiedCount} payments  → customer ${customer._id}`);
  console.log('\nAll seeded bookings now belong to your account. Happy testing! 🎉');

  await mongoose.disconnect();
  process.exit(0);
}

// ─── Main seed ─────────────────────────────────────────────────────────────
async function seed() {
  // Handle --reassign mode
  if (REASSIGN_MODE) {
    await reassign({ phone: REASSIGN_PHONE, customerId: CUSTOMER_ID_ARG });
    return;
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  await mongoose.connect(mongoURI);
  console.log('📦 Connected to MongoDB');

  // ── 0. Clean up any previously seeded data ────────────────────────────
  const seededIds = [
    'BK2603000012','BK2603000013','BK2603000014','BK2603000015',
    'BK2603000016','BK2603000017','BK2603000018','BK2603000019',
    'BK2603000020','BK2603000021',
  ];
  const oldBookings = await Booking.find({ bookingId: { $in: seededIds } }).select('_id');
  if (oldBookings.length > 0) {
    const oldIds = oldBookings.map(b => b._id);
    await Tracking.deleteMany({ booking: { $in: oldIds } });
    await Payment.deleteMany({ booking: { $in: oldIds } });
    await Document.deleteMany({ 'ownerRef.item': { $in: oldIds }, 'ownerRef.kind': 'booking' });
    await Booking.deleteMany({ bookingId: { $in: seededIds } });
    console.log(`🧹  Cleaned up ${oldBookings.length} old seeded bookings + their payments, tracking & documents`);
  }

  // ── 1. Find Customer ────────────────────────────────────────────────────
  let customer;
  if (PHONE_ARG) {
    customer = await findCustomerByPhone(PHONE_ARG);
    console.log(`✅  Using customer for phone ${PHONE_ARG}: ${customer.companyName} (${customer._id})`);
  } else {
    customer = await Customer.findOne({ companyName: 'New Customer', isDeleted: false });
    if (!customer) {
      console.error('❌  No "New Customer" found. Pass your login phone: --phone 91XXXXXXXXXX');
      process.exit(1);
    }
    console.log(`✅  Found customer: ${customer.companyName} (${customer._id})`);
  }

  // ── 2. Seed test drivers + vehicles ───────────────────────────────────
  const driverData = [
    {
      userPhone: '+919800100001',
      name: 'Ramesh Kumar',
      license: 'MP09-20180045231',
      vehicleNumber: 'MP09AB1234',
      truckType: 'container-20ft',
      bodyType: 'container',
      length: 20,
      capacity: 20,
    },
    {
      userPhone: '+919800100002',
      name: 'Suresh Singh',
      license: 'MH14-20190078456',
      vehicleNumber: 'MH14CD5678',
      truckType: 'eicher-17ft',
      bodyType: 'closed',
      length: 17,
      capacity: 7,
    },
  ];

  const drivers  = [];
  const vehicles = [];

  for (const d of driverData) {
    // User
    let user = await User.findOne({ phone: d.userPhone });
    if (!user) {
      user = await User.create({
        phone: d.userPhone,
        role: 'driver',
        status: 'active',
      });
    }

    // Driver
    let driver = await Driver.findOne({ user: user._id });
    if (!driver) {
      driver = await Driver.create({
        user: user._id,
        name: d.name,
        licenseNumber: d.license,
        licenseExpiry: new Date('2028-12-31'),
        availability: 'on-trip',
        isOnline: true,
        phone: d.userPhone,
      });
    }
    drivers.push(driver);

    // Vehicle
    let vehicle = await Vehicle.findOne({ vehicleNumber: d.vehicleNumber });
    if (!vehicle) {
      vehicle = await Vehicle.create({
        vehicleNumber: d.vehicleNumber,
        truckType: d.truckType,
        bodyType: d.bodyType,
        length: { value: d.length, unit: 'ft' },
        capacity: { value: d.capacity, unit: 'tons' },
        owner: driver._id,
        expiryDates: { insurance: new Date('2027-12-31') },
      });
    }
    vehicles.push(vehicle);
  }

  const [driver1, driver2] = drivers;
  const [vehicle1, vehicle2] = vehicles;
  console.log(`✅  Drivers ready:  ${driver1.name}, ${driver2.name}`);
  console.log(`✅  Vehicles ready: ${vehicle1.vehicleNumber}, ${vehicle2.vehicleNumber}`);

  // ── 3. Booking definitions ─────────────────────────────────────────────
  const bookingDefs = [
    // 1. just created — unpaid
    {
      status: 'created',
      pickup: addr('indore',  'Plot 12, Industrial Area Phase 1', { name: 'Ajay Sharma',  phone: '9712300001' }),
      drop:   addr('mumbai',  'JNPT Warehouse Gate 7',            { name: 'Priya Mehta',  phone: '9712300002' }),
      materialType: 'electronics',
      weight: { value: 4000, unit: 'kg' },
      truckTypeNeeded: 'container-20ft',
      bodyType: 'container',
      loadDate: daysAgo(0),
      loadTime: '09:00',
      expectedDeliveryDate: daysAgo(-2),
      expectedAmount: 45000,
      finalAmount: 45000,
      advanceRequired: 10000,
      paymentStatus: 'unpaid',
      bookingSource: 'mobile-app',
      priority: 'high',
      statusHistory: [
        { status: 'created', timestamp: hoursAgo(4) },
      ],
    },

    // 2. under-review — unpaid
    {
      status: 'under-review',
      pickup: addr('mumbai',  'BKC Commercial Complex B2',        { name: 'Rohit Jain',   phone: '9712300003' }),
      drop:   addr('delhi',   'Naraina Industrial Area Phase 2',  { name: 'Kavita Gupta', phone: '9712300004' }),
      materialType: 'textiles',
      weight: { value: 6500, unit: 'kg' },
      truckTypeNeeded: '32ft-sxl',
      bodyType: 'closed',
      loadDate: daysAgo(1),
      loadTime: '08:00',
      expectedDeliveryDate: daysAgo(-1),
      expectedAmount: 32000,
      finalAmount: 32000,
      advanceRequired: 8000,
      paymentStatus: 'unpaid',
      bookingSource: 'mobile-app',
      priority: 'medium',
      statusHistory: [
        { status: 'created',      timestamp: daysAgo(2)    },
        { status: 'under-review', timestamp: hoursAgo(20)  },
      ],
    },

    // 3. assigned — partial (advance paid via cash)
    {
      status: 'assigned',
      pickup: addr('indore',  'Sanwer Road Industrial Area',      { name: 'Manoj Yadav',  phone: '9712300005' }),
      drop:   addr('bhopal',  'Mandideep Industrial Estate B5',   { name: 'Sonia Tiwari', phone: '9712300006' }),
      materialType: 'FMCG',
      weight: { value: 2800, unit: 'kg' },
      truckTypeNeeded: 'eicher-17ft',
      bodyType: 'closed',
      loadDate: daysAgo(1),
      loadTime: '10:00',
      expectedDeliveryDate: daysAgo(0),
      expectedAmount: 12000,
      finalAmount: 12000,
      advanceRequired: 5000,
      paymentStatus: 'partial',
      driver: driver2._id,
      vehicle: vehicle2._id,
      assignedAt: daysAgo(1),
      bookingSource: 'mobile-app',
      priority: 'medium',
      statusHistory: [
        { status: 'created',  timestamp: daysAgo(3)  },
        { status: 'assigned', timestamp: daysAgo(1)  },
      ],
    },

    // 4. in-transit — partial (advance paid online), WITH GPS tracking
    {
      status: 'in-transit',
      pickup: addr('indore',  'Dewas Naka Warehouse Complex',     { name: 'Vivek Patil',  phone: '9712300007' }),
      drop:   addr('mumbai',  'Bhiwandi Logistics Park Gate 3',   { name: 'Anita Desai',  phone: '9712300008' }),
      materialType: 'steel',
      weight: { value: 18000, unit: 'kg' },
      truckTypeNeeded: 'container-20ft',
      bodyType: 'container',
      loadDate: daysAgo(2),
      loadTime: '07:00',
      expectedDeliveryDate: daysAgo(-1),
      expectedAmount: 55000,
      finalAmount: 55000,
      advanceRequired: 15000,
      paymentStatus: 'partial',
      driver: driver1._id,
      vehicle: vehicle1._id,
      assignedAt: daysAgo(3),
      lastKnownLocation: { type: 'Point', coordinates: ROUTE_INDORE_MUMBAI[ROUTE_INDORE_MUMBAI.length - 1].coords },
      lastLocationUpdate: hoursAgo(1),
      estimatedRoute: {
        distance: 590000,   // metres
        duration: 35280,    // seconds (~9.8 hrs)
        polyline: '',
        calculatedAt: daysAgo(2),
      },
      bookingSource: 'mobile-app',
      priority: 'high',
      statusHistory: [
        { status: 'created',        timestamp: daysAgo(4)    },
        { status: 'assigned',       timestamp: daysAgo(3)    },
        { status: 'driver-en-route', timestamp: daysAgo(2)   },
        { status: 'reached-pickup', timestamp: daysAgo(2)    },
        { status: 'loaded',         timestamp: hoursAgo(36)  },
        { status: 'in-transit',     timestamp: hoursAgo(30)  },
      ],
    },

    // 5. in-transit — partial (advance paid cash), WITH GPS tracking
    {
      status: 'in-transit',
      pickup: addr('delhi',   'Okhla Industrial Phase 3',         { name: 'Deepak Arora', phone: '9712300009' }),
      drop:   addr('jaipur',  'Sitapura Industrial Area Plot 45', { name: 'Meena Shah',   phone: '9712300010' }),
      materialType: 'furniture',
      weight: { value: 5500, unit: 'kg' },
      truckTypeNeeded: 'eicher-17ft',
      bodyType: 'closed',
      loadDate: daysAgo(1),
      loadTime: '06:00',
      expectedDeliveryDate: daysAgo(0),
      expectedAmount: 18000,
      finalAmount: 18000,
      advanceRequired: 5000,
      paymentStatus: 'partial',
      driver: driver2._id,
      vehicle: vehicle2._id,
      assignedAt: daysAgo(2),
      lastKnownLocation: { type: 'Point', coordinates: ROUTE_DELHI_JAIPUR[ROUTE_DELHI_JAIPUR.length - 1].coords },
      lastLocationUpdate: hoursAgo(0.5),
      estimatedRoute: {
        distance: 270000,
        duration: 14940,
        polyline: '',
        calculatedAt: daysAgo(1),
      },
      bookingSource: 'mobile-app',
      priority: 'medium',
      statusHistory: [
        { status: 'created',         timestamp: daysAgo(3)   },
        { status: 'assigned',        timestamp: daysAgo(2)   },
        { status: 'driver-en-route', timestamp: daysAgo(1)   },
        { status: 'reached-pickup',  timestamp: hoursAgo(20) },
        { status: 'loaded',          timestamp: hoursAgo(18) },
        { status: 'in-transit',      timestamp: hoursAgo(16) },
      ],
    },

    // 6. reached-destination — partial (advance paid online)
    {
      status: 'reached-destination',
      pickup: addr('mumbai',  'Andheri East MIDC',                { name: 'Sanjay Rao',   phone: '9712300011' }),
      drop:   addr('pune',    'Chakan Industrial Zone Shed 12',   { name: 'Pooja Nair',   phone: '9712300012' }),
      materialType: 'pharma',
      weight: { value: 3200, unit: 'kg' },
      truckTypeNeeded: 'eicher-14ft',
      bodyType: 'closed',
      loadDate: daysAgo(2),
      loadTime: '08:30',
      expectedDeliveryDate: daysAgo(1),
      expectedAmount: 25000,
      finalAmount: 25000,
      advanceRequired: 8000,
      paymentStatus: 'partial',
      driver: driver1._id,
      vehicle: vehicle1._id,
      assignedAt: daysAgo(3),
      bookingSource: 'mobile-app',
      priority: 'high',
      statusHistory: [
        { status: 'created',             timestamp: daysAgo(4)    },
        { status: 'assigned',            timestamp: daysAgo(3)    },
        { status: 'driver-en-route',     timestamp: daysAgo(2)    },
        { status: 'reached-pickup',      timestamp: hoursAgo(48)  },
        { status: 'loaded',              timestamp: hoursAgo(46)  },
        { status: 'in-transit',          timestamp: hoursAgo(44)  },
        { status: 'reached-destination', timestamp: hoursAgo(4)   },
      ],
    },

    // 7. delivered — partial (advance only paid via NEFT)
    {
      status: 'delivered',
      pickup: addr('indore',  'Pithampur Industrial Area Sector 1', { name: 'Arun Joshi',   phone: '9712300013' }),
      drop:   addr('nagpur',  'Butibori Industrial Estate Plot 9',  { name: 'Rekha Shinde', phone: '9712300014' }),
      materialType: 'cement',
      weight: { value: 22000, unit: 'kg' },
      truckTypeNeeded: 'taurus-25',
      bodyType: 'open',
      loadDate: daysAgo(4),
      loadTime: '07:00',
      expectedDeliveryDate: daysAgo(3),
      expectedAmount: 35000,
      finalAmount: 35000,
      advanceRequired: 10000,
      paymentStatus: 'partial',
      driver: driver2._id,
      vehicle: vehicle2._id,
      assignedAt: daysAgo(5),
      bookingSource: 'mobile-app',
      priority: 'medium',
      statusHistory: [
        { status: 'created',             timestamp: daysAgo(6)   },
        { status: 'assigned',            timestamp: daysAgo(5)   },
        { status: 'driver-en-route',     timestamp: daysAgo(4)   },
        { status: 'reached-pickup',      timestamp: daysAgo(4)   },
        { status: 'loaded',              timestamp: daysAgo(4)   },
        { status: 'in-transit',          timestamp: daysAgo(4)   },
        { status: 'reached-destination', timestamp: daysAgo(3)   },
        { status: 'delivered',           timestamp: daysAgo(3)   },
      ],
    },

    // 8. pod-received — fully paid (online PhonePe)
    {
      status: 'pod-received',
      pickup: addr('delhi',      'Bahadurgarh Industrial Area',      { name: 'Kiran Singh',  phone: '9712300015' }),
      drop:   addr('chandigarh', 'Phase 8 Industrial Area Plot 120', { name: 'Gurpreet Pal', phone: '9712300016' }),
      materialType: 'FMCG',
      weight: { value: 4800, unit: 'kg' },
      truckTypeNeeded: 'eicher-19ft',
      bodyType: 'closed',
      loadDate: daysAgo(5),
      loadTime: '06:00',
      expectedDeliveryDate: daysAgo(4),
      expectedAmount: 15000,
      finalAmount: 15000,
      advanceRequired: 5000,
      paymentStatus: 'paid',
      driver: driver1._id,
      vehicle: vehicle1._id,
      assignedAt: daysAgo(6),
      podUploadedAt: daysAgo(3),
      podDetails: {
        receiverName: 'Gurpreet Pal',
        receiverPhone: '9712300016',
        deliveredAt: daysAgo(4),
        remarks: 'All items received in good condition',
      },
      bookingSource: 'mobile-app',
      priority: 'medium',
      statusHistory: [
        { status: 'created',             timestamp: daysAgo(7)  },
        { status: 'assigned',            timestamp: daysAgo(6)  },
        { status: 'driver-en-route',     timestamp: daysAgo(5)  },
        { status: 'reached-pickup',      timestamp: daysAgo(5)  },
        { status: 'loaded',              timestamp: daysAgo(5)  },
        { status: 'in-transit',          timestamp: daysAgo(5)  },
        { status: 'reached-destination', timestamp: daysAgo(4)  },
        { status: 'delivered',           timestamp: daysAgo(4)  },
        { status: 'pod-received',        timestamp: daysAgo(3)  },
      ],
    },

    // 9. closed — fully paid (advance online + balance NEFT)
    {
      status: 'closed',
      pickup: addr('mumbai', 'Bhiwandi Logistics Hub Zone A',       { name: 'Farhan Khan',  phone: '9712300017' }),
      drop:   addr('surat',  'Sachin GIDC Industrial Estate D-12',  { name: 'Hetal Patel',  phone: '9712300018' }),
      materialType: 'automobile-parts',
      weight: { value: 9500, unit: 'kg' },
      truckTypeNeeded: '32ft-sxl',
      bodyType: 'open',
      loadDate: daysAgo(8),
      loadTime: '07:30',
      expectedDeliveryDate: daysAgo(7),
      expectedAmount: 28000,
      finalAmount: 28000,
      advanceRequired: 8000,
      paymentStatus: 'paid',
      driver: driver2._id,
      vehicle: vehicle2._id,
      assignedAt: daysAgo(9),
      podUploadedAt: daysAgo(6),
      podDetails: {
        receiverName: 'Hetal Patel',
        receiverPhone: '9712300018',
        deliveredAt: daysAgo(7),
        remarks: 'Delivery completed. Parts inspected OK.',
      },
      bookingSource: 'mobile-app',
      priority: 'medium',
      statusHistory: [
        { status: 'created',             timestamp: daysAgo(10) },
        { status: 'assigned',            timestamp: daysAgo(9)  },
        { status: 'driver-en-route',     timestamp: daysAgo(8)  },
        { status: 'reached-pickup',      timestamp: daysAgo(8)  },
        { status: 'loaded',              timestamp: daysAgo(8)  },
        { status: 'in-transit',          timestamp: daysAgo(8)  },
        { status: 'reached-destination', timestamp: daysAgo(7)  },
        { status: 'delivered',           timestamp: daysAgo(7)  },
        { status: 'pod-received',        timestamp: daysAgo(6)  },
        { status: 'closed',              timestamp: daysAgo(5)  },
      ],
    },

    // 10. cancelled — unpaid
    {
      status: 'cancelled',
      pickup: addr('indore',    'Palasia Commercial Hub',           { name: 'Ravi Dubey',   phone: '9712300019' }),
      drop:   addr('ahmedabad', 'Vatva GIDC Phase 1 Shed 34',       { name: 'Nilesh Shah',  phone: '9712300020' }),
      materialType: 'chemicals',
      weight: { value: 12000, unit: 'kg' },
      truckTypeNeeded: 'container-20ft',
      bodyType: 'container',
      loadDate: daysAgo(3),
      loadTime: '09:00',
      expectedDeliveryDate: daysAgo(2),
      expectedAmount: 38000,
      finalAmount: 38000,
      advanceRequired: 12000,
      paymentStatus: 'unpaid',
      bookingSource: 'mobile-app',
      priority: 'medium',
      cancellationDetails: {
        cancelledAt: daysAgo(2),
        reason: 'Customer changed dispatch schedule',
        cancellationCharges: 0,
      },
      statusHistory: [
        { status: 'created',    timestamp: daysAgo(4) },
        { status: 'cancelled',  timestamp: daysAgo(2) },
      ],
    },
  ];

  // ── 4. Create bookings ─────────────────────────────────────────────────
  console.log('\n📝  Creating bookings...');
  const createdBookings = [];

  for (const [i, def] of bookingDefs.entries()) {
    const booking = new Booking({
      ...def,
      customer: customer._id,
      isDeleted: false,
    });
    await booking.save();
    createdBookings.push(booking);
    console.log(`   ${i + 1}. ${booking.bookingId}  [${booking.status}]  ${def.pickup.city} → ${def.drop.city}`);
  }

  // ── 5. Create payments ─────────────────────────────────────────────────
  console.log('\n💰  Creating payments...');

  const paymentDefs = [
    // Booking 3 (assigned) — advance cash
    {
      bookingIdx: 2,
      payments: [
        { amount: 5000, method: 'cash', gateway: 'manual', paidAt: daysAgo(1), ref: null, note: 'Advance paid in cash before dispatch' },
      ],
    },
    // Booking 4 (in-transit) — advance online PhonePe
    {
      bookingIdx: 3,
      payments: [
        { amount: 15000, method: 'online', gateway: 'phonepe', paidAt: daysAgo(2), txn: `TXN${Date.now()}001`, note: 'Advance via PhonePe' },
      ],
    },
    // Booking 5 (in-transit) — advance cash
    {
      bookingIdx: 4,
      payments: [
        { amount: 5000, method: 'cash', gateway: 'manual', paidAt: daysAgo(1), ref: null, note: 'Advance paid in cash' },
      ],
    },
    // Booking 6 (reached-destination) — advance online
    {
      bookingIdx: 5,
      payments: [
        { amount: 8000, method: 'online', gateway: 'phonepe', paidAt: daysAgo(2), txn: `TXN${Date.now()}002`, note: 'Advance via PhonePe' },
      ],
    },
    // Booking 7 (delivered) — advance NEFT
    {
      bookingIdx: 6,
      payments: [
        { amount: 10000, method: 'neft', gateway: 'manual', paidAt: daysAgo(4), ref: 'NEFT2603001234', note: 'Advance via NEFT' },
      ],
    },
    // Booking 8 (pod-received) — fully paid (advance + balance)
    {
      bookingIdx: 7,
      payments: [
        { amount: 5000,  method: 'online', gateway: 'phonepe', paidAt: daysAgo(5), txn: `TXN${Date.now()}003`, note: 'Advance via PhonePe' },
        { amount: 10000, method: 'online', gateway: 'phonepe', paidAt: daysAgo(3), txn: `TXN${Date.now()}004`, note: 'Balance via PhonePe' },
      ],
    },
    // Booking 9 (closed) — fully paid (advance online + balance NEFT)
    {
      bookingIdx: 8,
      payments: [
        { amount: 8000,  method: 'online', gateway: 'phonepe', paidAt: daysAgo(8),  txn: `TXN${Date.now()}005`, note: 'Advance via PhonePe' },
        { amount: 20000, method: 'neft',   gateway: 'manual',  paidAt: daysAgo(5),  ref: 'NEFT2603005678', note: 'Balance via NEFT' },
      ],
    },
  ];

  for (const pd of paymentDefs) {
    const booking = createdBookings[pd.bookingIdx];
    for (const p of pd.payments) {
      const payment = await Payment.create({
        booking:         booking._id,
        customer:        customer._id,
        amount:          p.amount,
        paymentMethod:   p.method,
        gateway:         p.gateway,
        status:          'success',
        transactionId:   p.txn  || null,
        referenceNumber: p.ref  || null,
        remarks:         p.note || null,
        paidAt:          p.paidAt,
        merchantTransactionId: p.txn ? `MT${p.txn}` : undefined,
      });
      booking.payments.push(payment._id);
      console.log(`   Booking ${booking.bookingId}: ₹${p.amount} via ${p.method}`);
    }
    await Booking.findByIdAndUpdate(booking._id, { payments: booking.payments });
  }

  // ── 6. GPS tracking for in-transit bookings ────────────────────────────
  console.log('\n📡  Creating GPS tracking data...');

  // Booking 4: Indore → Mumbai (6 waypoints, started 30 hrs ago)
  const b4 = createdBookings[3]; // in-transit Indore→Mumbai
  const trackPts4 = makeTrackingPoints(ROUTE_INDORE_MUMBAI, driver1._id, b4._id, 30);
  await Tracking.insertMany(trackPts4);
  console.log(`   ${b4.bookingId} (Indore→Mumbai): ${trackPts4.length} GPS points`);

  // Booking 5: Delhi → Jaipur (4 waypoints, started 16 hrs ago)
  const b5 = createdBookings[4]; // in-transit Delhi→Jaipur
  const trackPts5 = makeTrackingPoints(ROUTE_DELHI_JAIPUR, driver2._id, b5._id, 16);
  await Tracking.insertMany(trackPts5);
  console.log(`   ${b5.bookingId} (Delhi→Jaipur):  ${trackPts5.length} GPS points`);

  // ── 7. LR and POD documents ───────────────────────────────────────────
  console.log('\n📄  Creating LR and POD documents...');

  // Sample placeholder image (publicly accessible, no Cloudinary upload needed)
  const SAMPLE_IMG = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';
  const SAMPLE_PDF = 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.jpg';

  // Bookings that should have LR: assigned (idx 2), in-transit×2 (idx 3,4),
  // reached-destination (idx 5), delivered (idx 6), pod-received (idx 7), closed (idx 8)
  const lrBookingIdxs = [2, 3, 4, 5, 6, 7, 8];

  for (const idx of lrBookingIdxs) {
    const b = createdBookings[idx];
    const lrDoc = await Document.create({
      ownerRef: { kind: 'booking', item: b._id },
      type: 'lr',
      provider: 'cloudinary',
      providerId: `seed/lr_${b.bookingId}`,
      url: SAMPLE_IMG,
      format: 'jpg',
      resourceType: 'image',
      bytes: 204800,
      folder: 'cloudtruck/lr',
      status: 'verified',
      uploadedAt: b.loadDate || daysAgo(idx),
    });

    await Booking.findByIdAndUpdate(b._id, {
      'lrDetails.lrNumber': `LR${b.bookingId.replace('BK', '')}`,
      'lrDetails.lrDate': b.loadDate || daysAgo(idx),
      'lrDetails.remarks': 'Goods loaded and sealed',
      'lrDetails.documents': [lrDoc._id],
      'lrDetails.uploadedAt': b.loadDate || daysAgo(idx),
    });

    console.log(`   LR → ${b.bookingId}  (doc: ${lrDoc._id})`);
  }

  // Bookings that should have POD: pod-received (idx 7), closed (idx 8)
  const podBookingIdxs = [7, 8];

  for (const idx of podBookingIdxs) {
    const b = createdBookings[idx];
    const podDoc = await Document.create({
      ownerRef: { kind: 'booking', item: b._id },
      type: 'pod',
      provider: 'cloudinary',
      providerId: `seed/pod_${b.bookingId}`,
      url: SAMPLE_PDF,
      format: 'jpg',
      resourceType: 'image',
      bytes: 153600,
      folder: 'cloudtruck/pod',
      status: 'verified',
      uploadedAt: b.podUploadedAt || daysAgo(idx - 4),
    });

    await Booking.findByIdAndUpdate(b._id, {
      $push: { podDocuments: podDoc._id },
    });

    console.log(`   POD → ${b.bookingId}  (doc: ${podDoc._id})`);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n✅  Demo seed complete!');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Bookings created:');
  createdBookings.forEach(b => {
    console.log(`  ${b.bookingId}  [${b.status.padEnd(20)}]  paymentStatus: ${b.paymentStatus}`);
  });
  console.log('\nFilter test cheatsheet:');
  console.log('  status=created           → 1 booking');
  console.log('  status=under-review      → 1 booking');
  console.log('  status=assigned          → 1 booking');
  console.log('  status=in-transit        → 2 bookings (with GPS tracking)');
  console.log('  status=reached-destination → 1 booking');
  console.log('  status=delivered         → 1 booking');
  console.log('  status=pod-received      → 1 booking');
  console.log('  status=closed            → 1 booking');
  console.log('  status=cancelled         → 1 booking');
  console.log('  paymentStatus=unpaid     → 3 bookings');
  console.log('  paymentStatus=partial    → 5 bookings');
  console.log('  paymentStatus=paid       → 2 bookings');
  console.log('─────────────────────────────────────────────────────────────');

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Seed failed:', err.message || err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
