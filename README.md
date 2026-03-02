# CloudTruck Backend API

Complete backend for the CloudTruck managed trucking platform — booking management, real-time GPS tracking, payments, documents, and notifications.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Express.js |
| Database | MongoDB + Mongoose ODM |
| Cache | Redis |
| Auth | Firebase Admin SDK (OTP) + JWT |
| File Storage | Cloudinary |
| Payment | PhonePe |
| Real-time | Socket.io |
| Validation | Zod |
| Testing | Mocha + Chai + Sinon + MongoDB Memory Server |

## Project Structure

```
cloudtruck-backend/
├── server.js                        # HTTP server + Socket.io initialization
├── src/
│   ├── app.js                       # Express app, middleware registration
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   ├── firebase.js
│   │   ├── cloudinary.js
│   │   ├── phonepe.js
│   │   └── constants.js
│   ├── models/
│   │   ├── user.model.js            # Base user (auth identity)
│   │   ├── customer.model.js
│   │   ├── driver.model.js
│   │   ├── staff.model.js
│   │   ├── vehicle.model.js
│   │   ├── booking.model.js         # Core shipment booking
│   │   ├── payment.model.js
│   │   ├── tracking.model.js        # GPS points (TTL: 90 days)
│   │   ├── document.model.js        # Cloudinary file refs
│   │   ├── notification.model.js
│   │   ├── supportTicket.model.js
│   │   ├── ewayBill.model.js
│   │   ├── marketRate.model.js
│   │   ├── auditLog.model.js
│   │   └── ...
│   ├── controllers/                 # Thin HTTP handlers
│   ├── services/                    # Fat business logic layer
│   ├── routes/
│   │   ├── index.js                 # Aggregates all 22 route groups
│   │   └── *.routes.js
│   ├── middlewares/
│   │   ├── auth.middleware.js       # JWT verification
│   │   ├── rbac.middleware.js       # Role + field-level RBAC
│   │   ├── validation.middleware.js # Zod schema validation
│   │   ├── rateLimiter.middleware.js
│   │   └── upload.middleware.js     # Multer (temp disk storage)
│   ├── validators/                  # Zod schemas
│   ├── sockets/
│   │   ├── tracking.socket.js       # GPS streaming namespace
│   │   └── notification.socket.js
│   ├── jobs/
│   │   └── ewayBillExpiry.job.js    # node-cron background job
│   ├── scripts/                     # Seed scripts
│   └── utils/
│       ├── ApiError.js
│       ├── ApiResponse.js
│       ├── asyncHandler.js
│       ├── generateSequentialId.js  # Atomic counter-based IDs (BK…, TIC…)
│       ├── logger.js                # Winston
│       └── plugins/
│           └── pagination.plugin.js
├── docs/
│   └── customer-api.md              # Customer app API reference
└── test/                            # 52 Mocha specs
```

## Commands

```bash
# Development
npm run dev          # nodemon with auto-reload

# Production
npm start

# Tests (52 specs, all passing)
npm test             # Runs NODE_ENV=test mocha --recursive test/

# Seeding
npm run seed:org     # Organization + master data (75+ items)
npm run seed:rbac    # Permissions, roles, templates
npm run create-admin # Create admin user
npm run seed:all     # All seeds
```

## Setup

### 1. Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- Redis >= 7.x
- Firebase project with Admin SDK service account
- Cloudinary account
- PhonePe merchant account (sandbox for development)

### 2. Install

```bash
npm install
cp .env.example .env
```

### 3. Environment Variables

