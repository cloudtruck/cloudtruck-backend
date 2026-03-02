# CloudTruck — Customer App API Reference

**Base URL:** `http://localhost:5000/api/v1`
**Content-Type:** `application/json` (except file uploads — use `multipart/form-data`)

---

## Authentication

All protected endpoints require a JWT token passed as either:
- **Cookie:** `accessToken=<token>`
- **Header:** `Authorization: Bearer <token>`

Tokens are returned on login/OTP-verify. Access token expires in **1 hour**; use the refresh token to get a new one.

### Standard Response Shape

```json
{ "success": true, "statusCode": 200, "data": { ... }, "message": "..." }
```

Errors:
```json
{ "success": false, "message": "Error description" }
```

---

## 1. Auth

### Send OTP
```
POST /auth/otp/send
```
**Body:**
```json
{ "phone": "919876543210" }
```
**Response `data`:**
```json
{ "sessionId": "abc123" }
```

---

### Resend OTP
```
POST /auth/otp/resend
```
**Body:**
```json
{ "phone": "919876543210" }
```

---

### Verify OTP & Login
```
POST /auth/otp/verify
```
**Body:**
```json
{
  "phone": "919876543210",
  "otp": "123456",
  "role": "customer",
  "deviceInfo": { "deviceId": "...", "platform": "android" }
}
```
**Response `data`:**
```json
{
  "user": { "_id": "...", "phone": "...", "role": "customer", "name": "..." },
  "accessToken": "...",
  "refreshToken": "..."
}
```
> Tokens are also set as `HttpOnly` cookies automatically.

---

### Refresh Access Token
```
POST /auth/refresh-token
```
**Body:**
```json
{ "refreshToken": "..." }
```
**Response `data`:** `{ "accessToken": "...", "refreshToken": "..." }`

---

### Get Current User *(auth required)*
```
GET /auth/me
```
**Response `data`:** Full user object with profile.

---

### Logout *(auth required)*
```
POST /auth/logout
```
Clears tokens for the current device.

---

### Logout All Devices *(auth required)*
```
POST /auth/logout-all
```

---

## 2. Customer Profile *(auth required)*

### Get My Profile
```
GET /customers/my-profile
```
**Response `data`:** Customer profile including name, phone, email, GST, credit limit, bank accounts.

---

### Get My Dashboard
```
GET /customers/my-dashboard
```
**Response `data`:** Summary stats — total bookings, active bookings, total spend, pending payments.

---

### Get My Booking History
```
GET /customers/my-bookings
```
**Query params (all optional):**

| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by booking status |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

---

### Update My GST
```
PATCH /customers/my-gst
```
**Body:**
```json
{ "gst": "27AAPFU0939F1ZV" }
```

---

