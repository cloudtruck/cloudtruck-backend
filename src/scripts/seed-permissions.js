/**
 * Seed Script: Permissions
 * Seeds all system permissions for RBAC
 * Run: node src/scripts/seed-permissions.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';

dotenv.config();

const permissions = [
  // ============================================================================
  // BOOKING PERMISSIONS
  // ============================================================================
  {
    key: 'booking.create',
    name: 'Create Booking',
    description: 'Create new bookings in the system',
    resource: 'booking',
    action: 'create'
  },
  {
    key: 'booking.read',
    name: 'View Booking',
    description: 'View booking details and list',
    resource: 'booking',
    action: 'read'
  },
  {
    key: 'booking.update',
    name: 'Update Booking',
    description: 'Edit booking details',
    resource: 'booking',
    action: 'update'
  },
  {
    key: 'booking.delete',
    name: 'Delete Booking',
    description: 'Delete or cancel bookings',
    resource: 'booking',
    action: 'delete'
  },
  {
    key: 'booking.assign',
    name: 'Assign Driver to Booking',
    description: 'Assign drivers and vehicles to bookings',
    resource: 'booking',
    action: 'assign'
  },
  {
    key: 'booking.cancel',
    name: 'Cancel Booking',
    description: 'Cancel bookings',
    resource: 'booking',
    action: 'cancel'
  },
  {
    key: 'booking.update-status',
    name: 'Update Booking Status',
    description: 'Change booking status',
    resource: 'booking',
    action: 'update-status'
  },
  {
    key: 'booking.manage',
    name: 'Full Booking Management',
    description: 'Complete access to all booking operations',
    resource: 'booking',
    action: 'manage'
  },

  // ============================================================================
  // DRIVER PERMISSIONS
  // ============================================================================
  {
    key: 'driver.create',
    name: 'Create Driver',
    description: 'Add new drivers to the system',
    resource: 'driver',
    action: 'create'
  },
  {
    key: 'driver.read',
    name: 'View Driver',
    description: 'View driver profiles and list',
    resource: 'driver',
    action: 'read'
  },
  {
    key: 'driver.update',
    name: 'Update Driver',
    description: 'Edit driver details',
    resource: 'driver',
    action: 'update'
  },
  {
    key: 'driver.delete',
    name: 'Delete Driver',
    description: 'Delete driver profiles',
    resource: 'driver',
    action: 'delete'
  },
  {
    key: 'driver.approve',
    name: 'Approve Driver',
    description: 'Verify and approve driver registrations',
    resource: 'driver',
    action: 'approve'
  },
  {
    key: 'driver.reject',
    name: 'Reject Driver',
    description: 'Reject driver applications',
    resource: 'driver',
    action: 'reject'
  },
  {
    key: 'driver.block',
    name: 'Block/Unblock Driver',
    description: 'Block or unblock driver accounts',
    resource: 'driver',
    action: 'block'
  },
  {
    key: 'driver.manage',
    name: 'Full Driver Management',
    description: 'Complete access to all driver operations',
    resource: 'driver',
    action: 'manage'
  },

  // ============================================================================
  // VEHICLE PERMISSIONS
  // ============================================================================
  {
    key: 'vehicle.create',
    name: 'Create Vehicle',
    description: 'Add new vehicles to the system',
    resource: 'vehicle',
    action: 'create'
  },
  {
    key: 'vehicle.read',
    name: 'View Vehicle',
    description: 'View vehicle details and list',
    resource: 'vehicle',
    action: 'read'
  },
  {
    key: 'vehicle.update',
    name: 'Update Vehicle',
    description: 'Edit vehicle details',
    resource: 'vehicle',
    action: 'update'
  },
  {
    key: 'vehicle.delete',
    name: 'Delete Vehicle',
    description: 'Delete vehicle records',
    resource: 'vehicle',
    action: 'delete'
  },
  {
    key: 'vehicle.verify',
    name: 'Verify Vehicle',
    description: 'Verify and approve vehicle registrations',
    resource: 'vehicle',
    action: 'verify'
  },
  {
    key: 'vehicle.manage',
    name: 'Full Vehicle Management',
    description: 'Complete access to all vehicle operations',
    resource: 'vehicle',
    action: 'manage'
  },

  // ============================================================================
  // CUSTOMER PERMISSIONS
  // ============================================================================
  {
    key: 'customer.create',
    name: 'Create Customer',
    description: 'Add new customers to the system',
    resource: 'customer',
    action: 'create'
  },
  {
    key: 'customer.read',
    name: 'View Customer',
    description: 'View customer profiles and list',
    resource: 'customer',
    action: 'read'
  },
  {
    key: 'customer.update',
    name: 'Update Customer',
    description: 'Edit customer details',
    resource: 'customer',
    action: 'update'
  },
  {
    key: 'customer.delete',
    name: 'Delete Customer',
    description: 'Delete customer accounts',
    resource: 'customer',
    action: 'delete'
  },
  {
    key: 'customer.approve',
    name: 'Approve Customer',
    description: 'Approve customer registrations',
    resource: 'customer',
    action: 'approve'
  },
  {
    key: 'customer.reject',
    name: 'Reject Customer',
    description: 'Reject customer applications',
    resource: 'customer',
    action: 'reject'
  },
  {
    key: 'customer.block',
    name: 'Block/Unblock Customer',
    description: 'Block or unblock customer accounts',
    resource: 'customer',
    action: 'block'
  },
  {
    key: 'customer.manage',
    name: 'Full Customer Management',
    description: 'Complete access to all customer operations',
    resource: 'customer',
    action: 'manage'
  },

  // ============================================================================
  // PAYMENT PERMISSIONS
  // ============================================================================
  {
    key: 'payment.create',
    name: 'Create Payment',
    description: 'Create payment records',
    resource: 'payment',
    action: 'create'
  },
  {
    key: 'payment.read',
    name: 'View Payment',
    description: 'View payment details and history',
    resource: 'payment',
    action: 'read'
  },
  {
    key: 'payment.update',
    name: 'Update Payment',
    description: 'Edit payment details',
    resource: 'payment',
    action: 'update'
  },
  {
    key: 'payment.mark-received',
    name: 'Mark Payment Received',
    description: 'Mark payments as received',
    resource: 'payment',
    action: 'mark-received'
  },
  {
    key: 'payment.refund',
    name: 'Process Refund',
    description: 'Process payment refunds',
    resource: 'payment',
    action: 'refund'
  },
  {
    key: 'payment.manage',
    name: 'Full Payment Management',
    description: 'Complete access to all payment operations',
    resource: 'payment',
    action: 'manage'
  },

  // ============================================================================
  // E-WAY BILL PERMISSIONS
  // ============================================================================
  {
    key: 'eway-bill.create',
    name: 'Create E-way Bill',
    description: 'Generate new e-way bills',
    resource: 'eway-bill',
    action: 'create'
  },
  {
    key: 'eway-bill.read',
    name: 'View E-way Bill',
    description: 'View e-way bill details',
    resource: 'eway-bill',
    action: 'read'
  },
  {
    key: 'eway-bill.update',
    name: 'Update E-way Bill',
    description: 'Edit e-way bill details',
    resource: 'eway-bill',
    action: 'update'
  },
  {
    key: 'eway-bill.update-part-b',
    name: 'Update E-way Bill Part-B',
    description: 'Update Part-B of e-way bills',
    resource: 'eway-bill',
    action: 'update-part-b'
  },
  {
    key: 'eway-bill.cancel',
    name: 'Cancel E-way Bill',
    description: 'Cancel e-way bills',
    resource: 'eway-bill',
    action: 'cancel'
  },
  {
    key: 'eway-bill.manage',
    name: 'Full E-way Bill Management',
    description: 'Complete access to all e-way bill operations',
    resource: 'eway-bill',
    action: 'manage'
  },

  // ============================================================================
  // TRACKING PERMISSIONS
  // ============================================================================
  {
    key: 'tracking.read',
    name: 'View Tracking',
    description: 'View real-time tracking information',
    resource: 'tracking',
    action: 'read'
  },
  {
    key: 'tracking.create',
    name: 'Create Tracking Update',
    description: 'Create tracking location updates',
    resource: 'tracking',
    action: 'create'
  },
  {
    key: 'tracking.manage',
    name: 'Full Tracking Management',
    description: 'Complete access to tracking operations',
    resource: 'tracking',
    action: 'manage'
  },

  // ============================================================================
  // STAFF/USER MANAGEMENT PERMISSIONS
  // ============================================================================
  {
    key: 'staff.create',
    name: 'Create Staff',
    description: 'Add new staff members',
    resource: 'staff',
    action: 'create'
  },
  {
    key: 'staff.read',
    name: 'View Staff',
    description: 'View staff profiles and list',
    resource: 'staff',
    action: 'read'
  },
  {
    key: 'staff.update',
    name: 'Update Staff',
    description: 'Edit staff details',
    resource: 'staff',
    action: 'update'
  },
  {
    key: 'staff.delete',
    name: 'Delete Staff',
    description: 'Delete staff accounts',
    resource: 'staff',
    action: 'delete'
  },
  {
    key: 'staff.manage',
    name: 'Full Staff Management',
    description: 'Complete access to all staff operations',
    resource: 'staff',
    action: 'manage'
  },
  {
    key: 'user.manage',
    name: 'Manage Users',
    description: 'Manage user accounts across the system',
    resource: 'user',
    action: 'manage'
  },

  // ============================================================================
  // ORGANIZATION PERMISSIONS
  // ============================================================================
  {
    key: 'organization.read',
    name: 'View Organization Settings',
    description: 'View organization configuration',
    resource: 'organization',
    action: 'read'
  },
  {
    key: 'organization.update',
    name: 'Update Organization Settings',
    description: 'Edit organization configuration',
    resource: 'organization',
    action: 'update'
  },
  {
    key: 'master-data.read',
    name: 'View Master Data',
    description: 'View master data categories',
    resource: 'master-data',
    action: 'read'
  },
  {
    key: 'master-data.create',
    name: 'Create Master Data',
    description: 'Add new master data entries',
    resource: 'master-data',
    action: 'create'
  },
  {
    key: 'master-data.update',
    name: 'Update Master Data',
    description: 'Edit master data entries',
    resource: 'master-data',
    action: 'update'
  },
  {
    key: 'master-data.delete',
    name: 'Delete Master Data',
    description: 'Delete master data entries',
    resource: 'master-data',
    action: 'delete'
  },
  {
    key: 'master-data.manage',
    name: 'Full Master Data Management',
    description: 'Complete access to master data operations',
    resource: 'master-data',
    action: 'manage'
  },

  // ============================================================================
  // REPORTS & ANALYTICS PERMISSIONS
  // ============================================================================
  {
    key: 'reports.read',
    name: 'View Reports',
    description: 'Access reports and analytics',
    resource: 'reports',
    action: 'read'
  },
  {
    key: 'reports.export',
    name: 'Export Reports',
    description: 'Export data and generate reports',
    resource: 'reports',
    action: 'export'
  },
  {
    key: 'dashboard.view',
    name: 'View Dashboard',
    description: 'Access dashboard and metrics',
    resource: 'dashboard',
    action: 'view'
  },

  // ============================================================================
  // DOCUMENT PERMISSIONS
  // ============================================================================
  {
    key: 'document.read',
    name: 'View Documents',
    description: 'View uploaded documents',
    resource: 'document',
    action: 'read'
  },
  {
    key: 'document.create',
    name: 'Upload Documents',
    description: 'Upload new documents',
    resource: 'document',
    action: 'create'
  },
  {
    key: 'document.delete',
    name: 'Delete Documents',
    description: 'Delete uploaded documents',
    resource: 'document',
    action: 'delete'
  },

  // ============================================================================
  // NOTIFICATION PERMISSIONS
  // ============================================================================
  {
    key: 'notification.read',
    name: 'View Notifications',
    description: 'View system notifications',
    resource: 'notification',
    action: 'read'
  },
  {
    key: 'notification.send',
    name: 'Send Notifications',
    description: 'Send notifications to users',
    resource: 'notification',
    action: 'send'
  }
];

const seedPermissions = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB\n');

    console.log('🌱 Seeding permissions...');
    
    let created = 0;
    let updated = 0;

    for (const permission of permissions) {
      const existing = await Permission.findOne({ key: permission.key, isDeleted: false });
      
      if (existing) {
        // Update existing permission
        await Permission.findOneAndUpdate(
          { key: permission.key, isDeleted: false },
          { $set: { ...permission, isDeleted: false } },
          { new: true }
        );
        updated++;
      } else {
        // Create new permission
        await Permission.create(permission);
        created++;
      }
    }

    console.log(`\n✅ Permission seeding complete!`);
    console.log(`   📊 Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   📝 Total: ${permissions.length}\n`);

    // Display permission summary by resource
    const groupedByResource = permissions.reduce((acc, perm) => {
      if (!acc[perm.resource]) acc[perm.resource] = [];
      acc[perm.resource].push(perm.action);
      return acc;
    }, {});

    console.log('📋 Permissions by Resource:');
    Object.entries(groupedByResource).forEach(([resource, actions]) => {
      console.log(`   ${resource}: ${actions.join(', ')}`);
    });

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding permissions:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the seed function
seedPermissions();