```env
# Core
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cloudtruck
REDIS_URL=redis://localhost:6379
ACCESS_TOKEN_SECRET=<strong-random-secret>
REFRESH_TOKEN_SECRET=<strong-random-secret>
ACCESS_TOKEN_EXPIRY=1h
REFRESH_TOKEN_EXPIRY=30d
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# PhonePe (sandbox)
PHONEPE_MERCHANT_ID=your-merchant-id
PHONEPE_SALT_KEY=your-salt-key
PHONEPE_SALT_INDEX=1
PHONEPE_API_URL=https://api-preprod.phonepe.com/apis/pg-sandbox

# Google Maps (optional — geocoding & routing)
GOOGLE_MAPS_API_KEY=your-key

# Rate limiting (optional — defaults shown)
RATE_LIMIT_WINDOW_MS=900000
GLOBAL_RATE_LIMIT=200
ADMIN_RATE_LIMIT=1000
```

### 4. Seed & Run

```bash
mongod
redis-server
npm run seed:all
npm run dev
```

---

## API Reference

**Base URL:** `http://localhost:5000/api/v1`

**Standard response:**
```json
{ "success": true, "statusCode": 200, "data": { ... }, "message": "..." }
```

**Paginated response** includes `data.items` and `data.pagination` (`page`, `limit`, `total`, `pages`).

**Auth:** JWT as `Authorization: Bearer <token>` header or `accessToken` HttpOnly cookie.

---

### Auth (`/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/otp/send` | No | Send OTP to phone |
| POST | `/otp/resend` | No | Resend OTP |
| POST | `/otp/verify` | No | Verify OTP → returns JWT tokens |
| POST | `/login/staff` | No | Staff email + password login |
| POST | `/refresh-token` | No | Rotate access + refresh tokens |
| GET | `/me` | Yes | Current user profile |
| POST | `/logout` | Yes | Logout current device |
| POST | `/logout-all` | Yes | Logout all devices |
| POST | `/change-password` | Yes | Change password |
| POST | `/register/staff` | Staff+ | Register new staff member |
| POST | `/verify/:userId` | Staff+ | Verify user KYC |
| POST | `/block/:userId` | Staff+ | Block user |
| POST | `/unblock/:userId` | Staff+ | Unblock user |

---

### Bookings (`/bookings`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Customer | Create booking (`multipart/form-data`) |
| GET | `/` | Yes | All | List bookings (filtered by role) |
| GET | `/truck-types` | Yes | All | Available truck types |
| GET | `/stats` | Yes | Staff+ | Booking statistics |
| GET | `/available-loads` | Yes | Driver | Open loads for bidding |
| GET | `/driver-bookings` | Yes | Driver | My assigned bookings |
| GET | `/:id` | Yes | All | Get booking by ObjectId or `BK…` ID |
| PATCH | `/:id/status` | Yes | Staff/Driver | Update booking status |
| POST | `/:id/assign-driver` | Yes | Staff+ | Assign driver + vehicle |
| POST | `/:id/cancel` | Yes | Customer/Staff | Cancel booking |
| POST | `/:id/delay` | Yes | Driver/Staff | Report delay |
| POST | `/:id/express-interest` | Yes | Driver | Driver expresses interest in a load |

**Booking status lifecycle:**
`created` → `under-review` → `assigned` → `driver-en-route` → `reached-pickup` → `loaded` → `in-transit` → `reached-destination` → `delivered` → `pod-received` → `closed` / `cancelled`

---

### Documents (`/documents`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | All | Upload a document |
| GET | `/booking/:bookingId` | Yes | All | All documents for a booking (grouped) |
| GET | `/booking/:bookingId/pod` | Yes | All | POD details + documents (customer-safe) |
| GET | `/booking/:bookingId/lr` | Yes | All | LR details + documents (customer-safe) |
| POST | `/booking/:bookingId/pod` | Yes | Driver/Staff | Upload POD (receiver details + files) |
| POST | `/booking/:bookingId/lr` | Yes | Staff+ | Upload LR (up to 5 files) |
| POST | `/booking/:bookingId/loading-images` | Yes | Driver/Staff | Upload loading images |
| GET | `/signed-url/:cloudinaryId` | Yes | All | Temporary signed download URL |
| DELETE | `/:id` | Yes | Staff+ | Delete document |

