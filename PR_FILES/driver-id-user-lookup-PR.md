Title: Make driver lookup deterministic (driver._id primary) and add explicit user-based lookup

Summary
- Deterministic lookup: `DriverService.getDriverById` now validates ObjectId and tries document `_id` first; falls back to `user` for backward compatibility.
- Added `DriverService.getDriverByUserId` and controller `getDriverByUser`.
- Added route `GET /api/v1/drivers/by-user/:userId` (staff/internal/super-admin) with validator.
- Added explicit index `driverSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } });`.
- Added migration script `src/scripts/ensure-driver-user-index.js` to detect duplicates and optionally fix them.
- Added integration tests: `test/driver.by-id.spec.js`, `test/driver.by-user.spec.js`, `test/driver.index.spec.js` (Mocha/Chai/Supertest with mongodb-memory-server).
- Added docs `docs/api/drivers.md` and migration instructions `MIGRATION-DRIVER-USER-INDEX.md`.

How to test locally
1. npm install (to install dev deps)
2. Run tests: `npm test`
3. Run migration script to detect duplicates: `node src/scripts/ensure-driver-user-index.js`
4. Optionally fix duplicates: `ADMIN_USER_ID=<adminUserId> node src/scripts/ensure-driver-user-index.js --fix`

Notes
- This is backwards compatible: `/api/v1/drivers/:id` still works if `:id` is a user id (fallback), but primary behavior is now document-first and deterministic.
- Recommend running migration script and creating index in staging before production.
- If you'd like, I can apply same pattern to staff/customer services in a follow-up PR.
