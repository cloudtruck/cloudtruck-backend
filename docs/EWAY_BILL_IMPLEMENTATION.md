# E-way Bill System Integration - Implementation Documentation

## Overview
Complete backend implementation for E-way Bill System with ClearTax GST verification, SMS alerts, and auto-sync workflow.

## Implemented Components

### 1. Database Model
**File:** `src/models/ewayBill.model.js`

**Features:**
- Complete E-way bill schema with Part-A (consignment) and Part-B (transporter) details
- Soft delete pattern with `isDeleted` flag
- Item list with HSN codes, quantities, and tax breakdowns (CGST, SGST, IGST)
- Part-B history tracking with audit trail
- Auto-sync metadata for tracking automated updates
- Expiry tracking with alert management
- Virtual fields for checking expiry status

**Key Fields:**
- `ewayBillNumber` - Unique E-way bill identifier
- `bookingId` - Reference to linked booking
- `status` - draft, active, expired, cancelled
- `fromGstin` / `toGstin` - Supplier/recipient GSTINs
- `itemList` - Array of goods being transported
- `vehicleNumber` / `transporterId` - Part-B transporter details
- `expiryTracking` - Validity period and alert flags
- `partBHistory` - Complete audit trail of Part-B updates

### 2. GST Verification Service
**Files:** 
- `src/config/gst.config.js` - Configuration
- `src/services/gstVerification.service.js` - Service implementation