---

### Tracking (`/tracking`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/:bookingId/location` | Yes | Record GPS location |
| GET | `/:bookingId/history` | Yes | Full tracking history |
| GET | `/:bookingId/last-location` | Yes | Last known location |
| GET | `/:bookingId/url` | Yes | Shareable tracking URL |
| GET | `/:bookingId/distance` | Yes | Distance traveled (km) |
| GET | `/:bookingId/route` | Yes | Full GPS path |
| GET | `/:bookingId/statistics` | Yes | Speed/distance stats |

---

### Payments (`/payments`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Customer | Create payment order |
| POST | `/initiate` | Yes | Customer | Initiate PhonePe redirect |
| POST | `/phonepe/callback` | No | — | PhonePe webhook |
| GET | `/verify/:merchantTxnId` | Yes | All | Verify payment status |
| GET | `/my-payments` | Yes | Customer | My payment history |
| GET | `/:id` | Yes | All | Get payment by ID |
| GET | `/:id/invoice` | No | — | Download invoice PDF |
| POST | `/manual` | Yes | Staff+ | Record manual payment |
| POST | `/:id/refund` | Yes | Internal+ | Initiate refund |
| GET | `/` | Yes | Staff+ | List all payments |

---

### Support Tickets (`/support-tickets`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | All | Create ticket (`TIC…` ID generated) |
| GET | `/` | Yes | Staff+ | List all tickets |
| GET | `/my-tickets` | Yes | All | My tickets |
| GET | `/:id` | Yes | All | Get ticket |
| PATCH | `/:id` | Yes | Staff+ | Update ticket status/assignment |
| POST | `/:id/reply` | Yes | All | Add reply to thread |

**Categories:** `booking-issue`, `payment-issue`, `delivery-delay`, `damaged-goods`, `driver-behavior`, `app-issue`, `pod-issue`, `other`

---

### Notifications (`/notifications`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Yes | List notifications |
| GET | `/unread-count` | Yes | Unread count |
| PATCH | `/:id/read` | Yes | Mark as read |
| PATCH | `/read-all` | Yes | Mark all as read |
| DELETE | `/:id` | Yes | Delete notification |

---

### Drivers (`/drivers`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Driver | Create driver profile |
| GET | `/` | Yes | Staff+ | List drivers |
| GET | `/my-profile` | Yes | Driver | My profile |
| GET | `/nearby` | Yes | Staff+ | Nearby drivers (geo) |
| GET | `/:id` | Yes | Staff+ | Driver by ID |
| PATCH | `/:id` | Yes | Staff+ | Update driver |
| POST | `/:id/verify` | Yes | Staff+ | Verify KYC |
| POST | `/:id/blacklist` | Yes | Internal+ | Blacklist driver |

---

### Customers (`/customers`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Customer | Create customer profile |
| GET | `/` | Yes | Staff+ | List customers |
| GET | `/my-profile` | Yes | Customer | My profile |
| GET | `/my-dashboard` | Yes | Customer | Stats summary |
| GET | `/my-bookings` | Yes | Customer | Booking history |
| PATCH | `/my-gst` | Yes | Customer | Update GST number |
| GET/POST/PATCH/DELETE | `/my-bank-accounts` | Yes | Customer | Bank account management |
| GET | `/:id` | Yes | Staff+ | Customer by ID |
| PATCH | `/:id` | Yes | Staff+ | Update customer |

---

### Vehicles (`/vehicles`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Staff+ | Add vehicle |
| GET | `/` | Yes | Staff+ | List vehicles |
| GET | `/available` | Yes | Staff+ | Available vehicles |
| GET | `/driver/:driverId` | Yes | All | Vehicles for a driver |
| GET | `/:id` | Yes | Staff+ | Vehicle by ID |
| PATCH | `/:id` | Yes | Staff+ | Update vehicle |
| POST | `/:id/maintenance` | Yes | Staff+ | Add maintenance record |

