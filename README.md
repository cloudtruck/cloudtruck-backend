# Cloudtruck Backend API

Complete backend implementation for the Cloudtruck managed trucking system.

## Architecture

- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM

- 
- **Cache**: Redis
- **Authentication**: Firebase Admin SDK + JWT
- **File Storage**: Cloudinary
- **Payment Gateway**: PhonePe
- **Real-time**: Socket.io
- **Validation**: Zod

## Project Structure

```
backend/
├── server.js                    # HTTP server with Socket.io
├── src/
│   ├── app.js                   # Express app configuration
│   ├── config/                  # Configuration files
│   │   ├── database.js          # MongoDB connection
│   │   ├── redis.js             # Redis connection
│   │   ├── firebase.js          # Firebase Admin SDK
│   │   ├── cloudinary.js        # Cloudinary config
│   │   ├── phonepe.js           # PhonePe config
│   │   └── constants.js         # App constants
│   ├── models/                  # Mongoose models
│   │   ├── user.model.js        # Base user model
│   │   ├── customer.model.js    # Customer profile
│   │   ├── driver.model.js      # Driver profile
│   │   ├── staff.model.js       # Staff profile
│   │   ├── vehicle.model.js     # Vehicle/truck master
│   │   ├── booking.model.js     # Shipment bookings
│   │   ├── payment.model.js     # Payment transactions
│   │   ├── tracking.model.js    # GPS tracking data
│   │   ├── document.model.js    # File uploads
│   │   ├── auditLog.model.js    # Audit trail
│   │   └── ...
│   ├── controllers/             # HTTP request handlers (thin)
│   │   ├── auth.controller.js
│   │   ├── booking.controller.js
│   │   ├── driver.controller.js
│   │   ├── customer.controller.js
│   │   ├── payment.controller.js
│   │   ├── tracking.controller.js
│   │   └── ...
│   ├── services/                # Business logic (fat)
│   │   ├── auth.service.js
│   │   ├── booking.service.js
│   │   ├── payment.service.js
│   │   ├── notification.service.js
│   │   └── ...
│   ├── routes/                  # Express routes
│   │   ├── index.js             # Routes aggregator
│   │   ├── auth.routes.js
│   │   ├── booking.routes.js
│   │   └── ...
│   ├── middlewares/             # Express middlewares
│   │   ├── auth.middleware.js   # JWT verification
│   │   ├── validation.middleware.js  # Zod validation
│   │   ├── errorHandler.middleware.js
│   │   ├── rateLimiter.middleware.js
│   │   └── upload.middleware.js
│   ├── validators/              # Zod schemas
│   │   ├── auth.validator.js
│   │   ├── booking.validator.js
│   │   └── ...
│   ├── sockets/                 # WebSocket handlers
│   │   ├── tracking.socket.js   # GPS location streaming
│   │   └── notification.socket.js
│   └── utils/                   # Utilities
│       ├── ApiError.js          # Error class
│       ├── ApiResponse.js       # Response wrapper
│       ├── asyncHandler.js      # Async wrapper
│       ├── logger.js            # Winston logger
│       └── helpers.js
└── uploads/                     # Temporary file storage
```

## Setup Instructions

### 1. Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- Redis >= 7.x
- Firebase project with Admin SDK
- Cloudinary account
- PhonePe merchant account (optional for testing)

### 2. Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Environment Configuration

Edit `.env` file with your credentials:

```env
# Required
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cloudtruck
REDIS_URL=redis://localhost:6379
ACCESS_TOKEN_SECRET=<generate-strong-secret>
REFRESH_TOKEN_SECRET=<generate-strong-secret>

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# PhonePe (Use sandbox for development)
PHONEPE_MERCHANT_ID=your-merchant-id
PHONEPE_SALT_KEY=your-salt-key
PHONEPE_SALT_INDEX=1
PHONEPE_API_URL=https://api-preprod.phonepe.com/apis/pg-sandbox
```

### 4. Database Setup

```bash
# Start MongoDB
mongod

# Start Redis
redis-server

# Seed RBAC permissions (optional)
npm run seed
```

### 5. Run Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### Base URL
```
http://localhost:5000/api/v1
```