**Features:**
- ClearTax Public API integration
- GSTIN format validation with regex
- Soft-fail pattern (doesn't block operations on verification failure)
- Bulk verification support
- State code extraction
- Inter-state/intra-state transaction detection

**Configuration (Environment Variables):**
```env
GST_VERIFICATION_ENABLED=true
CLEARTAX_API_KEY=your_api_key_here
CLEARTAX_API_URL=https://api.cleartax.in
```

**API Response:**
```javascript
{
  verified: true,
  verifiedAt: Date,
  gstin: "22AAAAA0000A1Z5",
  legalName: "Company Name Pvt Ltd",
  tradeName: "Trade Name",
  status: "Active",
  address: { ... }
}
```

### 3. Customer Service GST Integration
**File:** `src/services/customer.service.js`

**Updates:**
- GST verification during customer registration
- Verification results stored in `customer.metadata.gstVerification`
- Soft-fail pattern: logs warning but doesn't block registration
- Duplicate GST number check before verification

### 4. MSG91 Transactional SMS
**File:** `src/services/otp.service.js`

**New Function:** `sendTransactionalSMS(phoneNumber, message, customerId)`

**Features:**
- Separate from OTP functionality
- Support for custom messages
- Customer ID tracking for audit
- International phone number formatting

**Configuration:**
```env
MSG91_TRANSACTIONAL_FLOW_ID=your_flow_id
MSG91_SENDER_ID=CLTRCK
```

**Usage Example:**
```javascript
const result = await sendTransactionalSMS(
  '+919876543210',
  'E-way Bill EWB123 expires on 25-Jan-2026. Please extend validity.',
  customerId
);
```

### 5. E-way Bill Expiry Alert Cron Job
**File:** `src/jobs/ewayBillExpiry.job.js`

**Schedule:** Hourly (at minute 0: `0 * * * *`)

**Features:**
- Checks for bills expiring within 24 hours
- Sends SMS alerts to customers
- Sends in-app notifications to staff and operations team
- Updates alert flags to prevent duplicate notifications
- Continues processing even if individual alerts fail

**Alert Message Format:**
```
E-way Bill {number} for booking {id} expires on {date}. Please extend validity if required. - CloudTruck
```

**Initialization:** Automatically starts after database connection in `server.js`

### 6. E-way Bill Service
**File:** `src/services/ewayBill.service.js`

**Methods:**

1. **createEwayBill(billData, staffId)**
   - Creates E-way bill with status 'draft'
   - Validates booking exists and no duplicate bills
   - Creates audit log entry

2. **getEwayBill(billId)**
   - Retrieves bill with populated references
   - Filters out soft-deleted records

3. **listEwayBills(filters, pagination)**
   - Supports filtering by status, booking, date range
   - `expiringWithinDays` filter for upcoming expiries
   - Search by bill number, document number, or GSTIN
   - Pagination with sorting

4. **updatePartB(billId, newPartB, reason, staffId, notes)**
   - Updates transporter details (Part-B)
   - Requires valid reason from enum
   - Creates history entry with old/new values
   - Creates audit log
   - Validates bill is not cancelled or expired

5. **autoSyncPartB(billId, vehicleNumber, transporterId)**
   - Automatically synced when driver assigned to booking
   - Sets auto-sync metadata
   - Creates history entry with 'FIRST_ASSIGNMENT' reason
   - Only syncs if not already synced

6. **getPartBHistory(billId)**
   - Returns complete Part-B update history
   - Populated with staff details

7. **expireEwayBill(billId)**
   - Marks bill as expired
   - Idempotent operation

8. **cancelEwayBill(billId, reason, staffId)**
   - Cancels active bill
   - Records cancellation reason and staff
   - Creates audit log

### 7. Validators
**File:** `src/validators/ewayBill.validator.js`

**Schemas:**
- `createEwayBillSchema` - Full validation for bill creation
- `updatePartBSchema` - Part-B updates with reason validation
- `getEwayBillsQuerySchema` - Query parameters
- `cancelEwayBillSchema` - Cancellation validation
- `gstinSchema` - Reusable GSTIN validation

**Validation Rules:**
- GSTIN: 15 characters, format `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
- Vehicle Number: Format `^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$`
- HSN Code: 4-8 digits
- Valid units: KGS, MTR, LTR, PCS, BOX, TON, BAG, ROLL, BUNDLE, OTHER
- Transport modes: ROAD, RAIL, AIR, SHIP
- Document types: INV, BIL, CHL, DCN, OTH

### 8. Controller & Routes
**Files:**
- `src/controllers/ewayBill.controller.js` - Request handlers
- `src/routes/ewayBill.routes.js` - Route definitions
- `src/routes/index.js` - Route registration

**API Endpoints:**

```
POST   /api/v1/eway-bills                  Create E-way bill
GET    /api/v1/eway-bills                  List with filters
GET    /api/v1/eway-bills/:id              Get by ID
PUT    /api/v1/eway-bills/:id/part-b       Update Part-B (finance dept only)
GET    /api/v1/eway-bills/:id/history      Get Part-B history
PATCH  /api/v1/eway-bills/:id/cancel       Cancel E-way bill
```

**Authentication:**
- All routes require JWT authentication
- Restricted to staff, internal, and super-admin roles

**RBAC:**
- Part-B update requires `eway-bill.update-part-b` permission
- Only assigned to finance department staff

### 9. RBAC Permissions
**Files:**
- `src/config/constants.js` - Permission constants
- `src/scripts/seed-rbac.js` - Seed script

**New Permissions:**
- `eway-bill.create` - Create E-way bill
- `eway-bill.read` - View E-way bills
- `eway-bill.update-part-b` - Update Part-B (finance only)
- `eway-bill.cancel` - Cancel E-way bill

**Assignment:**
- Permissions assigned through Staff model `permissions` field
- Finance department staff should have `eway-bill.update-part-b` permission
- Run seed script: `npm run seed`

### 10. Booking Service Integration
**File:** `src/services/booking.service.js`

**Auto-Sync Implementation:**
- Added in `assignDriver()` method
- Checks for linked E-way bill after driver assignment
- Calls `EwayBillService.autoSyncPartB()` with vehicle number
- Logs success/failure (non-blocking)
- Continues assignment even if sync fails

**Flow:**
1. Driver and vehicle assigned to booking
2. System checks for active E-way bill linked to booking
3. If found, auto-updates Part-B with vehicle number
4. Creates history entry with reason 'FIRST_ASSIGNMENT'
5. Logs the sync event

### 11. Audit Logging
**File:** `src/services/audit.service.js`

**E-way Bill Actions:**
- `CREATE_EWAY_BILL` - Bill creation
- `EWAY_BILL_PART_B_UPDATE` - Part-B updates
- `CANCEL_EWAY_BILL` - Bill cancellation

**Metadata Captured:**
- E-way bill number
- Booking ID
- Before/after values
- Reason for update
- Staff name and ID
- Notes

## Database Indexes

**E-way Bill Collection:**
- `ewayBillNumber` - Unique index
- `bookingId + isDeleted` - Compound index
- `status + isDeleted` - Compound index
- `expiryTracking.validUpto + expiryTracking.expiryAlertSent` - Compound index
- `fromGstin` - Single index
- `toGstin` - Single index
- `createdAt` - Descending index

## API Request/Response Examples

### Create E-way Bill
**Request:**
```http
POST /api/v1/eway-bills
Authorization: Bearer <jwt_token>
Content-Type: application/json

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

**Response:**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "E-way bill created successfully",
  "data": {
    "_id": "6789...",
    "ewayBillNumber": "EWB1234567890",
    "status": "draft",
    "bookingId": "6789...",
    "fromGstin": "22AAAAA0000A1Z5",
    "toGstin": "29BBBBB1111B2Z6",
    ...
  }
}
```

### List E-way Bills
**Request:**
```http
GET /api/v1/eway-bills?status=active&expiringWithinDays=7&page=1&limit=20
Authorization: Bearer <jwt_token>
```

**Response:**
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

### Update Part-B
**Request:**
```http
PUT /api/v1/eway-bills/6789.../part-b
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "vehicleNumber": "MH14CD5678",
  "transporterId": "22TTTTT2222T3Z7",
  "reason": "VEHICLE_BREAKDOWN",
  "notes": "Original vehicle broke down, replacing with backup vehicle"
}
```

**Response:**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Part-B updated successfully",
  "data": {
    "_id": "6789...",
    "ewayBillNumber": "EWB1234567890",
    "vehicleNumber": "MH14CD5678",
    "partBHistory": [
      {
        "vehicleNumber": "MH14CD5678",
        "reason": "VEHICLE_BREAKDOWN",
        "notes": "Original vehicle broke down...",
        "timestamp": "2026-01-24T15:30:00Z",
        "updatedBy": {...},
        "oldValue": {...},
        "newValue": {...}
      }
    ]
  }
}
```

