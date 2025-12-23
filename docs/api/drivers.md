# Drivers API

## GET /api/v1/drivers/:id
Fetch driver by driver document id (primary). If the supplied id is a valid ObjectId but there is no driver document with that _id, the server will fall back to look up a driver by `user` id (legacy fallback). Clients should prefer using `/by-user/:userId` for explicit user-based lookups.

Request example:
```
GET /api/v1/drivers/64a1f2b8e8f4b2d05cfae123
Authorization: Bearer <staff-token>
```

Response:
```json
{
  "status": "success",
  "data": {
    "_id": "64a1f2b8e8f4b2d05cfae123",
    "user": "64a1f2b8e8f4b2d05cfae999",
    "name": "Ram Kumar"
  }
}
```

## GET /api/v1/drivers/by-user/:userId
Fetch driver profile for the supplied user id (explicit user-based lookup). Use this to avoid ambiguity and for clarity.

Request example:
```
GET /api/v1/drivers/by-user/64a1f2b8e8f4b2d05cfae999
Authorization: Bearer <staff-token>
```

Response: same as above.

**Notes:**
- Passing a `user` id into `/api/v1/drivers/:id` will still work as a fallback for backward compatibility, but clients should migrate to `/by-user/:userId`.
- Access: `staff`, `internal`, `super-admin`.