### Authentication Routes (`/auth`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/login/mobile` | No | - | Mobile OTP login (Firebase) |
| POST | `/login/staff` | No | - | Staff email/password login |
| POST | `/refresh-token` | No | - | Refresh access token |
| POST | `/logout` | Yes | All | Logout user |
| POST | `/logout-all` | Yes | All | Logout from all devices |
| POST | `/change-password` | Yes | All | Change password |
| POST | `/reset-password` | No | - | Reset password |
| GET | `/me` | Yes | All | Get current user |
| POST | `/register/staff` | Yes | Staff+ | Register new staff |
| POST | `/verify/:userId` | Yes | Staff+ | Verify user KYC |
| POST | `/block/:userId` | Yes | Staff+ | Block user |
| POST | `/unblock/:userId` | Yes | Staff+ | Unblock user |

### Booking Routes (`/bookings`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Customer | Create booking |
| GET | `/` | Yes | All | Get all bookings (filtered) |
| GET | `/my-bookings` | Yes | Customer | Get my bookings |
| GET | `/driver-bookings` | Yes | Driver | Get assigned bookings |
| GET | `/stats` | Yes | Staff+ | Get booking statistics |
| GET | `/:id` | Yes | All | Get booking by ID |
| PATCH | `/:id/status` | Yes | Staff/Driver | Update booking status |
| POST | `/:id/assign-driver` | Yes | Staff+ | Assign driver to booking |
| POST | `/:id/cancel` | Yes | Customer/Staff | Cancel booking |
| POST | `/:id/delay` | Yes | Driver/Staff | Add delay notification |

### Driver Routes (`/drivers`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Driver | Create driver profile |
| GET | `/` | Yes | Staff+ | List all drivers |
| GET | `/my-profile` | Yes | Driver | Get my profile |
| GET | `/nearby` | Yes | Staff+ | Get nearby drivers |
| GET | `/:id` | Yes | Staff+ | Get driver by ID |
| PATCH | `/:id` | Yes | Staff+ | Update driver |
| POST | `/:id/verify` | Yes | Staff+ | Verify driver |
| POST | `/:id/blacklist` | Yes | Internal+ | Blacklist driver |

### Customer Routes (`/customers`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Customer | Create customer profile |
| GET | `/` | Yes | Staff+ | List all customers |
| GET | `/my-profile` | Yes | Customer | Get my profile |
| GET | `/my-dashboard` | Yes | Customer | Get dashboard stats |
| GET | `/:id` | Yes | Staff+ | Get customer by ID |
| PATCH | `/:id` | Yes | Staff+ | Update customer |
| POST | `/:id/verify` | Yes | Staff+ | Verify customer KYC |

### Vehicle Routes (`/vehicles`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Staff+ | Add new vehicle |
| GET | `/` | Yes | Staff+ | List all vehicles |
| GET | `/available` | Yes | Staff+ | Get available vehicles |
| GET | `/:id` | Yes | Staff+ | Get vehicle by ID |
| PATCH | `/:id` | Yes | Staff+ | Update vehicle |
| POST | `/:id/maintenance` | Yes | Staff+ | Add maintenance record |

### Payment Routes (`/payments`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | Customer | Create payment order |
| POST | `/initiate` | Yes | Customer | Initiate PhonePe payment |
| POST | `/phonepe/callback` | No | - | PhonePe webhook |
| GET | `/verify/:txnId` | Yes | All | Verify payment status |
| POST | `/manual` | Yes | Staff+ | Record manual payment |
| POST | `/:id/refund` | Yes | Internal+ | Initiate refund |
| GET | `/` | Yes | Staff+ | List all payments |

### Document Routes (`/documents`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/` | Yes | All | Upload document |
| GET | `/:entityType/:entityId` | Yes | All | Get entity documents |
| POST | `/booking/:id/pod` | Yes | Driver/Staff | Upload POD |
| POST | `/booking/:id/loading-images` | Yes | Driver/Staff | Upload loading images |
| GET | `/booking/:id` | Yes | All | Get booking documents |
| DELETE | `/:id` | Yes | Staff+ | Delete document |

### Tracking Routes (`/tracking`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/:bookingId/location` | Yes | Driver | Record GPS location |
| GET | `/:bookingId/history` | Yes | All | Get tracking history |
| GET | `/:bookingId/last-location` | Yes | All | Get last known location |
| GET | `/:bookingId/url` | Yes | Customer/Staff | Get tracking URL |
| GET | `/:bookingId/distance` | Yes | All | Calculate distance traveled |
| GET | `/:bookingId/statistics` | Yes | Staff+ | Get tracking stats |