## Testing

### Manual Testing with Postman

1. **Import collection** (if available in workspace)
2. **Set environment variables:**
   - `base_url`: http://localhost:5000/api/v1
   - `token`: Your JWT token

3. **Test Flow:**
   - Create E-way bill
   - List E-way bills
   - Get E-way bill by ID
   - Update Part-B (requires finance permission)
   - Get Part-B history
   - Cancel E-way bill

### Automated Tests
Create test files in `test/` directory:
- `eway-bill.create.spec.js`
- `eway-bill.list.spec.js`
- `eway-bill.part-b.spec.js`
- `eway-bill.expiry-job.spec.js`

## Environment Variables

Add to `.env` file:

```env
# GST Verification (ClearTax)
GST_VERIFICATION_ENABLED=true
CLEARTAX_API_KEY=your_cleartax_api_key
CLEARTAX_API_URL=https://api.cleartax.in

# MSG91 SMS
MSG91_AUTH_KEY=your_msg91_auth_key
MSG91_TEMPLATE_ID=otp1
MSG91_TRANSACTIONAL_FLOW_ID=your_flow_id
MSG91_SENDER_ID=CLTRCK
```

## Deployment Checklist

- [ ] Install dependencies: `npm install`
- [ ] Run RBAC seed: `npm run seed`
- [ ] Set environment variables
- [ ] Verify ClearTax API key is valid
- [ ] Test GST verification endpoint
- [ ] Verify MSG91 credentials
- [ ] Test SMS sending
- [ ] Verify cron job starts successfully
- [ ] Check logs for initialization messages
- [ ] Test E-way bill creation
- [ ] Test Part-B auto-sync with booking assignment
- [ ] Verify Part-B update permission for finance staff
- [ ] Test expiry alert job (manual trigger or wait for hourly run)
- [ ] Monitor logs for errors

## Monitoring & Maintenance

### Logs to Monitor
- E-way bill creation: "E-way bill {number} created for booking {id}"
- Part-B auto-sync: "Auto-syncing Part-B for E-way bill {number}"
- Expiry job: "Running E-way Bill expiry alert job"
- SMS sending: "Transactional SMS sent successfully"
- GST verification: "GSTIN {gstin} verified successfully"

### Common Issues

1. **Cron job not starting**
   - Check database connection is established first
   - Verify node-cron is installed
   - Check server logs for initialization errors

2. **GST verification failing**
   - Verify CLEARTAX_API_KEY is set
   - Check GST_VERIFICATION_ENABLED=true
   - Verify ClearTax API is accessible
   - Check GSTIN format

3. **SMS not sending**
   - Verify MSG91_AUTH_KEY is set
   - Check phone number format
   - Verify MSG91 account has credits
   - Check MSG91 API logs

4. **Part-B not auto-syncing**
   - Check E-way bill exists and is active
   - Verify booking assignment is successful
   - Check logs for error messages
   - Ensure vehicle number format is valid

5. **Permission denied for Part-B update**
   - Verify staff has 'eway-bill.update-part-b' permission
   - Check staff department is 'finance'
   - Run RBAC seed script if permissions missing

## Future Enhancements

1. **E-way Bill Generation API**
   - Integrate with government E-way Bill portal
   - Auto-generate bills from booking data

2. **Validity Extension**
   - API endpoint to extend validity period
   - Automatic extension requests before expiry

3. **Reporting Dashboard**
   - E-way bill analytics
   - Expiry trends
   - Compliance reports

4. **Bulk Operations**
   - Bulk E-way bill creation
   - Bulk Part-B updates

5. **Mobile App Integration**
   - Driver app to view E-way bill details
   - QR code generation for quick access

## Support

For issues or questions:
- Check application logs: `logs/` directory
- Review this documentation
- Contact development team

---

**Implementation Date:** January 24, 2026  
**Version:** 1.0.0  
**Status:** ✅ Complete
