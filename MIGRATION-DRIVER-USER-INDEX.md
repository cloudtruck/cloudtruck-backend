Migration: Ensure `drivers.user` unique index

Purpose
- Add explicit unique partial index on `drivers.user` to enforce one-to-one relationship and speed up lookups.

Steps
1. Inspect duplicate drivers by user:

```bash
node src/scripts/ensure-driver-user-index.js
```

This will list duplicate groups and exit.

2. If duplicates exist, either manually resolve or run the script with `--fix` and provide an admin user id:

```bash
ADMIN_USER_ID=<adminUserId> node src/scripts/ensure-driver-user-index.js --fix
```

This marks extra documents as `isDeleted: true` (keeps first doc) and sets `deletedBy` to the provided admin id.

3. After duplicates are resolved, create the index (script attempts to create it). You can also run manually via mongo shell:

```js
db.drivers.createIndex({ user: 1 }, { unique: true, partialFilterExpression: { user: { $exists: true } } })
```

4. Verify indexes:

```js
db.drivers.getIndexes()
```

Notes
- Do this during a maintenance window if you're running this in production. Take a DB snapshot/backup first.
- The script is conservative and will not auto-fix without `--fix` flag and `ADMIN_USER_ID` set to prevent accidental deletions.
