import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Permission from '../models/permission.model.js';

dotenv.config();

const seed = async () => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  await mongoose.connect(mongoURI);

  // Permissions are used by Staff records (see requirePermission middleware).
  // Super-admin bypasses permission checks, but staff/internal rely on these.
  const perms = [
    { key: 'booking.create', name: 'Create booking', resource: 'booking', action: 'create' },
    { key: 'booking.read', name: 'View booking', resource: 'booking', action: 'read' },
    { key: 'booking.cancel', name: 'Cancel booking', resource: 'booking', action: 'cancel' },
    { key: 'driver.read', name: 'View driver', resource: 'driver', action: 'read' },
    { key: 'driver.update_location', name: 'Update driver location', resource: 'driver', action: 'update_location' },
    { key: 'user.manage', name: 'Manage users', resource: 'user', action: 'manage' },
    { key: 'staff.manage', name: 'Manage staff', resource: 'staff', action: 'manage' },
    { key: 'reports.read', name: 'View reports', resource: 'reports', action: 'read' },
    // E-way Bill permissions
    { key: 'eway-bill.create', name: 'Create E-way bill', resource: 'eway-bill', action: 'create' },
    { key: 'eway-bill.read', name: 'View E-way bill', resource: 'eway-bill', action: 'read' },
    { key: 'eway-bill.update-part-b', name: 'Update E-way bill Part-B', resource: 'eway-bill', action: 'update-part-b' },
    { key: 'eway-bill.cancel', name: 'Cancel E-way bill', resource: 'eway-bill', action: 'cancel' }
  ];

  await Promise.all(
    perms.map((permission) =>
      Permission.findOneAndUpdate(
        { key: permission.key },
        { $set: permission },
        { upsert: true, new: true }
      )
    )
  );

  // eslint-disable-next-line no-console
  console.log('Seeded permissions');
  await mongoose.disconnect();
};

seed().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