---

### Market Rates (`/market-rates`) — Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Market freight rates (filterable) |
| GET | `/trends` | 6-month price trends per route |
| GET | `/cities` | Available cities |

---

### Other Routes

| Prefix | Description |
|--------|-------------|
| `/staff` | Staff CRUD + role management |
| `/audit` | Audit logs (Staff+) |
| `/branches` | Branch offices |
| `/organization` | Org settings |
| `/master-data` | Truck types, material types, etc. |
| `/eway-bills` | E-way bill management |
| `/accounts` | Financial accounts |
| `/exports` | CSV/Excel exports |
| `/role-templates` | RBAC role templates |
| `/permissions` | Field-level permissions |
| `/cities` | City master data |
| `/routes` | Planned route management |

---

## WebSocket

### Tracking Namespace (`/tracking`)

```js
const socket = io('http://localhost:5000/tracking', {
  auth: { token: '<accessToken>' }
});

// Driver: join booking room
socket.emit('driver:join', { driverId, bookingId });

// Driver: send location (throttled to 1/10s in production)
socket.emit('location:update', {
  bookingId, latitude, longitude, accuracy, speed, heading, battery
});

// Customer/Staff: watch a booking
socket.emit('watcher:join', { userId, bookingId, role: 'customer' });

// Receive updates
socket.on('location:updated', ({ latitude, longitude, speed, timestamp }) => { ... });
socket.on('location:response', ({ data }) => { ... }); // auto-sent on join (last known)
socket.on('driver:status', ({ isOnline }) => { ... });
```

### Notifications Namespace (`/notifications`)

```js
const socket = io('http://localhost:5000/notifications', {
  auth: { token: '<accessToken>' }
});
socket.emit('user:join', { userId, role });
socket.on('notification:new', (notification) => { ... });
```

---

## Authentication Flow

**Mobile OTP (Customer / Driver):**
1. `POST /auth/otp/send` → `{ sessionId }`
2. `POST /auth/otp/verify` → `{ accessToken, refreshToken, user }`
3. Tokens set as HttpOnly cookies automatically

**Staff Login:**
1. `POST /auth/login/staff` with `{ email, password }`
2. Up to 5 failed attempts → account locked

**Token Refresh:**
1. `POST /auth/refresh-token` with refresh token
2. Returns new access + refresh token pair (rotation)

---

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation / bad request |
| 401 | Missing or expired token |
| 403 | Access denied |
| 404 | Not found |
| 409 | Conflict (e.g. duplicate POD submission) |
| 429 | Rate limit exceeded |
| 500 | Server error |

---

## Testing

52 specs across 17 test files using Mocha + Chai + MongoDB Memory Server.

```bash
npm test
# NODE_ENV=test mocha --exit --recursive test/ --timeout 10000
```

Key test files:
- `test/booking.spec.js` — booking lifecycle
- `test/tracking.socket.spec.js` — WebSocket GPS streaming
- `test/payment.spec.js` — PhonePe integration
- `test/document.spec.js` — file upload flows

---

## ID Format

Sequential human-readable IDs generated via an atomic `counters` collection:

| Entity | Format | Example |
|--------|--------|---------|
| Booking | `BK{YY}{MM}{seq6}` | `BK2603000042` |
| Support Ticket | `TIC{YY}{MM}{seq6}` | `TIC2603000007` |

---

## Deployment

```bash
# PM2
pm2 start server.js --name cloudtruck-api
pm2 save && pm2 startup
```

**Checklist:**
- `NODE_ENV=production`
- Strong `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET`
- Production MongoDB Atlas cluster (`MONGODB_URI`)
- Redis cluster (`REDIS_URL`)
- Production PhonePe credentials
- Cloudinary production config
- Set `ALLOWED_ORIGINS` to production domain(s)

**Health check:** `GET /api/v1/health`

---

## License

ISC
