/**
 * Seed Script: Role Templates
 * Seeds common role templates with permission bundles
 * Run: node src/scripts/seed-role-templates.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import RoleTemplate from '../models/roleTemplate.model.js';
import Permission from '../models/permission.model.js';

dotenv.config();

const roleTemplates = [
  // ============================================================================
  // OPERATIONS ROLES
  // ============================================================================
  {
    templateName: 'Operations Manager',
    description: 'Full operational access - manage bookings, drivers, vehicles, and tracking',
    category: 'operations',
    permissions: [
      // Booking - Full Access
      'booking.create', 'booking.read', 'booking.update', 'booking.delete',
      'booking.assign', 'booking.cancel', 'booking.update-status', 'booking.manage',
      // Driver - Full Access
      'driver.create', 'driver.read', 'driver.update', 'driver.delete',
      'driver.approve', 'driver.reject', 'driver.block', 'driver.manage',
      // Vehicle - Full Access
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'vehicle.verify', 'vehicle.manage',
      // Tracking
      'tracking.read', 'tracking.create', 'tracking.manage',
      // Customer - View & Manage
      'customer.read', 'customer.update', 'customer.approve', 'customer.reject',
      // E-way Bills
      'eway-bill.create', 'eway-bill.read', 'eway-bill.update', 'eway-bill.update-part-b',
      // Documents
      'document.read', 'document.create', 'document.delete',
      // Dashboard & Reports
      'dashboard.view', 'reports.read', 'reports.export',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },
  {
    templateName: 'Operations Executive',
    description: 'Operational staff - manage assigned bookings and coordinate with drivers',
    category: 'operations',
    permissions: [
      // Booking - Limited
      'booking.create', 'booking.read', 'booking.update', 'booking.assign',
      'booking.update-status',
      // Driver - View & Basic Updates
      'driver.read', 'driver.update',
      // Vehicle - View Only
      'vehicle.read',
      // Tracking
      'tracking.read', 'tracking.create',
      // Customer - View Only
      'customer.read',
      // E-way Bills
      'eway-bill.create', 'eway-bill.read', 'eway-bill.update-part-b',
      // Documents
      'document.read', 'document.create',
      // Dashboard
      'dashboard.view', 'reports.read',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },
  {
    templateName: 'Fleet Manager',
    description: 'Manage drivers, vehicles, and fleet operations',
    category: 'operations',
    permissions: [
      // Driver - Full Access
      'driver.create', 'driver.read', 'driver.update', 'driver.delete',
      'driver.approve', 'driver.reject', 'driver.block', 'driver.manage',
      // Vehicle - Full Access
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.delete',
      'vehicle.verify', 'vehicle.manage',
      // Booking - View & Assign
      'booking.read', 'booking.assign',
      // Tracking
      'tracking.read', 'tracking.manage',
      // Documents
      'document.read', 'document.create',
      // Dashboard & Reports
      'dashboard.view', 'reports.read', 'reports.export',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },

  // ============================================================================
  // FINANCE ROLES
  // ============================================================================
  {
    templateName: 'Finance Manager',
    description: 'Full financial access - manage payments, refunds, and financial reports',
    category: 'finance',
    permissions: [
      // Payment - Full Access
      'payment.create', 'payment.read', 'payment.update', 'payment.mark-received',
      'payment.refund', 'payment.manage',
      // Booking - View & Update (for pricing)
      'booking.read', 'booking.update',
      // Customer - View & Manage
      'customer.read', 'customer.update', 'customer.approve', 'customer.block',
      // Reports - Full Access
      'reports.read', 'reports.export',
      // Dashboard
      'dashboard.view',
      // Documents
      'document.read', 'document.create',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },
  {
    templateName: 'Finance Executive',
    description: 'Finance staff - manage payment collection and reconciliation',
    category: 'finance',
    permissions: [
      // Payment - Limited
      'payment.read', 'payment.mark-received',
      // Booking - View Only
      'booking.read',
      // Customer - View Only
      'customer.read',
      // Reports
      'reports.read',
      // Dashboard
      'dashboard.view',
      // Documents
      'document.read',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },
  {
    templateName: 'Accountant',
    description: 'Accounting and reconciliation - view and export financial data',
    category: 'finance',
    permissions: [
      // Payment - View & Export
      'payment.read',
      // Booking - View Only
      'booking.read',
      // Customer - View Only
      'customer.read',
      // Reports - Full Access
      'reports.read', 'reports.export',
      // Dashboard
      'dashboard.view',
      // Documents
      'document.read',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },

  // ============================================================================
  // CUSTOMER SUPPORT ROLES
  // ============================================================================
  {
    templateName: 'Customer Support Manager',
    description: 'Lead customer support - handle escalations and manage team',
    category: 'support',
    permissions: [
      // Customer - Full Access
      'customer.create', 'customer.read', 'customer.update', 'customer.delete',
      'customer.approve', 'customer.reject', 'customer.block', 'customer.manage',
      // Booking - View & Update
      'booking.create', 'booking.read', 'booking.update', 'booking.cancel',
      // Payment - View Only
      'payment.read',
      // Tracking
      'tracking.read',
      // Driver & Vehicle - View Only
      'driver.read', 'vehicle.read',
      // Documents
      'document.read', 'document.create',
      // Dashboard & Reports
      'dashboard.view', 'reports.read',
      // Notifications
      'notification.read', 'notification.send'
    ],
    isActive: true
  },
  {
    templateName: 'Customer Support Executive',
    description: 'Handle customer queries and basic booking support',
    category: 'support',
    permissions: [
      // Customer - View & Basic Updates
      'customer.read', 'customer.update',
      // Booking - View & Create
      'booking.create', 'booking.read', 'booking.update',
      // Payment - View Only
      'payment.read',
      // Tracking
      'tracking.read',
      // Driver & Vehicle - View Only
      'driver.read', 'vehicle.read',
      // Documents
      'document.read',
      // Dashboard
      'dashboard.view',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },

  // ============================================================================
  // MANAGEMENT ROLES
  // ============================================================================
  {
    templateName: 'General Manager',
    description: 'Senior management - access to all operations and reports',
    category: 'management',
    permissions: [
      // All Booking Access
      'booking.manage',
      // All Driver Access
      'driver.manage',
      // All Vehicle Access
      'vehicle.manage',
      // All Customer Access
      'customer.manage',
      // All Payment Access
      'payment.manage',
      // E-way Bills
      'eway-bill.manage',
      // Tracking
      'tracking.manage',
      // Staff - View Only
      'staff.read',
      // Organization
      'organization.read', 'organization.update',
      // Master Data
      'master-data.read', 'master-data.create', 'master-data.update',
      // Reports - Full Access
      'reports.read', 'reports.export',
      // Dashboard
      'dashboard.view',
      // Documents
      'document.read', 'document.create', 'document.delete',
      // Notifications
      'notification.read', 'notification.send'
    ],
    isActive: true
  },
  {
    templateName: 'Branch Manager',
    description: 'Manage branch operations and local team',
    category: 'management',
    permissions: [
      // Booking - Full Access
      'booking.create', 'booking.read', 'booking.update', 'booking.assign',
      'booking.cancel', 'booking.update-status',
      // Driver - Full Access
      'driver.create', 'driver.read', 'driver.update', 'driver.approve',
      'driver.reject', 'driver.block',
      // Vehicle - Full Access
      'vehicle.create', 'vehicle.read', 'vehicle.update', 'vehicle.verify',
      // Customer - Full Access
      'customer.read', 'customer.update', 'customer.approve', 'customer.reject',
      // Payment - View & Mark Received
      'payment.read', 'payment.mark-received',
      // Tracking
      'tracking.read', 'tracking.manage',
      // Staff - View Only
      'staff.read',
      // Reports
      'reports.read', 'reports.export',
      // Dashboard
      'dashboard.view',
      // Documents
      'document.read', 'document.create',
      // Notifications
      'notification.read', 'notification.send'
    ],
    isActive: true
  },

  // ============================================================================
  // ADMIN ROLES
  // ============================================================================
  {
    templateName: 'System Administrator',
    description: 'Full system access - manage users, settings, and configurations',
    category: 'admin',
    permissions: [
      // All permissions
      'booking.manage', 'driver.manage', 'vehicle.manage', 'customer.manage',
      'payment.manage', 'eway-bill.manage', 'tracking.manage',
      'staff.manage', 'user.manage',
      'organization.read', 'organization.update',
      'master-data.manage',
      'reports.read', 'reports.export',
      'dashboard.view',
      'document.read', 'document.create', 'document.delete',
      'notification.read', 'notification.send'
    ],
    isActive: true
  },
  {
    templateName: 'Data Entry Operator',
    description: 'Basic data entry - create bookings and update information',
    category: 'operations',
    permissions: [
      // Booking - Create & View
      'booking.create', 'booking.read',
      // Customer - View & Create
      'customer.read', 'customer.create',
      // Driver & Vehicle - View Only
      'driver.read', 'vehicle.read',
      // Documents
      'document.read', 'document.create',
      // Dashboard
      'dashboard.view',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },
  {
    templateName: 'Reporting Analyst',
    description: 'View and export reports and analytics',
    category: 'management',
    permissions: [
      // View Everything
      'booking.read', 'driver.read', 'vehicle.read', 'customer.read',
      'payment.read', 'tracking.read',
      // Reports - Full Access
      'reports.read', 'reports.export',
      // Dashboard
      'dashboard.view',
      // Documents
      'document.read',
      // Notifications
      'notification.read'
    ],
    isActive: true
  },

  // ============================================================================
  // SPECIALIZED ROLES
  // ============================================================================
  {
    templateName: 'Compliance Officer',
    description: 'Manage e-way bills and compliance documentation',
    category: 'operations',
    permissions: [
      // E-way Bills - Full Access
      'eway-bill.create', 'eway-bill.read', 'eway-bill.update',
      'eway-bill.update-part-b', 'eway-bill.cancel', 'eway-bill.manage',
      // Booking - View
      'booking.read',
      // Customer - View
      'customer.read',
      // Driver & Vehicle - View
      'driver.read', 'vehicle.read',
      // Documents - Full Access
      'document.read', 'document.create', 'document.delete',
      // Reports
      'reports.read', 'reports.export',
      // Dashboard
      'dashboard.view',
      // Notifications
      'notification.read'
    ],
    isActive: true
  }
];

const seedRoleTemplates = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✓ Connected to MongoDB\n');

    console.log('🌱 Seeding role templates...');
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const template of roleTemplates) {
      // Get permission IDs from permission keys
      const permissionDocs = await Permission.find({
        key: { $in: template.permissions },
        isDeleted: false
      }).select('_id key');

      if (permissionDocs.length === 0) {
        console.warn(`   ⚠️  No permissions found for ${template.templateName}. Skipping...`);
        skipped++;
        continue;
      }

      const permissionIds = permissionDocs.map(p => p._id);
      const foundKeys = permissionDocs.map(p => p.key);
      const missingKeys = template.permissions.filter(key => !foundKeys.includes(key));

      if (missingKeys.length > 0) {
        console.warn(`   ⚠️  Missing permissions for ${template.templateName}:`, missingKeys.slice(0, 3).join(', '), '...');
      }

      const templateData = {
        templateName: template.templateName,
        description: template.description,
        category: template.category,
        permissions: permissionIds,
        isActive: template.isActive
      };

      const existing = await RoleTemplate.findOne({ 
        templateName: template.templateName,
        isDeleted: false 
      });
      
      if (existing) {
        // Update existing template
        await RoleTemplate.findOneAndUpdate(
          { templateName: template.templateName, isDeleted: false },
          { $set: { ...templateData, isDeleted: false } },
          { new: true }
        );
        updated++;
        console.log(`   🔄 Updated: ${template.templateName} (${permissionIds.length} permissions)`);
      } else {
        // Create new template
        await RoleTemplate.create(templateData);
        created++;
        console.log(`   ✨ Created: ${template.templateName} (${permissionIds.length} permissions)`);
      }
    }

    console.log(`\n✅ Role template seeding complete!`);
    console.log(`   📊 Created: ${created}`);
    console.log(`   🔄 Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   📝 Total: ${roleTemplates.length}\n`);

    // Display templates by category
    const groupedByCategory = roleTemplates.reduce((acc, template) => {
      if (!acc[template.category]) acc[template.category] = [];
      acc[template.category].push(template.templateName);
      return acc;
    }, {});

    console.log('📋 Role Templates by Category:');
    Object.entries(groupedByCategory).forEach(([category, templates]) => {
      console.log(`   ${category}:`);
      templates.forEach(name => console.log(`     - ${name}`));
    });

    await mongoose.disconnect();
    console.log('\n✓ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding role templates:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the seed function
seedRoleTemplates();
