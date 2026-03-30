import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';
import RoleTemplate from '../models/roleTemplate.model.js';
import MasterData from '../models/masterData.model.js';

dotenv.config();

const seedMasterData = async () => {
  console.log('Seeding master data...');

  const masterDataItems = [
    // Truck Types
    { category: 'truck-type', key: 'tata-ace', displayName: 'Tata Ace', displayOrder: 1 },
    { category: 'truck-type', key: 'pickup-8ft', displayName: 'Pickup 8ft', displayOrder: 2 },
    { category: 'truck-type', key: 'pickup-10ft', displayName: 'Pickup 10ft', displayOrder: 3 },
    { category: 'truck-type', key: 'tata-407', displayName: 'Tata 407', displayOrder: 4 },
    { category: 'truck-type', key: 'eicher-14ft', displayName: 'Eicher 14ft', displayOrder: 5 },
    { category: 'truck-type', key: 'eicher-17ft', displayName: 'Eicher 17ft', displayOrder: 6 },
    { category: 'truck-type', key: 'eicher-19ft', displayName: 'Eicher 19ft', displayOrder: 7 },
    { category: 'truck-type', key: 'taurus-16', displayName: 'Taurus 16', displayOrder: 8 },
    { category: 'truck-type', key: 'taurus-25', displayName: 'Taurus 25', displayOrder: 9 },
    { category: 'truck-type', key: '32ft-sxl', displayName: '32ft SXL', displayOrder: 10 },
    { category: 'truck-type', key: '32ft-mxl', displayName: '32ft MXL', displayOrder: 11 },
    { category: 'truck-type', key: 'container-20ft', displayName: 'Container 20ft', displayOrder: 12 },
    { category: 'truck-type', key: 'container-32ft', displayName: 'Container 32ft', displayOrder: 13 },
    { category: 'truck-type', key: 'container-40ft', displayName: 'Container 40ft', displayOrder: 14 },

    // Material Types
    { category: 'material-type', key: 'fmcg', displayName: 'FMCG', displayOrder: 1 },
    { category: 'material-type', key: 'electronics', displayName: 'Electronics', displayOrder: 2 },
    { category: 'material-type', key: 'furniture', displayName: 'Furniture', displayOrder: 3 },
    { category: 'material-type', key: 'steel', displayName: 'Steel', displayOrder: 4 },
    { category: 'material-type', key: 'cement', displayName: 'Cement', displayOrder: 5 },
    { category: 'material-type', key: 'tiles', displayName: 'Tiles', displayOrder: 6 },
    { category: 'material-type', key: 'chemicals', displayName: 'Chemicals', displayOrder: 7 },
    { category: 'material-type', key: 'textiles', displayName: 'Textiles', displayOrder: 8 },
    { category: 'material-type', key: 'agriculture', displayName: 'Agriculture Products', displayOrder: 9 },
    { category: 'material-type', key: 'automobile-parts', displayName: 'Automobile Parts', displayOrder: 10 },
    { category: 'material-type', key: 'machinery', displayName: 'Machinery', displayOrder: 11 },
    { category: 'material-type', key: 'paper', displayName: 'Paper', displayOrder: 12 },
    { category: 'material-type', key: 'pharma', displayName: 'Pharmaceutical', displayOrder: 13 },
    { category: 'material-type', key: 'plastic', displayName: 'Plastic', displayOrder: 14 },
    { category: 'material-type', key: 'food-grains', displayName: 'Food Grains', displayOrder: 15 },
    { category: 'material-type', key: 'vegetables-fruits', displayName: 'Vegetables & Fruits', displayOrder: 16 },
    { category: 'material-type', key: 'general-cargo', displayName: 'General Cargo', displayOrder: 17 },

    // Charge Types
    { category: 'charge-type', key: 'base-freight', displayName: 'Base Freight', displayOrder: 1 },
    { category: 'charge-type', key: 'loading-charges', displayName: 'Loading Charges', displayOrder: 2 },
    { category: 'charge-type', key: 'unloading-charges', displayName: 'Unloading Charges', displayOrder: 3 },
    { category: 'charge-type', key: 'detention-charges', displayName: 'Detention Charges', displayOrder: 4 },
    { category: 'charge-type', key: 'toll-charges', displayName: 'Toll Charges', displayOrder: 5 },
    { category: 'charge-type', key: 'other-charges', displayName: 'Other Charges', displayOrder: 6 },
    { category: 'charge-type', key: 'discount', displayName: 'Discount', displayOrder: 7 },

    // Body Types
    { category: 'body-type', key: 'open', displayName: 'Open', displayOrder: 1 },
    { category: 'body-type', key: 'closed', displayName: 'Closed', displayOrder: 2 },
    { category: 'body-type', key: 'container', displayName: 'Container', displayOrder: 3 },
    { category: 'body-type', key: 'tanker', displayName: 'Tanker', displayOrder: 4 },
    { category: 'body-type', key: 'flatbed', displayName: 'Flatbed', displayOrder: 5 },
    { category: 'body-type', key: 'refrigerated', displayName: 'Refrigerated', displayOrder: 6 },

    // Document Types
    { category: 'document-type', key: 'pod', displayName: 'Proof of Delivery (POD)', displayOrder: 1 },
    { category: 'document-type', key: 'invoice', displayName: 'Invoice', displayOrder: 2 },
    { category: 'document-type', key: 'lr', displayName: 'Lorry Receipt (LR)', displayOrder: 3 },
    { category: 'document-type', key: 'eway-bill', displayName: 'E-Way Bill', displayOrder: 4 },
    { category: 'document-type', key: 'vehicle-rc', displayName: 'Vehicle RC', displayOrder: 5 },
    { category: 'document-type', key: 'insurance', displayName: 'Insurance', displayOrder: 6 },
    { category: 'document-type', key: 'pollution', displayName: 'Pollution Certificate', displayOrder: 7 },
    { category: 'document-type', key: 'fitness', displayName: 'Fitness Certificate', displayOrder: 8 },
    { category: 'document-type', key: 'permit', displayName: 'Permit', displayOrder: 9 },
    { category: 'document-type', key: 'driver-license', displayName: 'Driver License', displayOrder: 10 },
    { category: 'document-type', key: 'cargo-photos', displayName: 'Cargo Photos', displayOrder: 11 },

    // Locations (source/destination — admin adds their own plants, warehouses, ports)
    // metadata: { city, state, address, type: 'plant'|'warehouse'|'port'|'depot' }
    { category: 'location', key: 'mum-plant-01', displayName: 'Mumbai Plant 1', displayOrder: 1, metadata: { city: 'Mumbai', state: 'Maharashtra', type: 'plant', address: 'Bhiwandi, Mumbai' } },
    { category: 'location', key: 'del-wh-01', displayName: 'Delhi Warehouse 1', displayOrder: 2, metadata: { city: 'Delhi', state: 'Delhi', type: 'warehouse', address: 'Kundli Industrial Area, Delhi' } },
    { category: 'location', key: 'blr-depot-01', displayName: 'Bangalore Depot', displayOrder: 3, metadata: { city: 'Bangalore', state: 'Karnataka', type: 'depot', address: 'Peenya Industrial Area, Bangalore' } },
    { category: 'location', key: 'hyd-plant-01', displayName: 'Hyderabad Plant', displayOrder: 4, metadata: { city: 'Hyderabad', state: 'Telangana', type: 'plant', address: 'Patancheru, Hyderabad' } },
    { category: 'location', key: 'che-port-01', displayName: 'Chennai Port', displayOrder: 5, metadata: { city: 'Chennai', state: 'Tamil Nadu', type: 'port', address: 'Chennai Port Trust, Chennai' } },
    { category: 'location', key: 'pun-wh-01', displayName: 'Pune Warehouse', displayOrder: 6, metadata: { city: 'Pune', state: 'Maharashtra', type: 'warehouse', address: 'Chakan Industrial Area, Pune' } },
    { category: 'location', key: 'ahm-depot-01', displayName: 'Ahmedabad Depot', displayOrder: 7, metadata: { city: 'Ahmedabad', state: 'Gujarat', type: 'depot', address: 'Naroda Industrial Area, Ahmedabad' } },
    { category: 'location', key: 'jnpt-port-01', displayName: 'JNPT Port', displayOrder: 8, metadata: { city: 'Navi Mumbai', state: 'Maharashtra', type: 'port', address: 'Jawaharlal Nehru Port, Navi Mumbai' } },

    // Lanes (predefined source→destination routes — auto-fills Source + Destination on indent)
    // metadata: { sourceKey, destinationKey, distanceKm, transitDays }
    { category: 'lane', key: 'mum-del-ln01', displayName: 'Mumbai → Delhi (LN01)', displayOrder: 1, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'del-wh-01', distanceKm: 1400, transitDays: 2 } },
    { category: 'lane', key: 'mum-blr-ln01', displayName: 'Mumbai → Bangalore (LN01)', displayOrder: 2, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'blr-depot-01', distanceKm: 980, transitDays: 2 } },
    { category: 'lane', key: 'del-hyd-ln01', displayName: 'Delhi → Hyderabad (LN01)', displayOrder: 3, metadata: { sourceKey: 'del-wh-01', destinationKey: 'hyd-plant-01', distanceKm: 1580, transitDays: 3 } },
    { category: 'lane', key: 'blr-che-ln01', displayName: 'Bangalore → Chennai (LN01)', displayOrder: 4, metadata: { sourceKey: 'blr-depot-01', destinationKey: 'che-port-01', distanceKm: 345, transitDays: 1 } },
    { category: 'lane', key: 'mum-pun-ln01', displayName: 'Mumbai → Pune (LN01)', displayOrder: 5, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'pun-wh-01', distanceKm: 150, transitDays: 1 } },
    { category: 'lane', key: 'ahm-del-ln01', displayName: 'Ahmedabad → Delhi (LN01)', displayOrder: 6, metadata: { sourceKey: 'ahm-depot-01', destinationKey: 'del-wh-01', distanceKm: 930, transitDays: 2 } },

    // Cost Centers (internal accounting / department codes)
    // metadata: { department, glCode }
    { category: 'cost-center', key: 'cc-north-ops', displayName: 'North Operations', displayOrder: 1, metadata: { department: 'Operations', glCode: 'CC-N-001' } },
    { category: 'cost-center', key: 'cc-south-ops', displayName: 'South Operations', displayOrder: 2, metadata: { department: 'Operations', glCode: 'CC-S-001' } },
    { category: 'cost-center', key: 'cc-west-ops', displayName: 'West Operations', displayOrder: 3, metadata: { department: 'Operations', glCode: 'CC-W-001' } },
    { category: 'cost-center', key: 'cc-east-ops', displayName: 'East Operations', displayOrder: 4, metadata: { department: 'Operations', glCode: 'CC-E-001' } },
    { category: 'cost-center', key: 'cc-sales', displayName: 'Sales', displayOrder: 5, metadata: { department: 'Sales', glCode: 'CC-SAL-001' } },
    { category: 'cost-center', key: 'cc-exim', displayName: 'EXIM / Exports', displayOrder: 6, metadata: { department: 'EXIM', glCode: 'CC-EXI-001' } },
  ];

  await Promise.all(
    masterDataItems.map((item) =>
      MasterData.findOneAndUpdate(
        { category: item.category, key: item.key },
        { $set: item },
        { upsert: true, new: true }
      )
    )
  );

  console.log('✅ Master data seeded successfully');
};

