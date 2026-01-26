# RBAC Seed Scripts

This directory contains seed scripts for the Role-Based Access Control (RBAC) system.

## 📋 Available Scripts

### Individual Scripts

1. **`seed-permissions.js`** - Seeds all system permissions
   ```bash
   npm run seed:permissions
   ```
   Creates 66 permissions across 15 resource types

2. **`seed-role-templates.js`** - Seeds pre-configured role templates
   ```bash
   npm run seed:roles
   ```
   Creates 14 role templates across 5 categories

3. **`seed-all.js`** - Master script to seed everything
   ```bash
   npm run seed:rbac
   ```
   Runs permissions → role templates in sequence

## 🎯 What Gets Seeded

### Permissions (66 total)

Permissions are organized by resource:

- **Bookings** (8): create, read, update, delete, assign, cancel, update-status, manage
- **Drivers** (8): create, read, update, delete, approve, reject, block, manage
- **Vehicles** (6): create, read, update, delete, verify, manage
- **Customers** (8): create, read, update, delete, approve, reject, block, manage
- **Payments** (6): create, read, update, mark-received, refund, manage
- **E-way Bills** (6): create, read, update, update-part-b, cancel, manage
- **Tracking** (3): read, create, manage
- **Staff** (5): create, read, update, delete, manage
- **Organization** (2): read, update
- **Master Data** (5): read, create, update, delete, manage
- **Reports** (2): read, export
- **Dashboard** (1): view
- **Documents** (3): read, create, delete
- **Notifications** (2): read, send
- **User** (1): manage

### Role Templates (14 total)

#### Operations (5 templates)
- **Operations Manager** - Full operational access (40 permissions)
- **Operations Executive** - Limited operational staff (19 permissions)
- **Fleet Manager** - Driver and vehicle management (24 permissions)
- **Data Entry Operator** - Basic data entry (10 permissions)
- **Compliance Officer** - E-way bills and compliance (17 permissions)

#### Finance (3 templates)
- **Finance Manager** - Full financial access (18 permissions)
- **Finance Executive** - Payment collection (8 permissions)
- **Accountant** - View and export financial data (8 permissions)

#### Support (2 templates)
- **Customer Support Manager** - Lead support with escalations (22 permissions)
- **Customer Support Executive** - Handle customer queries (12 permissions)

#### Management (3 templates)
- **General Manager** - Senior management access (21 permissions)
- **Branch Manager** - Manage branch operations (32 permissions)
- **Reporting Analyst** - View and export reports (11 permissions)

#### Admin (1 template)
- **System Administrator** - Full system access (20 permissions)

## 🚀 Usage

### First Time Setup

```bash
# Seed everything (recommended)
npm run seed:rbac
```

### Update Permissions Only

```bash
npm run seed:permissions
```

### Update Role Templates Only

```bash
npm run seed:roles
```

## ⚙️ How It Works

1. **Permissions** are atomic units of access (e.g., `booking.create`)
2. **Role Templates** are bundles of permissions (e.g., "Operations Manager" template)
3. **Staff members** are assigned role templates or individual permissions
4. The middleware `requirePermission()` checks permissions on protected routes

## 🔐 Permission Format

```javascript
{
  key: 'booking.create',           // Unique identifier (resource.action)
  name: 'Create Booking',          // Human-friendly name
  description: 'Create new bookings in the system',
  resource: 'booking',             // Resource type
  action: 'create'                 // Action type
}
```

## 📊 Role Template Format

```javascript
{
  templateName: 'Operations Manager',
  description: 'Full operational access',
  category: 'operations',          // operations, finance, support, management, admin
  permissions: [ObjectId, ...],    // Array of permission IDs
  isActive: true
}
```

## 🔄 Idempotent Seeding

All seed scripts are **idempotent**:
- If a permission/template exists → Updates it
- If it doesn't exist → Creates it
- Safe to run multiple times

## 📝 Adding New Permissions

1. Add permission object to `seed-permissions.js`
2. Run `npm run seed:permissions`
3. Update role templates if needed
4. Run `npm run seed:roles`

## 📝 Adding New Role Templates

1. Add template object to `seed-role-templates.js`
2. Specify permissions by their keys
3. Run `npm run seed:roles`

## 🐛 Troubleshooting

### "No permissions found for template"
- Run `npm run seed:permissions` first
- Check permission keys match exactly

### "Missing permissions for template"
- Some permission keys in template don't exist
- Check console warnings for missing keys
- Update permission keys or seed permissions first

### Database Connection Error
- Check `.env` file has correct `MONGODB_URI`
- Ensure MongoDB is running
- Verify network connectivity

## 🔗 Related Files

- `backend/src/models/permission.model.js` - Permission model
- `backend/src/models/roleTemplate.model.js` - Role template model
- `backend/src/models/staff.model.js` - Staff model (links to permissions)
- `backend/src/middlewares/requirePermission.js` - Permission checking middleware

## 📚 Documentation

See main project documentation for:
- How to assign permissions to staff
- How to check permissions in routes
- Permission management API endpoints
