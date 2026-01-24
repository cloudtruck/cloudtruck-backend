# E-way Bill API Reference

Base URL: `http://localhost:5000/api/v1`

## Authentication
All endpoints require JWT authentication via Bearer token:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Create E-way Bill
```http
POST /eway-bills
```

**Required Role:** Staff, Internal, Super-admin

**Request Body:**
```json
{
  "ewayBillNumber": "EWB1234567890",
  "bookingId": "BK17378962360001",
  "fromGstin": "22AAAAA0000A1Z5",
  "toGstin": "29BBBBB1111B2Z6",
  "documentNumber": "INV/2026/001",
  "documentDate": "2026-01-24T10:00:00Z",
  "documentType": "INV",
  "itemList": [
    {
      "hsnCode": "84143000",
      "description": "Air compressors",
      "quantity": 10,
      "unit": "PCS",
      "taxableValue": 100000,
      "cgst": 9000,
      "sgst": 9000,
      "igst": 0
    }
  ],
  "partATotalValue": 100000,
  "totalTax": 18000,
  "vehicleNumber": "MH12AB1234",
  "transporterId": "22TTTTT2222T3Z7",
  "transMode": "ROAD",
  "validFrom": "2026-01-24T00:00:00Z",
  "validUpto": "2026-01-27T23:59:59Z"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "statusCode": 201,
  "message": "E-way bill created successfully",
  "data": {
    "_id": "678...",
    "ewayBillNumber": "EWB1234567890",
    "status": "draft",
    ...
  }
}
```

---

### 2. List E-way Bills
```http
GET /eway-bills
```

**Required Role:** Staff, Internal, Super-admin