const seedFieldPermissions = async () => {
  console.log('Seeding field permissions...');

  const fieldPermissions = [
    // Booking field permissions
    { key: 'booking.update.price', name: 'Update booking price', resource: 'booking', action: 'update' },
    { key: 'booking.update.paymentStatus', name: 'Update payment status', resource: 'booking', action: 'update' },
    { key: 'booking.update.driver', name: 'Assign/change driver', resource: 'booking', action: 'update' },
    { key: 'booking.update.vehicle', name: 'Assign/change vehicle', resource: 'booking', action: 'update' },
    { key: 'booking.update.status', name: 'Update booking status', resource: 'booking', action: 'update' },
    { key: 'booking.cancel', name: 'Cancel booking', resource: 'booking', action: 'cancel' },
    
    // Customer field permissions
    { key: 'customer.update.creditLimit', name: 'Update credit limit', resource: 'customer', action: 'update' },
    { key: 'customer.update.status', name: 'Update customer status', resource: 'customer', action: 'update' },
    { key: 'customer.update.pricing', name: 'Update customer pricing', resource: 'customer', action: 'update' },
    
    // Payment field permissions
    { key: 'payment.create.refund', name: 'Create refund', resource: 'payment', action: 'create' },
    { key: 'payment.update.status', name: 'Update payment status', resource: 'payment', action: 'update' },
    { key: 'payment.approve', name: 'Approve payment', resource: 'payment', action: 'approve' },
    
    // Driver field permissions
    { key: 'driver.update.status', name: 'Update driver status', resource: 'driver', action: 'update' },
    { key: 'driver.update.verification', name: 'Update verification status', resource: 'driver', action: 'update' },
    
    // Vehicle field permissions
    { key: 'vehicle.update.status', name: 'Update vehicle status', resource: 'vehicle', action: 'update' },
    
    // Organization permissions
    { key: 'organization.read', name: 'View organization settings', resource: 'organization', action: 'read' },
    { key: 'master-data.read', name: 'View master data', resource: 'master-data', action: 'read' },
    { key: 'account.read', name: 'View accounts', resource: 'account', action: 'read' },
  ];

  await Promise.all(
    fieldPermissions.map((permission) =>
      Permission.findOneAndUpdate(
        { key: permission.key },
        { $set: permission },
        { upsert: true, new: true }
      )
    )
  );

  console.log('✅ Field permissions seeded successfully');
};