### Audit Routes (`/audit`)

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| GET | `/` | Yes | Staff+ | Get audit logs |
| GET | `/my-activity` | Yes | All | Get my activity |
| GET | `/entity/:type/:id` | Yes | Staff+ | Get entity history |
| GET | `/user/:userId` | Yes | Staff+ | Get user activity |
| GET | `/suspicious` | Yes | Internal+ | Get suspicious activities |
| GET | `/export` | Yes | Internal+ | Export audit logs |

## WebSocket Namespaces

### Tracking (`/tracking`)

```javascript
// Driver joins booking room
socket.emit('driver:join', { driverId, bookingId });

// Send location update
socket.emit('location:update', {
  bookingId,
  driverId,
  latitude,
  longitude,
  accuracy,
  speed,
  heading,
  battery
});

// Listen for location updates
socket.on('location:updated', (data) => {
  console.log('New location:', data);
});
```

### Notifications (`/notifications`)

```javascript
// Join notification channel
socket.emit('user:join', { userId, role });

// Listen for notifications
socket.on('notification:new', (notification) => {
  console.log('New notification:', notification);
});
```

## Authentication Flow

### Mobile Login (Customer/Driver)

1. Client sends Firebase ID token to `/auth/login/mobile`
2. Server verifies token with Firebase Admin SDK
3. Server creates/finds user in database
4. Server generates JWT access + refresh tokens
5. Tokens set in HTTP-only cookies

### Staff Login

1. Client sends email + password to `/auth/login/staff`
2. Server verifies credentials with bcrypt
3. Server generates JWT tokens
4. Login attempts tracked (rate limited after 5 failures)

### Token Refresh

1. Client sends refresh token to `/auth/refresh-token`
2. Server validates refresh token
3. Server generates new access token
4. Old refresh token invalidated

## Error Handling

All errors follow standardized format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [],
  "stack": "..." // Only in development
}
```

Status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Response Format

All success responses:

```json
{
  "success": true,
  "statusCode": 200,
  "data": { ... },
  "message": "Operation successful"
}
```

Paginated responses:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "pages": 5
    }
  }
}
```

## Security Features

- ✅ JWT authentication with refresh tokens
- ✅ Role-based access control (RBAC)
- ✅ Input validation with Zod
- ✅ SQL/NoSQL injection prevention
- ✅ XSS protection
- ✅ Rate limiting
- ✅ Helmet security headers
- ✅ CORS configuration
- ✅ Password hashing (bcrypt)
- ✅ Soft delete pattern
- ✅ Audit logging
- ✅ Firebase token verification

## Performance Optimizations

- Database connection pooling
- Redis caching
- Mongoose query optimization with indexes
- Lean queries for read operations
- Pagination on all list endpoints
- WebSocket for real-time updates
- Cloudinary CDN for file delivery

## Monitoring & Logging

- Winston logger with multiple transports
- Request logging with Morgan
- Error tracking with stack traces
- Audit trail for all critical operations
- Performance metrics logging

## Testing

```bash
# Unit tests (when implemented)
npm test

# API testing with Postman
# Import backend/postman_collection.json
```

## Deployment

### Environment Setup

1. Set `NODE_ENV=production`
2. Use strong secrets for JWT
3. Configure production MongoDB cluster
4. Set up Redis cluster
5. Use production Firebase project
6. Enable Cloudinary optimizations
7. Configure production PhonePe credentials

### Process Management

```bash
# Using PM2
pm2 start server.js --name cloudtruck-api
pm2 save
pm2 startup
```

### Health Checks

- `GET /api/v1/health` - API health check
- Monitor MongoDB connection
- Monitor Redis connection
- Check WebSocket connections

## Contributing

1. Follow existing code patterns
2. Use `asyncHandler` for all async routes
3. Throw `ApiError` for errors
4. Return `ApiResponse` for success
5. Add Zod validators for new endpoints
6. Update audit logs for critical actions
7. Write JSDoc for complex functions

## License

ISC

## Support

For issues and questions, contact the development team.