### Bank Accounts

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/customers/my-bank-accounts` | List bank accounts |
| `POST` | `/customers/my-bank-accounts` | Add bank account |
| `PATCH` | `/customers/my-bank-accounts/:accountId` | Update bank account |
| `DELETE` | `/customers/my-bank-accounts/:accountId` | Remove bank account |
| `PATCH` | `/customers/my-bank-accounts/:accountId/primary` | Set as primary |

**Add Bank Account body:**
```json
{
  "accountHolderName": "John Doe",
  "accountNumber": "123456789012",
  "ifscCode": "HDFC0001234",
  "bankName": "HDFC Bank",
  "accountType": "savings"
}
```

---

## 3. Bookings *(auth required)*

### Create Booking
```
POST /bookings
Content-Type: multipart/form-data
```
**Body fields:**

| Field | Required | Type | Notes |
|---|---|---|---|
| `pickupCity` | Yes | string | |
| `pickupAddress` | Yes | string | |
| `pickupLat` | Yes | number | |
| `pickupLng` | Yes | number | |
| `pickupContactName` | No | string | |
| `pickupContactPhone` | No | string | |
| `dropCity` | Yes | string | |
| `dropAddress` | Yes | string | |
| `dropLat` | Yes | number | |
| `dropLng` | Yes | number | |
| `dropContactName` | No | string | |
| `dropContactPhone` | No | string | |
| `materialType` | Yes | enum | See values below |
| `weight` | Yes | number | |
| `weightUnit` | No | enum | `kg` / `tons` / `quintal` (default: `tons`) |
| `truckType` | Yes | string | From master data |
| `bodyType` | No | enum | `open` / `closed` / `container` / `tanker` / `flatbed` |
| `loadDate` | No | ISO datetime | Must be in the future |
| `expectedDeliveryDate` | No | ISO datetime | |
| `expectedAmount` | No | number | |
| `advanceRequired` | No | number | Default: 0 |
| `isHazardous` | No | boolean | |
| `isFragile` | No | boolean | |
| `requiresTemperatureControl` | No | boolean | |
| `priority` | No | enum | `low` / `medium` / `high` / `urgent` |
| `additionalInstructions` | No | string | |
| `cargoImages` | No | file(s) | Up to 10 images |

**`materialType` values:**
`FMCG`, `electronics`, `furniture`, `steel`, `cement`, `tiles`, `chemicals`, `textiles`, `agriculture`, `automobile-parts`, `machinery`, `paper`, `pharma`, `plastic`, `food-grains`, `vegetables-fruits`, `general-cargo`, `other`

---

### List My Bookings
```
GET /bookings
```
> Customers automatically see only their own bookings.

**Query params (all optional):**

| Param | Description |
|---|---|
| `status` | Filter by status |
| `paymentStatus` | `unpaid` / `paid` / `partial` / `failed` |
| `startDate` | ISO date filter |
| `endDate` | ISO date filter |
| `search` | Search by booking ID |
| `page` | Default: 1 |
| `limit` | Default: 20 |

**Booking statuses (lifecycle order):**
`created` → `under-review` → `assigned` → `driver-en-route` → `reached-pickup` → `loaded` → `in-transit` → `reached-destination` → `delivered` → `pod-received` → `closed` / `cancelled`

---

### Get Booking by ID
```
GET /bookings/:id
```
`:id` can be the MongoDB ObjectId or the readable `bookingId` (e.g. `BK2603000001`).

---

### Cancel Booking
```
POST /bookings/:id/cancel
```
**Body:**
```json
{ "reason": "Changed plans due to schedule conflict" }
```

---

### Get Truck Types
```
GET /bookings/truck-types
```
Returns available truck types for the booking form.

---

## 4. Tracking *(auth required)*

### Get Tracking History
```
GET /tracking/:bookingId/history
```
**Query params (optional):** `startTime`, `endTime`, `limit`

---

### Get Last Known Location
```
GET /tracking/:bookingId/last-location
```
**Response `data`:**
```json
{
  "latitude": 18.9220,
  "longitude": 72.8347,
  "speed": 60,
  "timestamp": "2026-03-02T10:30:00.000Z"
}
```

---

### Get Live Tracking URL
```
GET /tracking/:bookingId/url
```
Returns a shareable URL for live tracking.

---

### Get Distance Traveled
```
GET /tracking/:bookingId/distance
```
**Response `data`:** `{ "distanceTraveled": 245.6 }` (in km)

---

### Get Tracking Route
```
GET /tracking/:bookingId/route
```
Returns the full GPS path of the trip.

---

## 5. Documents *(auth required)*

### Get All Documents for a Booking
```
GET /documents/booking/:bookingId
```
**Response `data`:**
```json
{
  "all": [...],
  "pod": [...],
  "lr": [...],
  "lrCopy": [...],
  "weightSlip": [...],
  "loadingImages": [...],
  "other": [...]
}
```

---

### Get POD (Proof of Delivery)
```
GET /documents/booking/:bookingId/pod
```
**Response `data`:**
```json
{
  "podDetails": {
    "receiverName": "John Doe",
    "receiverPhone": "9876543210",
    "deliveredAt": "2026-03-02T14:00:00.000Z",
    "remarks": "Delivered in good condition"
  },
  "podUploadedAt": "2026-03-02T14:05:00.000Z",
  "documents": {
    "pod": [{ "_id": "...", "url": "https://...", "format": "jpg" }],
    "lrCopy": [...],
    "weightSlip": [...]
  }
}
```
> `podDetails` is `null` if POD has not been uploaded yet.

---

### Get LR (Lorry Receipt)
```
GET /documents/booking/:bookingId/lr
```
**Response `data`:**
```json
{
  "available": true,
  "lrDetails": {
    "lrNumber": "LR-2026-001",
    "lrDate": "2026-03-01T00:00:00.000Z",
    "remarks": "...",
    "uploadedAt": "2026-03-01T10:00:00.000Z",
    "documents": [{ "_id": "...", "url": "https://...", "format": "jpg" }]
  }
}
```
> `available: false` when LR has not been uploaded yet.

---

### Get Signed Download URL
```
GET /documents/signed-url/:cloudinaryId
```
**Query params:** `expiresIn` (seconds, default: 3600)

**Response `data`:** `{ "url": "https://..." }`

---

## 6. Payments *(auth required)*

### Create Payment Order
```
POST /payments
```
**Body:**
```json
{
  "bookingId": "699c25b77f4bd8389688f35c",
  "amount": 15000,
  "returnUrl": "https://yourapp.com/payment/callback"
}
```
> If `returnUrl` is provided, the PhonePe redirect URL is returned immediately in the same response.

**Response `data`:**
```json
{
  "_id": "...",
  "bookingId": "BK2603000001",
  "amount": 15000,
  "status": "pending",
  "phonePeRedirectUrl": "https://mercury-t2.phonepe.com/..."
}
```

---

### Initiate PhonePe Payment
```
POST /payments/initiate
```
Use this if you created the order without a `returnUrl`.

**Body:**
```json
{
  "paymentId": "...",
  "returnUrl": "https://yourapp.com/payment/callback"
}
```
**Response `data`:** `{ "redirectUrl": "https://mercury-t2.phonepe.com/..." }`

---

### Verify Payment Status
```
GET /payments/verify/:merchantTransactionId
```
Poll this after returning from the PhonePe redirect.

**Response `data`:** Payment object with updated `status` (`success` / `failed` / `pending`).

---

### Get My Payments
```
GET /payments/my-payments
```
**Query params (optional):** `status`, `page`, `limit`

---

### Get Payment by ID
```
GET /payments/:id
```

---

### Download Invoice (PDF)
```
GET /payments/:id/invoice
```
> No auth required. Returns a PDF file (`application/pdf`).

---

## 7. Support Tickets *(auth required)*

### Create Ticket
```
POST /support-tickets
```
**Body:**

| Field | Required | Type | Notes |
|---|---|---|---|
| `category` | Yes | enum | See values below |
| `subject` | Yes | string | 5–100 chars |
| `description` | Yes | string | 10–1000 chars |
| `bookingId` | No | string | Link to a booking |
| `priority` | No | enum | `low` / `medium` / `high` / `urgent` (default: `medium`) |

**`category` values:**
`booking-issue`, `payment-issue`, `delivery-delay`, `damaged-goods`, `driver-behavior`, `app-issue`, `pod-issue`, `other`

**Response `data`:** Created ticket with `ticketId` (e.g. `TIC2603000001`).

---

### Get My Tickets
```
GET /support-tickets/my-tickets
```
**Query params (optional):** `page`, `limit`

---

### Get Ticket by ID
```
GET /support-tickets/:id
```

---

## 8. Notifications *(auth required)*

### Get Notifications
```
GET /notifications
```
**Query params (optional):** `page`, `limit`, `isRead` (`true`/`false`)

---

### Get Unread Count
```
GET /notifications/unread-count
```
**Response `data`:** `{ "count": 5 }`

---

### Mark Notification as Read
```
PATCH /notifications/:id/read
```

---

### Mark All as Read
```
PATCH /notifications/read-all
```

---

### Delete Notification
```
DELETE /notifications/:id
```

---

## 9. Market Rates *(public)*

### Get Market Rates
```
GET /market-rates
```
**Query params (optional):**

| Param | Description |
|---|---|
| `fromCity` | Filter by origin city |
| `toCity` | Filter by destination city |
| `truckType` | Filter by truck type |
| `page` | Default: 1 |
| `limit` | Default: 20 |

---

### Get Price Trends
```
GET /market-rates/trends
```
Same query params as above. Returns last 6 months of price history per route.

---

### Get Available Cities
```
GET /market-rates/cities
```
Returns a sorted list of all cities with active market rates.

---

## WebSocket — Real-time Tracking

**URL:** `ws://localhost:5000` (namespace: `/tracking`)

**Connect:**
```js
const socket = io('http://localhost:5000/tracking', {
  auth: { token: '<accessToken>' }
});
```

**Subscribe to a booking:**
```js
socket.emit('join-booking', { bookingId: '...' });
```

**Receive location updates:**
```js
socket.on('location-update', (data) => {
  // { bookingId, latitude, longitude, speed, timestamp }
});
```

---

## Common HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `400` | Validation error / bad request |
| `401` | Missing or expired token |
| `403` | Access denied (wrong role or not your resource) |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate submission) |
| `429` | Rate limit exceeded |
| `500` | Server error |