const seedRoleTemplates = async () => {
  console.log('Seeding role templates...');

  // Get permissions by keys
  const allPermissions = await Permission.find({ isDeleted: false });
  const permissionMap = {};
  allPermissions.forEach(p => { permissionMap[p.key] = p._id; });

  const roleTemplates = [
    {
      templateName: 'Operations Manager',
      description: 'Full control over bookings, drivers, and vehicles',
      category: 'operations',
      permissions: [
        'booking.create',
        'booking.read',
        'booking.update.driver',
        'booking.update.vehicle',
        'booking.update.status',
        'driver.read',
        'driver.update_location',
        'vehicle.read',
        'organization.read',
        'master-data.read',
      ].map(key => permissionMap[key]).filter(Boolean),
    },
    {
      templateName: 'Finance User',
      description: 'Manage payments, pricing, and financial operations',
      category: 'finance',
      permissions: [
        'booking.read',
        'booking.update.price',
        'booking.update.paymentStatus',
        'customer.update.creditLimit',
        'customer.update.pricing',
        'payment.create.refund',
        'payment.update.status',
        'payment.approve',
        'organization.read',
        'account.read',
      ].map(key => permissionMap[key]).filter(Boolean),
    },
    {
      templateName: 'Customer Support',
      description: 'Handle customer queries and basic booking operations',
      category: 'support',
      permissions: [
        'booking.create',
        'booking.read',
        'customer.read',
        'driver.read',
        'reports.read',
        'organization.read',
        'master-data.read',
      ].map(key => permissionMap[key]).filter(Boolean),
    },
  ];

  await Promise.all(
    roleTemplates.map((template) =>
      RoleTemplate.findOneAndUpdate(
        { templateName: template.templateName },
        { $set: template },
        { upsert: true, new: true }
      )
    )
  );

  console.log('✅ Role templates seeded successfully');
};

const seed = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
    await mongoose.connect(mongoURI);
    console.log('📦 Connected to MongoDB');

    await seedFieldPermissions();
    await seedMasterData();
    await seedRoleTemplates();

    console.log('\n✅ All organization data seeded successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  }
};

seed();