**Query Parameters:**
- `status` - Filter by status (draft, active, expired, cancelled)
- `bookingId` - Filter by booking ID
- `dateFrom` - Filter by creation date (ISO 8601)
- `dateTo` - Filter by creation date (ISO 8601)
- `expiringWithinDays` - Filter bills expiring within X days
- `search` - Search by bill number, document number, or GSTIN
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sort` - Sort field (default: -createdAt)

**Example:**
```http
GET /eway-bills?status=active&expiringWithinDays=7&page=1&limit=20
```

**Response:** 200 OK
```json
{
  "success": true,
  "statusCode": 200,
  "message": "E-way bills retrieved successfully",
  "data": {
    "docs": [...],
    "totalDocs": 45,
    "limit": 20,
    "page": 1,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

### 3. Get E-way Bill by ID
```http
GET /eway-bills/:id
```

**Required Role:** Staff, Internal, Super-admin

**Response:** 200 OK
```json
{
  "success": true,
  "statusCode": 200,
  "message": "E-way bill retrieved successfully",
  "data": {
    "_id": "678...",
    "ewayBillNumber": "EWB1234567890",
    "bookingId": {
      "_id": "678...",
      "bookingId": "BK17378962360001",
      "customer": {...}
    },
    "status": "active",
    "fromGstin": "22AAAAA0000A1Z5",
    "toGstin": "29BBBBB1111B2Z6",
    "itemList": [...],
    "vehicleNumber": "MH12AB1234",
    "expiryTracking": {
      "validFrom": "2026-01-24T00:00:00.000Z",
      "validUpto": "2026-01-27T23:59:59.000Z",
      "expiryAlertSent": false
    },
    "createdBy": {...},
    "createdAt": "2026-01-24T10:00:00.000Z"
  }
}
```

---

### 4. Update Part-B
```http
PUT /eway-bills/:id/part-b
```

**Required Role:** Staff, Internal, Super-admin  
**Required Permission:** `eway-bill.update-part-b` (Finance department only)

**Request Body:**
```json
{
  "vehicleNumber": "MH14CD5678",
  "transporterId": "22TTTTT2222T3Z7",
  "transMode": "ROAD",
  "transDocNo": "LR-2026-001",
  "transDate": "2026-01-24T12:00:00Z",
  "reason": "VEHICLE_BREAKDOWN",
  "notes": "Original vehicle broke down, replacing with backup vehicle"
}
```

**Reason Enum:**
- `VEHICLE_BREAKDOWN`
- `DRIVER_CHANGE`
- `ROUTE_CHANGE`
- `TRANSSHIPMENT`
- `FIRST_ASSIGNMENT`
- `OTHER`

**Response:** 200 OK
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Part-B updated successfully",
  "data": {
    "_id": "678...",
    "ewayBillNumber": "EWB1234567890",
    "vehicleNumber": "MH14CD5678",
    "partBHistory": [
      {
        "_id": "678...",
        "vehicleNumber": "MH14CD5678",
        "transporterId": "22TTTTT2222T3Z7",
        "reason": "VEHICLE_BREAKDOWN",
        "notes": "Original vehicle broke down...",
        "timestamp": "2026-01-24T15:30:00.000Z",
        "updatedBy": {
          "_id": "678...",
          "name": "John Doe",
          "department": "finance"
        },
        "oldValue": {
          "vehicleNumber": "MH12AB1234",
          "transporterId": "22TTTTT2222T3Z7"
        },
        "newValue": {
          "vehicleNumber": "MH14CD5678",
          "transporterId": "22TTTTT2222T3Z7"
        }
      }
    ]
  }
}
```

---

### 5. Get Part-B History
```http
GET /eway-bills/:id/history
```

**Required Role:** Staff, Internal, Super-admin

**Response:** 200 OK
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Part-B history retrieved successfully",
  "data": [
    {
      "_id": "678...",
      "vehicleNumber": "MH14CD5678",
      "transporterId": "22TTTTT2222T3Z7",
      "reason": "VEHICLE_BREAKDOWN",
      "notes": "Original vehicle broke down...",
      "timestamp": "2026-01-24T15:30:00.000Z",
      "updatedBy": {
        "_id": "678...",
        "name": "John Doe",
        "department": "finance",
        "email": "john@example.com"
      },
      "oldValue": {...},
      "newValue": {...}
    },
    {
      "_id": "678...",
      "vehicleNumber": "MH12AB1234",
      "reason": "FIRST_ASSIGNMENT",
      "notes": "Automatically synced from booking assignment",
      "timestamp": "2026-01-24T10:05:00.000Z",
      ...
    }
  ]
}
```

---

### 6. Cancel E-way Bill
```http
PATCH /eway-bills/:id/cancel
```

**Required Role:** Staff, Internal, Super-admin

**Request Body:**
```json
{
  "reason": "Booking cancelled by customer. E-way bill no longer required."
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "statusCode": 200,
  "message": "E-way bill cancelled successfully",
  "data": {
    "_id": "678...",
    "ewayBillNumber": "EWB1234567890",
    "status": "cancelled",
    "cancelledBy": {
      "_id": "678...",
      "name": "Jane Smith"
    },
    "cancelledAt": "2026-01-24T16:00:00.000Z",
    "cancellationReason": "Booking cancelled by customer..."
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "statusCode": 400,
  "message": "E-way bill number already exists"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "statusCode": 403,
  "message": "Access denied - Insufficient permissions for update-part-b on eway-bill"
}
```

### 404 Not Found
```json
{
  "success": false,
  "statusCode": 404,
  "message": "E-way bill not found"
}
```

### 422 Validation Error
```json
{
  "success": false,
  "statusCode": 422,
  "message": "Validation failed",
  "errors": [
    {
      "field": "fromGstin",
      "message": "Invalid GSTIN format"
    },
    {
      "field": "vehicleNumber",
      "message": "Invalid vehicle number format"
    }
  ]
}
```

---

## Data Types & Enums

### Document Types
- `INV` - Invoice
- `BIL` - Bill of Supply
- `CHL` - Delivery Challan
- `DCN` - Debit/Credit Note
- `OTH` - Other

### Transport Modes
- `ROAD`
- `RAIL`
- `AIR`
- `SHIP`

### Units
- `KGS` - Kilograms
- `MTR` - Meters
- `LTR` - Liters
- `PCS` - Pieces
- `BOX` - Boxes
- `TON` - Tons
- `BAG` - Bags
- `ROLL` - Rolls
- `BUNDLE` - Bundles
- `OTHER` - Other

### Status Values
- `draft` - E-way bill created but not yet active
- `active` - E-way bill is active and valid
- `expired` - E-way bill validity has expired
- `cancelled` - E-way bill has been cancelled

---

## Validation Rules

### GSTIN Format
- Length: 15 characters
- Pattern: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- Example: `22AAAAA0000A1Z5`

### Vehicle Number Format
- Pattern: `^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$`
- Example: `MH12AB1234`

### HSN Code Format
- Length: 4-8 digits
- Pattern: `^\d{4,8}$`
- Example: `84143000`

---

## Notes

1. **Auto-sync:** When a driver is assigned to a booking with a linked E-way bill, Part-B is automatically updated with the vehicle number.

2. **Expiry Alerts:** An hourly cron job checks for bills expiring within 24 hours and sends SMS alerts to customers and notifications to staff.

3. **Soft Delete:** Deleted E-way bills are marked with `isDeleted: true` but not physically removed from the database.

4. **Audit Trail:** All Part-B updates are tracked in `partBHistory` with complete before/after values and reasons.

5. **Finance Permission:** Only staff with the `eway-bill.update-part-b` permission (typically finance department) can manually update Part-B.
