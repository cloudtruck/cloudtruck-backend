/**
 * seed-fresh.js
 *
 * Full reference-data seed for CloudTruck.
 * Run AFTER clear-data.js (or on a clean DB).
 *
 * Seeds (in dependency order):
 *   1. Permissions          — RBAC permission keys
 *   2. Role Templates       — permission bundles for staff roles
 *   3. Master Data          — truck types, body types, material types,
 *                             charge types, document types, locations,
 *                             lanes, cost centers
 *   4. Market Rates         — indicative freight rates per lane + truck type
 *   5. Branches             — regional offices
 *   6. Account              — primary company bank account
 *
 * Does NOT touch: users, organizationSettings, refreshTokens,
 *                 or any transactional collection (bookings, drivers, …)
 *
 * Run: node --env-file .env src/scripts/seed-fresh.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// ─── Model imports ────────────────────────────────────────────────────────────
import Permission    from '../models/permission.model.js';
import RoleTemplate  from '../models/roleTemplate.model.js';
import MasterData    from '../models/masterData.model.js';
import MarketRate    from '../models/marketRate.model.js';
import Branch        from '../models/branch.model.js';
import Account       from '../models/account.model.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const upsert = (Model, filter, data) =>
  Model.findOneAndUpdate(filter, { $set: data }, { upsert: true, new: true });

const section = (title) => {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. PERMISSIONS
// ══════════════════════════════════════════════════════════════════════════════
const PERMISSIONS = [
  // Booking
  { key: 'booking.create',        name: 'Create Booking',              resource: 'booking',       action: 'create' },
  { key: 'booking.read',          name: 'View Booking',                resource: 'booking',       action: 'read' },
  { key: 'booking.update',        name: 'Update Booking',              resource: 'booking',       action: 'update' },
  { key: 'booking.delete',        name: 'Delete Booking',              resource: 'booking',       action: 'delete' },
  { key: 'booking.assign',        name: 'Assign Driver to Booking',    resource: 'booking',       action: 'assign' },
  { key: 'booking.cancel',        name: 'Cancel Booking',              resource: 'booking',       action: 'cancel' },
  { key: 'booking.update-status', name: 'Update Booking Status',       resource: 'booking',       action: 'update-status' },
  { key: 'booking.manage',        name: 'Full Booking Management',     resource: 'booking',       action: 'manage' },

  // Driver
  { key: 'driver.create',   name: 'Create Driver',           resource: 'driver', action: 'create' },
  { key: 'driver.read',     name: 'View Driver',             resource: 'driver', action: 'read' },
  { key: 'driver.update',   name: 'Update Driver',           resource: 'driver', action: 'update' },
  { key: 'driver.delete',   name: 'Delete Driver',           resource: 'driver', action: 'delete' },
  { key: 'driver.approve',  name: 'Approve Driver',          resource: 'driver', action: 'approve' },
  { key: 'driver.reject',   name: 'Reject Driver',           resource: 'driver', action: 'reject' },
  { key: 'driver.block',    name: 'Block/Unblock Driver',    resource: 'driver', action: 'block' },
  { key: 'driver.manage',   name: 'Full Driver Management',  resource: 'driver', action: 'manage' },

  // Vehicle
  { key: 'vehicle.create',  name: 'Create Vehicle',          resource: 'vehicle', action: 'create' },
  { key: 'vehicle.read',    name: 'View Vehicle',            resource: 'vehicle', action: 'read' },
  { key: 'vehicle.update',  name: 'Update Vehicle',          resource: 'vehicle', action: 'update' },
  { key: 'vehicle.delete',  name: 'Delete Vehicle',          resource: 'vehicle', action: 'delete' },
  { key: 'vehicle.verify',  name: 'Verify Vehicle',          resource: 'vehicle', action: 'verify' },
  { key: 'vehicle.manage',  name: 'Full Vehicle Management', resource: 'vehicle', action: 'manage' },

  // Customer
  { key: 'customer.create',  name: 'Create Customer',          resource: 'customer', action: 'create' },
  { key: 'customer.read',    name: 'View Customer',            resource: 'customer', action: 'read' },
  { key: 'customer.update',  name: 'Update Customer',          resource: 'customer', action: 'update' },
  { key: 'customer.delete',  name: 'Delete Customer',          resource: 'customer', action: 'delete' },
  { key: 'customer.approve', name: 'Approve Customer',         resource: 'customer', action: 'approve' },
  { key: 'customer.reject',  name: 'Reject Customer',          resource: 'customer', action: 'reject' },
  { key: 'customer.block',   name: 'Block/Unblock Customer',   resource: 'customer', action: 'block' },
  { key: 'customer.manage',  name: 'Full Customer Management', resource: 'customer', action: 'manage' },

  // Payment
  { key: 'payment.create',        name: 'Create Payment',            resource: 'payment', action: 'create' },
  { key: 'payment.read',          name: 'View Payment',              resource: 'payment', action: 'read' },
  { key: 'payment.update',        name: 'Update Payment',            resource: 'payment', action: 'update' },
  { key: 'payment.mark-received', name: 'Mark Payment Received',     resource: 'payment', action: 'mark-received' },
  { key: 'payment.refund',        name: 'Process Refund',            resource: 'payment', action: 'refund' },
  { key: 'payment.manage',        name: 'Full Payment Management',   resource: 'payment', action: 'manage' },

  // E-way Bill
  { key: 'eway-bill.create',       name: 'Create E-way Bill',             resource: 'eway-bill', action: 'create' },
  { key: 'eway-bill.read',         name: 'View E-way Bill',               resource: 'eway-bill', action: 'read' },
  { key: 'eway-bill.update',       name: 'Update E-way Bill',             resource: 'eway-bill', action: 'update' },
  { key: 'eway-bill.update-part-b',name: 'Update E-way Bill Part-B',      resource: 'eway-bill', action: 'update-part-b' },
  { key: 'eway-bill.cancel',       name: 'Cancel E-way Bill',             resource: 'eway-bill', action: 'cancel' },
  { key: 'eway-bill.manage',       name: 'Full E-way Bill Management',    resource: 'eway-bill', action: 'manage' },

  // Tracking
  { key: 'tracking.read',   name: 'View Tracking',            resource: 'tracking', action: 'read' },
  { key: 'tracking.create', name: 'Create Tracking Update',   resource: 'tracking', action: 'create' },
  { key: 'tracking.manage', name: 'Full Tracking Management', resource: 'tracking', action: 'manage' },

  // Staff / User
  { key: 'staff.create',  name: 'Create Staff',            resource: 'staff', action: 'create' },
  { key: 'staff.read',    name: 'View Staff',              resource: 'staff', action: 'read' },
  { key: 'staff.update',  name: 'Update Staff',            resource: 'staff', action: 'update' },
  { key: 'staff.delete',  name: 'Delete Staff',            resource: 'staff', action: 'delete' },
  { key: 'staff.manage',  name: 'Full Staff Management',   resource: 'staff', action: 'manage' },
  { key: 'user.manage',   name: 'Manage Users',            resource: 'user',  action: 'manage' },

  // Organization / Master Data
  { key: 'organization.read',    name: 'View Organization Settings',  resource: 'organization', action: 'read' },
  { key: 'organization.update',  name: 'Update Organization Settings',resource: 'organization', action: 'update' },
  { key: 'master-data.read',     name: 'View Master Data',            resource: 'master-data',  action: 'read' },
  { key: 'master-data.create',   name: 'Create Master Data',          resource: 'master-data',  action: 'create' },
  { key: 'master-data.update',   name: 'Update Master Data',          resource: 'master-data',  action: 'update' },
  { key: 'master-data.delete',   name: 'Delete Master Data',          resource: 'master-data',  action: 'delete' },
  { key: 'master-data.manage',   name: 'Full Master Data Management', resource: 'master-data',  action: 'manage' },

  // Reports / Dashboard
  { key: 'reports.read',    name: 'View Reports',    resource: 'reports',   action: 'read' },
  { key: 'reports.export',  name: 'Export Reports',  resource: 'reports',   action: 'export' },
  { key: 'dashboard.view',  name: 'View Dashboard',  resource: 'dashboard', action: 'view' },

  // Document
  { key: 'document.read',   name: 'View Documents',   resource: 'document', action: 'read' },
  { key: 'document.create', name: 'Upload Documents', resource: 'document', action: 'create' },
  { key: 'document.delete', name: 'Delete Documents', resource: 'document', action: 'delete' },

  // Notification
  { key: 'notification.read', name: 'View Notifications', resource: 'notification', action: 'read' },
  { key: 'notification.send', name: 'Send Notifications', resource: 'notification', action: 'send' },
];

async function seedPermissions() {
  section('1 / 6  —  Permissions');
  let created = 0, updated = 0;
  for (const p of PERMISSIONS) {
    const existing = await Permission.findOne({ key: p.key });
    if (existing) {
      await Permission.findOneAndUpdate({ key: p.key }, { $set: { ...p, isDeleted: false } });
      updated++;
    } else {
      await Permission.create(p);
      created++;
    }
  }
  console.log(`  ✅ Permissions — created: ${created}, updated: ${updated}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. ROLE TEMPLATES
// ══════════════════════════════════════════════════════════════════════════════
const ROLE_TEMPLATES = [
  // ── Operations ──────────────────────────────────────────────────────────────
  {
    templateName: 'Operations Manager',
    description: 'Full operational access — bookings, drivers, vehicles, tracking',
    category: 'operations',
    permissions: [
      'booking.create', 'booking.read', 'booking.update', 'booking.delete',
      'booking.assign', 'booking.cancel', 'booking.update-status', 'booking.manage',
      'driver.create', 'driver.read', 'driver.update', 'driver.delete',
      'driver.approve', 'driver.reject', 'driver.block', 'driver.manage',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'vehicle.verify', 'vehicle.manage',
      'tracking.read', 'tracking.create', 'tracking.manage',
      'customer.read', 'customer.update', 'customer.approve', 'customer.reject',
      'eway-bill.create', 'eway-bill.read', 'eway-bill.update', 'eway-bill.update-part-b',
      'document.read', 'document.create', 'document.delete',
      'dashboard.view', 'reports.read', 'reports.export',
      'notification.read',
    ],
  },
  {
    templateName: 'Operations Executive',
    description: 'Operational staff — manage assigned bookings, coordinate with drivers',
    category: 'operations',
    permissions: [
      'booking.create', 'booking.read', 'booking.update', 'booking.assign', 'booking.update-status',
      'driver.read', 'driver.update',
      'vehicle.read',
      'tracking.read', 'tracking.create',
      'customer.read',
      'eway-bill.create', 'eway-bill.read', 'eway-bill.update-part-b',
      'document.read', 'document.create',
      'dashboard.view', 'reports.read',
      'notification.read',
    ],
  },
  {
    templateName: 'Fleet Manager',
    description: 'Manage drivers, vehicles and fleet operations',
    category: 'operations',
    permissions: [
      'driver.create', 'driver.read', 'driver.update', 'driver.delete',
      'driver.approve', 'driver.reject', 'driver.block', 'driver.manage',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'vehicle.verify', 'vehicle.manage',
      'booking.read', 'booking.assign',
      'tracking.read', 'tracking.manage',
      'document.read', 'document.create',
      'dashboard.view', 'reports.read', 'reports.export',
      'notification.read',
    ],
  },
  {
    templateName: 'Data Entry Operator',
    description: 'Basic data entry — create bookings and update information',
    category: 'operations',
    permissions: [
      'booking.create', 'booking.read',
      'customer.read', 'customer.create',
      'driver.read', 'vehicle.read',
      'document.read', 'document.create',
      'dashboard.view',
      'notification.read',
    ],
  },
  {
    templateName: 'Compliance Officer',
    description: 'Manage e-way bills and compliance documentation',
    category: 'operations',
    permissions: [
      'eway-bill.create', 'eway-bill.read', 'eway-bill.update',
      'eway-bill.update-part-b', 'eway-bill.cancel', 'eway-bill.manage',
      'booking.read', 'customer.read', 'driver.read', 'vehicle.read',
      'document.read', 'document.create', 'document.delete',
      'reports.read', 'reports.export',
      'dashboard.view',
      'notification.read',
    ],
  },

  // ── Finance ──────────────────────────────────────────────────────────────────
  {
    templateName: 'Finance Manager',
    description: 'Full financial access — payments, refunds, financial reports',
    category: 'finance',
    permissions: [
      'payment.create', 'payment.read', 'payment.update',
      'payment.mark-received', 'payment.refund', 'payment.manage',
      'booking.read', 'booking.update',
      'customer.read', 'customer.update', 'customer.approve', 'customer.block',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read', 'document.create',
      'notification.read',
    ],
  },
  {
    templateName: 'Finance Executive',
    description: 'Finance staff — payment collection and reconciliation',
    category: 'finance',
    permissions: [
      'payment.read', 'payment.mark-received',
      'booking.read', 'customer.read',
      'reports.read',
      'dashboard.view',
      'document.read',
      'notification.read',
    ],
  },
  {
    templateName: 'Accountant',
    description: 'Accounting and reconciliation — view and export financial data',
    category: 'finance',
    permissions: [
      'payment.read',
      'booking.read', 'customer.read',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read',
      'notification.read',
    ],
  },

  // ── Support ───────────────────────────────────────────────────────────────────
  {
    templateName: 'Customer Support Manager',
    description: 'Lead customer support — handle escalations, manage team',
    category: 'support',
    permissions: [
      'customer.create', 'customer.read', 'customer.update', 'customer.delete',
      'customer.approve', 'customer.reject', 'customer.block', 'customer.manage',
      'booking.create', 'booking.read', 'booking.update', 'booking.cancel',
      'payment.read',
      'tracking.read',
      'driver.read', 'vehicle.read',
      'document.read', 'document.create',
      'dashboard.view', 'reports.read',
      'notification.read', 'notification.send',
    ],
  },
  {
    templateName: 'Customer Support Executive',
    description: 'Handle customer queries and basic booking support',
    category: 'support',
    permissions: [
      'customer.read', 'customer.update',
      'booking.create', 'booking.read', 'booking.update',
      'payment.read',
      'tracking.read',
      'driver.read', 'vehicle.read',
      'document.read',
      'dashboard.view',
      'notification.read',
    ],
  },

  // ── Management ────────────────────────────────────────────────────────────────
  {
    templateName: 'General Manager',
    description: 'Senior management — access to all operations and reports',
    category: 'management',
    permissions: [
      'booking.manage', 'driver.manage', 'vehicle.manage', 'customer.manage',
      'payment.manage', 'eway-bill.manage', 'tracking.manage',
      'staff.read',
      'organization.read', 'organization.update',
      'master-data.read', 'master-data.create', 'master-data.update',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read', 'document.create', 'document.delete',
      'notification.read', 'notification.send',
    ],
  },
  {
    templateName: 'Branch Manager',
    description: 'Manage branch operations and local team',
    category: 'management',
    permissions: [
      'booking.create', 'booking.read', 'booking.update', 'booking.assign',
      'booking.cancel', 'booking.update-status',
      'driver.create', 'driver.read', 'driver.update', 'driver.approve',
      'driver.reject', 'driver.block',
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.verify',
      'customer.read', 'customer.update', 'customer.approve', 'customer.reject',
      'payment.read', 'payment.mark-received',
      'tracking.read', 'tracking.manage',
      'staff.read',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read', 'document.create',
      'notification.read', 'notification.send',
    ],
  },
  {
    templateName: 'Reporting Analyst',
    description: 'View and export reports and analytics',
    category: 'management',
    permissions: [
      'booking.read', 'driver.read', 'vehicle.read', 'customer.read',
      'payment.read', 'tracking.read',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read',
      'notification.read',
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────────
  {
    templateName: 'System Administrator',
    description: 'Full system access — users, settings, configurations',
    category: 'admin',
    permissions: [
      'booking.manage', 'driver.manage', 'vehicle.manage', 'customer.manage',
      'payment.manage', 'eway-bill.manage', 'tracking.manage',
      'staff.manage', 'user.manage',
      'organization.read', 'organization.update',
      'master-data.manage',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read', 'document.create', 'document.delete',
      'notification.read', 'notification.send',
    ],
  },
];

async function seedRoleTemplates() {
  section('2 / 6  —  Role Templates');

  // Build permission key → ObjectId map
  const allPerms = await Permission.find({ isDeleted: false }).select('_id key').lean();
  const permMap = Object.fromEntries(allPerms.map(p => [p.key, p._id]));

  let created = 0, updated = 0, skipped = 0;

  for (const t of ROLE_TEMPLATES) {
    const permIds = t.permissions.map(k => permMap[k]).filter(Boolean);
    const missing = t.permissions.filter(k => !permMap[k]);
    if (missing.length) {
      console.warn(`  ⚠️  ${t.templateName}: missing permission keys: ${missing.join(', ')}`);
    }

    const data = {
      templateName: t.templateName,
      description: t.description,
      category: t.category,
      permissions: permIds,
      isActive: true,
      isDeleted: false,
    };

    const existing = await RoleTemplate.findOne({ templateName: t.templateName });
    if (existing) {
      await RoleTemplate.findOneAndUpdate({ templateName: t.templateName }, { $set: data });
      updated++;
    } else {
      await RoleTemplate.create(data);
      created++;
    }
  }
  console.log(`  ✅ Role Templates — created: ${created}, updated: ${updated}, skipped: ${skipped}`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. MASTER DATA
// ══════════════════════════════════════════════════════════════════════════════
const MASTER_DATA = [
  // ── Truck Types (match booking.model.js truckTypeNeeded — free string but these are the canonical values) ──
  { category: 'truck-type', key: 'tata-ace',       displayName: 'Tata Ace',       displayOrder: 1 },
  { category: 'truck-type', key: 'pickup-8ft',      displayName: 'Pickup 8ft',      displayOrder: 2 },
  { category: 'truck-type', key: 'pickup-10ft',     displayName: 'Pickup 10ft',     displayOrder: 3 },
  { category: 'truck-type', key: 'tata-407',        displayName: 'Tata 407',        displayOrder: 4 },
  { category: 'truck-type', key: 'eicher-14ft',     displayName: 'Eicher 14ft',     displayOrder: 5 },
  { category: 'truck-type', key: 'eicher-17ft',     displayName: 'Eicher 17ft',     displayOrder: 6 },
  { category: 'truck-type', key: 'eicher-19ft',     displayName: 'Eicher 19ft',     displayOrder: 7 },
  { category: 'truck-type', key: 'taurus-16',       displayName: 'Taurus 16',       displayOrder: 8 },
  { category: 'truck-type', key: 'taurus-25',       displayName: 'Taurus 25',       displayOrder: 9 },
  { category: 'truck-type', key: '32ft-sxl',        displayName: '32ft SXL',        displayOrder: 10 },
  { category: 'truck-type', key: '32ft-mxl',        displayName: '32ft MXL',        displayOrder: 11 },
  { category: 'truck-type', key: 'container-20ft',  displayName: 'Container 20ft',  displayOrder: 12 },
  { category: 'truck-type', key: 'container-32ft',  displayName: 'Container 32ft',  displayOrder: 13 },
  { category: 'truck-type', key: 'container-40ft',  displayName: 'Container 40ft',  displayOrder: 14 },

  // ── Body Types (must match booking.model.js enum: open|closed|container|tanker|flatbed) ──
  { category: 'body-type', key: 'open',         displayName: 'Open',         displayOrder: 1 },
  { category: 'body-type', key: 'closed',       displayName: 'Closed',       displayOrder: 2 },
  { category: 'body-type', key: 'container',    displayName: 'Container',    displayOrder: 3 },
  { category: 'body-type', key: 'tanker',       displayName: 'Tanker',       displayOrder: 4 },
  { category: 'body-type', key: 'flatbed',      displayName: 'Flatbed',      displayOrder: 5 },
  { category: 'body-type', key: 'refrigerated', displayName: 'Refrigerated', displayOrder: 6 },

  // ── Material Types (must match booking.model.js materialType enum) ──
  { category: 'material-type', key: 'FMCG',              displayName: 'FMCG',                 displayOrder: 1 },
  { category: 'material-type', key: 'electronics',       displayName: 'Electronics',          displayOrder: 2 },
  { category: 'material-type', key: 'furniture',         displayName: 'Furniture',            displayOrder: 3 },
  { category: 'material-type', key: 'steel',             displayName: 'Steel',                displayOrder: 4 },
  { category: 'material-type', key: 'cement',            displayName: 'Cement',               displayOrder: 5 },
  { category: 'material-type', key: 'tiles',             displayName: 'Tiles',                displayOrder: 6 },
  { category: 'material-type', key: 'chemicals',         displayName: 'Chemicals',            displayOrder: 7 },
  { category: 'material-type', key: 'textiles',          displayName: 'Textiles',             displayOrder: 8 },
  { category: 'material-type', key: 'agriculture',       displayName: 'Agriculture Products', displayOrder: 9 },
  { category: 'material-type', key: 'automobile-parts',  displayName: 'Automobile Parts',     displayOrder: 10 },
  { category: 'material-type', key: 'machinery',         displayName: 'Machinery',            displayOrder: 11 },
  { category: 'material-type', key: 'paper',             displayName: 'Paper',                displayOrder: 12 },
  { category: 'material-type', key: 'pharma',            displayName: 'Pharmaceutical',       displayOrder: 13 },
  { category: 'material-type', key: 'plastic',           displayName: 'Plastic',              displayOrder: 14 },
  { category: 'material-type', key: 'food-grains',       displayName: 'Food Grains',          displayOrder: 15 },
  { category: 'material-type', key: 'vegetables-fruits', displayName: 'Vegetables & Fruits',  displayOrder: 16 },
  { category: 'material-type', key: 'general-cargo',     displayName: 'General Cargo',        displayOrder: 17 },
  { category: 'material-type', key: 'other',             displayName: 'Other',                displayOrder: 18 },

  // ── Charge Types (used in booking pricingBreakdown and payment line items) ──
  { category: 'charge-type', key: 'base-freight',       displayName: 'Base Freight',       displayOrder: 1 },
  { category: 'charge-type', key: 'loading-charges',    displayName: 'Loading Charges',    displayOrder: 2 },
  { category: 'charge-type', key: 'unloading-charges',  displayName: 'Unloading Charges',  displayOrder: 3 },
  { category: 'charge-type', key: 'detention-charges',  displayName: 'Detention Charges',  displayOrder: 4 },
  { category: 'charge-type', key: 'toll-charges',       displayName: 'Toll Charges',       displayOrder: 5 },
  { category: 'charge-type', key: 'other-charges',      displayName: 'Other Charges',      displayOrder: 6 },
  { category: 'charge-type', key: 'discount',           displayName: 'Discount',           displayOrder: 7 },

  // ── Document Types (used when uploading docs to bookings / KYC) ──
  { category: 'document-type', key: 'pod',           displayName: 'Proof of Delivery (POD)',  displayOrder: 1 },
  { category: 'document-type', key: 'invoice',       displayName: 'Invoice',                  displayOrder: 2 },
  { category: 'document-type', key: 'lr',            displayName: 'Lorry Receipt (LR)',        displayOrder: 3 },
  { category: 'document-type', key: 'eway-bill',     displayName: 'E-Way Bill',               displayOrder: 4 },
  { category: 'document-type', key: 'vehicle-rc',    displayName: 'Vehicle RC',               displayOrder: 5 },
  { category: 'document-type', key: 'insurance',     displayName: 'Insurance',                displayOrder: 6 },
  { category: 'document-type', key: 'pollution',     displayName: 'Pollution Certificate',    displayOrder: 7 },
  { category: 'document-type', key: 'fitness',       displayName: 'Fitness Certificate',      displayOrder: 8 },
  { category: 'document-type', key: 'permit',        displayName: 'Permit',                   displayOrder: 9 },
  { category: 'document-type', key: 'driver-license',displayName: 'Driver License',           displayOrder: 10 },
  { category: 'document-type', key: 'cargo-photos',  displayName: 'Cargo Photos',             displayOrder: 11 },
  { category: 'document-type', key: 'weight-slip',   displayName: 'Weight Slip',              displayOrder: 12 },

  // ── Locations (source/destination warehouse/plant/port presets) ──
  { category: 'location', key: 'mum-plant-01',  displayName: 'Mumbai Plant 1',       displayOrder: 1,  metadata: { city: 'Mumbai',     state: 'Maharashtra', type: 'plant',     address: 'Bhiwandi, Mumbai' } },
  { category: 'location', key: 'del-wh-01',     displayName: 'Delhi Warehouse 1',    displayOrder: 2,  metadata: { city: 'Delhi',      state: 'Delhi',       type: 'warehouse', address: 'Kundli Industrial Area, Delhi' } },
  { category: 'location', key: 'blr-depot-01',  displayName: 'Bangalore Depot',      displayOrder: 3,  metadata: { city: 'Bangalore',  state: 'Karnataka',   type: 'depot',     address: 'Peenya Industrial Area, Bangalore' } },
  { category: 'location', key: 'hyd-plant-01',  displayName: 'Hyderabad Plant',      displayOrder: 4,  metadata: { city: 'Hyderabad',  state: 'Telangana',   type: 'plant',     address: 'Patancheru, Hyderabad' } },
  { category: 'location', key: 'che-port-01',   displayName: 'Chennai Port',         displayOrder: 5,  metadata: { city: 'Chennai',    state: 'Tamil Nadu',  type: 'port',      address: 'Chennai Port Trust, Chennai' } },
  { category: 'location', key: 'pun-wh-01',     displayName: 'Pune Warehouse',       displayOrder: 6,  metadata: { city: 'Pune',       state: 'Maharashtra', type: 'warehouse', address: 'Chakan Industrial Area, Pune' } },
  { category: 'location', key: 'ahm-depot-01',  displayName: 'Ahmedabad Depot',      displayOrder: 7,  metadata: { city: 'Ahmedabad',  state: 'Gujarat',     type: 'depot',     address: 'Naroda Industrial Area, Ahmedabad' } },
  { category: 'location', key: 'jnpt-port-01',  displayName: 'JNPT Port',            displayOrder: 8,  metadata: { city: 'Navi Mumbai',state: 'Maharashtra', type: 'port',      address: 'Jawaharlal Nehru Port, Navi Mumbai' } },
  { category: 'location', key: 'kol-depot-01',  displayName: 'Kolkata Depot',        displayOrder: 9,  metadata: { city: 'Kolkata',    state: 'West Bengal', type: 'depot',     address: 'Dankuni, Kolkata' } },

  // ── Lanes (predefined source→destination routes) ──
  { category: 'lane', key: 'mum-del-ln01', displayName: 'Mumbai → Delhi (LN01)',      displayOrder: 1, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'del-wh-01',    distanceKm: 1400, transitDays: 2 } },
  { category: 'lane', key: 'mum-blr-ln01', displayName: 'Mumbai → Bangalore (LN01)', displayOrder: 2, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'blr-depot-01', distanceKm: 980,  transitDays: 2 } },
  { category: 'lane', key: 'del-hyd-ln01', displayName: 'Delhi → Hyderabad (LN01)',   displayOrder: 3, metadata: { sourceKey: 'del-wh-01',    destinationKey: 'hyd-plant-01', distanceKm: 1580, transitDays: 3 } },
  { category: 'lane', key: 'blr-che-ln01', displayName: 'Bangalore → Chennai (LN01)', displayOrder: 4, metadata: { sourceKey: 'blr-depot-01', destinationKey: 'che-port-01',  distanceKm: 345,  transitDays: 1 } },
  { category: 'lane', key: 'mum-pun-ln01', displayName: 'Mumbai → Pune (LN01)',       displayOrder: 5, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'pun-wh-01',    distanceKm: 150,  transitDays: 1 } },
  { category: 'lane', key: 'ahm-del-ln01', displayName: 'Ahmedabad → Delhi (LN01)',   displayOrder: 6, metadata: { sourceKey: 'ahm-depot-01', destinationKey: 'del-wh-01',    distanceKm: 930,  transitDays: 2 } },
  { category: 'lane', key: 'mum-kol-ln01', displayName: 'Mumbai → Kolkata (LN01)',    displayOrder: 7, metadata: { sourceKey: 'mum-plant-01', destinationKey: 'kol-depot-01', distanceKm: 2050, transitDays: 3 } },
  { category: 'lane', key: 'del-kol-ln01', displayName: 'Delhi → Kolkata (LN01)',     displayOrder: 8, metadata: { sourceKey: 'del-wh-01',    destinationKey: 'kol-depot-01', distanceKm: 1530, transitDays: 2 } },

  // ── Cost Centers (internal accounting codes used in booking creation) ──
  { category: 'cost-center', key: 'cc-north-ops',  displayName: 'North Operations', displayOrder: 1, metadata: { department: 'Operations', glCode: 'CC-N-001' } },
  { category: 'cost-center', key: 'cc-south-ops',  displayName: 'South Operations', displayOrder: 2, metadata: { department: 'Operations', glCode: 'CC-S-001' } },
  { category: 'cost-center', key: 'cc-west-ops',   displayName: 'West Operations',  displayOrder: 3, metadata: { department: 'Operations', glCode: 'CC-W-001' } },
  { category: 'cost-center', key: 'cc-east-ops',   displayName: 'East Operations',  displayOrder: 4, metadata: { department: 'Operations', glCode: 'CC-E-001' } },
  { category: 'cost-center', key: 'cc-sales',      displayName: 'Sales',            displayOrder: 5, metadata: { department: 'Sales',      glCode: 'CC-SAL-001' } },
  { category: 'cost-center', key: 'cc-exim',       displayName: 'EXIM / Exports',   displayOrder: 6, metadata: { department: 'EXIM',       glCode: 'CC-EXI-001' } },
];

async function seedMasterData() {
  section('3 / 6  —  Master Data');
  await Promise.all(
    MASTER_DATA.map(item =>
      upsert(MasterData, { category: item.category, key: item.key }, item)
    )
  );
  const counts = MASTER_DATA.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {});
  Object.entries(counts).forEach(([cat, n]) => console.log(`  ✅ ${cat}: ${n} items`));
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. MARKET RATES
// ══════════════════════════════════════════════════════════════════════════════
// 6-month price trend helper (static values — avoids random drift between runs)
const TREND_MONTHS = [
  { month: 'Oct', year: 2025 },
  { month: 'Nov', year: 2025 },
  { month: 'Dec', year: 2025 },
  { month: 'Jan', year: 2026 },
  { month: 'Feb', year: 2026 },
  { month: 'Mar', year: 2026 },
];

const makeTrends = (base, deltas) =>
  TREND_MONTHS.map((m, i) => ({ ...m, price: Math.round(base * (1 + deltas[i])) }));

const MARKET_RATES = [
  // Mumbai routes
  { fromCity: 'Mumbai',    toCity: 'Delhi',      truckType: '32ft-mxl',      price: 42000, distance: 1400, estimatedTime: '24-28 hrs', deltas: [-0.02, 0.01, 0.04, 0.03, -0.01, 0.00] },
  { fromCity: 'Mumbai',    toCity: 'Delhi',      truckType: 'eicher-19ft',   price: 35000, distance: 1400, estimatedTime: '24-28 hrs', deltas: [0.01, -0.01, 0.03, 0.02, 0.00, 0.01] },
  { fromCity: 'Mumbai',    toCity: 'Bangalore',  truckType: '32ft-mxl',      price: 28000, distance: 980,  estimatedTime: '16-20 hrs', deltas: [0.00, 0.02, -0.01, 0.03, 0.01, 0.02] },
  { fromCity: 'Mumbai',    toCity: 'Bangalore',  truckType: 'container-20ft',price: 22000, distance: 980,  estimatedTime: '16-20 hrs', deltas: [-0.01, 0.01, 0.02, -0.02, 0.01, 0.00] },
  { fromCity: 'Mumbai',    toCity: 'Chennai',    truckType: '32ft-mxl',      price: 38000, distance: 1340, estimatedTime: '22-26 hrs', deltas: [0.02, 0.00, 0.03, -0.01, 0.02, 0.01] },
  { fromCity: 'Mumbai',    toCity: 'Ahmedabad',  truckType: 'eicher-19ft',   price: 15000, distance: 530,  estimatedTime: '8-10 hrs',  deltas: [0.00, 0.01, 0.00, 0.02, -0.01, 0.00] },
  { fromCity: 'Mumbai',    toCity: 'Pune',       truckType: 'eicher-17ft',   price:  8500, distance: 150,  estimatedTime: '3-4 hrs',   deltas: [0.01, 0.00, 0.02, 0.01, 0.00, -0.01] },
  { fromCity: 'Mumbai',    toCity: 'Kolkata',    truckType: '32ft-mxl',      price: 52000, distance: 2050, estimatedTime: '32-36 hrs', deltas: [-0.01, 0.03, 0.02, 0.01, 0.00, 0.02] },
  { fromCity: 'Mumbai',    toCity: 'Hyderabad',  truckType: 'eicher-19ft',   price: 28000, distance: 710,  estimatedTime: '12-14 hrs', deltas: [0.01, 0.00, 0.02, -0.01, 0.01, 0.00] },

  // Delhi routes
  { fromCity: 'Delhi',     toCity: 'Mumbai',     truckType: '32ft-mxl',      price: 43000, distance: 1400, estimatedTime: '24-28 hrs', deltas: [-0.01, 0.02, 0.03, 0.00, 0.01, -0.01] },
  { fromCity: 'Delhi',     toCity: 'Kolkata',    truckType: '32ft-mxl',      price: 43500, distance: 1530, estimatedTime: '26-30 hrs', deltas: [0.02, -0.01, 0.04, 0.01, 0.00, 0.02] },
  { fromCity: 'Delhi',     toCity: 'Kolkata',    truckType: 'taurus-25',     price: 35000, distance: 1530, estimatedTime: '26-30 hrs', deltas: [0.00, 0.01, 0.02, -0.02, 0.01, 0.00] },
  { fromCity: 'Delhi',     toCity: 'Chennai',    truckType: '32ft-mxl',      price: 55000, distance: 2180, estimatedTime: '34-38 hrs', deltas: [0.01, 0.03, 0.00, 0.02, -0.01, 0.01] },
  { fromCity: 'Delhi',     toCity: 'Bangalore',  truckType: '32ft-sxl',      price: 48000, distance: 2150, estimatedTime: '34-38 hrs', deltas: [-0.02, 0.01, 0.03, 0.00, 0.02, 0.01] },
  { fromCity: 'Delhi',     toCity: 'Ahmedabad',  truckType: 'container-20ft',price: 25000, distance: 940,  estimatedTime: '14-16 hrs', deltas: [0.00, 0.02, -0.01, 0.01, 0.00, 0.02] },

  // Bangalore routes
  { fromCity: 'Bangalore', toCity: 'Chennai',    truckType: 'eicher-17ft',   price: 12500, distance: 350,  estimatedTime: '6-7 hrs',   deltas: [0.01, 0.00, 0.02, -0.01, 0.01, 0.00] },
  { fromCity: 'Bangalore', toCity: 'Chennai',    truckType: 'eicher-19ft',   price: 16000, distance: 350,  estimatedTime: '6-7 hrs',   deltas: [-0.01, 0.01, 0.03, 0.00, -0.01, 0.02] },
  { fromCity: 'Bangalore', toCity: 'Hyderabad',  truckType: '32ft-mxl',      price: 22000, distance: 570,  estimatedTime: '9-11 hrs',  deltas: [0.02, -0.01, 0.01, 0.03, 0.00, 0.01] },
  { fromCity: 'Bangalore', toCity: 'Mumbai',     truckType: '32ft-mxl',      price: 29000, distance: 980,  estimatedTime: '16-20 hrs', deltas: [0.00, 0.02, -0.02, 0.01, 0.02, 0.00] },

  // Chennai routes
  { fromCity: 'Chennai',   toCity: 'Bangalore',  truckType: '32ft-mxl',      price: 13000, distance: 350,  estimatedTime: '6-7 hrs',   deltas: [0.01, 0.00, 0.02, -0.01, 0.00, 0.01] },
  { fromCity: 'Chennai',   toCity: 'Hyderabad',  truckType: 'eicher-19ft',   price: 24000, distance: 630,  estimatedTime: '10-12 hrs', deltas: [0.00, 0.01, 0.03, -0.01, 0.01, 0.00] },
  { fromCity: 'Chennai',   toCity: 'Kolkata',    truckType: '32ft-mxl',      price: 48000, distance: 1670, estimatedTime: '28-32 hrs', deltas: [-0.02, 0.01, 0.02, 0.03, 0.00, 0.01] },

  // Pune routes
  { fromCity: 'Pune',      toCity: 'Mumbai',     truckType: 'eicher-17ft',   price:  8000, distance: 150,  estimatedTime: '3-4 hrs',   deltas: [0.00, 0.01, 0.00, 0.02, -0.01, 0.00] },
  { fromCity: 'Pune',      toCity: 'Bangalore',  truckType: 'eicher-19ft',   price: 25000, distance: 840,  estimatedTime: '14-16 hrs', deltas: [0.01, -0.01, 0.02, 0.01, 0.00, 0.01] },

  // Ahmedabad routes
  { fromCity: 'Ahmedabad', toCity: 'Mumbai',     truckType: '32ft-mxl',      price: 16000, distance: 530,  estimatedTime: '8-10 hrs',  deltas: [0.00, 0.01, 0.02, -0.01, 0.01, 0.00] },
  { fromCity: 'Ahmedabad', toCity: 'Delhi',      truckType: 'eicher-19ft',   price: 26000, distance: 940,  estimatedTime: '14-16 hrs', deltas: [0.02, 0.00, 0.01, 0.03, -0.01, 0.01] },

  // Kolkata routes
  { fromCity: 'Kolkata',   toCity: 'Delhi',      truckType: '32ft-mxl',      price: 44000, distance: 1530, estimatedTime: '26-30 hrs', deltas: [-0.01, 0.02, 0.01, 0.03, 0.00, 0.01] },
  { fromCity: 'Kolkata',   toCity: 'Chennai',    truckType: 'taurus-25',     price: 40000, distance: 1670, estimatedTime: '28-32 hrs', deltas: [0.01, -0.01, 0.02, 0.00, 0.01, 0.02] },

  // Hyderabad routes
  { fromCity: 'Hyderabad', toCity: 'Bangalore',  truckType: 'container-20ft',price: 18000, distance: 570,  estimatedTime: '9-11 hrs',  deltas: [0.00, 0.01, 0.02, -0.01, 0.00, 0.01] },
  { fromCity: 'Hyderabad', toCity: 'Mumbai',     truckType: '32ft-mxl',      price: 30000, distance: 710,  estimatedTime: '12-14 hrs', deltas: [0.01, 0.00, 0.03, 0.01, -0.01, 0.02] },
];

async function seedMarketRates() {
  section('4 / 6  —  Market Rates');
  await Promise.all(
    MARKET_RATES.map(({ deltas, ...rate }) =>
      upsert(
        MarketRate,
        { fromCity: rate.fromCity, toCity: rate.toCity, truckType: rate.truckType },
        { ...rate, priceTrends: makeTrends(rate.price, deltas), isActive: true, isDeleted: false }
      )
    )
  );
  console.log(`  ✅ Market Rates — ${MARKET_RATES.length} routes seeded`);
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. BRANCHES
// ══════════════════════════════════════════════════════════════════════════════
const BRANCHES = [
  {
    branchCode: 'HQ',
    branchName: 'Head Office',
    region: 'West',
    assignedCities: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune'],
    address: { city: 'Mumbai', state: 'Maharashtra', pincode: '400001', country: 'India' },
    contactDetails: { phone: '022-40001234', email: 'hq@cloudtruck.in' },
  },
  {
    branchCode: 'DEL',
    branchName: 'Delhi Branch',
    region: 'North',
    assignedCities: ['Delhi', 'Gurgaon', 'Noida', 'Faridabad'],
    address: { city: 'Delhi', state: 'Delhi', pincode: '110001', country: 'India' },
    contactDetails: { phone: '011-40001234', email: 'delhi@cloudtruck.in' },
  },
  {
    branchCode: 'BLR',
    branchName: 'Bangalore Branch',
    region: 'South',
    assignedCities: ['Bangalore', 'Mysore', 'Hubli'],
    address: { city: 'Bangalore', state: 'Karnataka', pincode: '560001', country: 'India' },
    contactDetails: { phone: '080-40001234', email: 'bangalore@cloudtruck.in' },
  },
  {
    branchCode: 'CHE',
    branchName: 'Chennai Branch',
    region: 'South',
    assignedCities: ['Chennai', 'Coimbatore', 'Madurai'],
    address: { city: 'Chennai', state: 'Tamil Nadu', pincode: '600001', country: 'India' },
    contactDetails: { phone: '044-40001234', email: 'chennai@cloudtruck.in' },
  },
  {
    branchCode: 'AHM',
    branchName: 'Ahmedabad Branch',
    region: 'West',
    assignedCities: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'],
    address: { city: 'Ahmedabad', state: 'Gujarat', pincode: '380001', country: 'India' },
    contactDetails: { phone: '079-40001234', email: 'ahmedabad@cloudtruck.in' },
  },
];

async function seedBranches() {
  section('5 / 6  —  Branches');
  for (const b of BRANCHES) {
    await upsert(Branch, { branchCode: b.branchCode }, { ...b, isActive: true, isDeleted: false });
    console.log(`  ✅ Branch: ${b.branchCode} — ${b.branchName}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 6. ACCOUNT (primary company bank account)
// ══════════════════════════════════════════════════════════════════════════════
const PRIMARY_ACCOUNT = {
  accountNumber: '1234567890',
  ifscCode: 'HDFC0001234',
  accountHolderName: 'CloudTruck Logistics Pvt Ltd',
  bankName: 'HDFC Bank',
  branchName: 'Andheri West, Mumbai',
  accountType: 'current',
  isPrimary: true,
  isActive: true,
  isDeleted: false,
};

async function seedAccount() {
  section('6 / 6  —  Company Bank Account');
  const existing = await Account.findOne({ accountNumber: PRIMARY_ACCOUNT.accountNumber });
  if (existing) {
    console.log('  ℹ️  Primary account already exists — skipped');
  } else {
    await Account.create(PRIMARY_ACCOUNT);
    console.log(`  ✅ Account created: ${PRIMARY_ACCOUNT.bankName} — ${PRIMARY_ACCOUNT.accountNumber}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
const run = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  const startTime = Date.now();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║           CLOUDTRUCK — FRESH SEED SCRIPT            ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  await mongoose.connect(mongoURI);
  console.log('\n📦 Connected to MongoDB');

  await seedPermissions();
  await seedRoleTemplates();
  await seedMasterData();
  await seedMarketRates();
  await seedBranches();
  await seedAccount();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              ✅  SEED COMPLETE                       ║');
  console.log(`║              ⏱  ${elapsed}s                                  ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n📝 Next steps:');
  console.log('   1. npm run create-admin        — create super-admin user');
  console.log('   2. Start the server and log in to the admin panel');
  console.log('   3. Add customers, drivers, vehicles via the UI or API\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
