# E-way Bill System - Deployment Checklist

## Pre-Deployment

### Dependencies
- [x] Install node-cron: `npm install node-cron`
- [ ] Verify all dependencies installed: `npm install`
- [ ] Check for security vulnerabilities: `npm audit`

### Database
- [ ] Run RBAC seed script: `npm run seed`
- [ ] Verify permissions created in database
- [ ] Create test data (optional)

### Configuration
- [ ] Set environment variables in `.env`:
  ```env
  # GST Verification
  GST_VERIFICATION_ENABLED=true
  CLEARTAX_API_KEY=your_api_key_here
  CLEARTAX_API_URL=https://api.cleartax.in
  
  # MSG91 SMS
  MSG91_AUTH_KEY=your_auth_key_here
  MSG91_TEMPLATE_ID=otp1
  MSG91_TRANSACTIONAL_FLOW_ID=your_flow_id_here
  MSG91_SENDER_ID=CLTRCK
  ```

### API Keys
- [ ] Obtain ClearTax API key
- [ ] Verify ClearTax API access
- [ ] Obtain MSG91 credentials
- [ ] Verify MSG91 account has SMS credits
- [ ] Test MSG91 API connection

## Deployment

### Code Review
- [ ] Review all created files for code quality
- [ ] Check for proper error handling
- [ ] Verify all imports are correct
- [ ] Ensure no hardcoded values

### Testing
- [ ] Test E-way bill creation
- [ ] Test E-way bill listing with filters
- [ ] Test Part-B update (with finance permission)
- [ ] Test Part-B history retrieval
- [ ] Test E-way bill cancellation
- [ ] Test GST verification (with valid GSTIN)
- [ ] Test SMS sending (with valid phone number)
- [ ] Verify auto-sync on booking assignment
- [ ] Test expiry alert job (manual trigger)

### Server Startup
- [ ] Start server: `npm run dev` or `npm start`
- [ ] Verify no startup errors in logs
- [ ] Check cron job initialization message:
  ```
  E-way Bill expiry alert job scheduled: 0 * * * *
  ```
- [ ] Verify database connection successful
- [ ] Check all routes registered

## Post-Deployment

### Verification
- [ ] Test health endpoint: `GET /api/v1/health`
- [ ] Verify authentication works
- [ ] Test each E-way bill endpoint
- [ ] Check audit logs are being created
- [ ] Verify notifications are sent
- [ ] Check SMS delivery logs

### Monitoring
- [ ] Monitor application logs for errors
- [ ] Check cron job execution logs (hourly)
- [ ] Monitor database indexes performance
- [ ] Track API response times
- [ ] Monitor SMS delivery success rate
- [ ] Check GST verification success rate

### Staff Setup
- [ ] Create/update staff profiles with finance department
- [ ] Assign `eway-bill.update-part-b` permission to finance staff
- [ ] Verify finance staff can update Part-B
- [ ] Verify other staff cannot update Part-B
- [ ] Test operations staff receive expiry notifications

## Integration Testing

### Booking Flow
- [ ] Create a booking
- [ ] Create E-way bill for booking
- [ ] Assign driver to booking
- [ ] Verify Part-B auto-synced with vehicle number
- [ ] Check Part-B history shows auto-sync entry
- [ ] Update booking status to in-transit
- [ ] Complete booking delivery

### Customer Registration
- [ ] Register new customer with GST number
- [ ] Verify GST verification attempted
- [ ] Check customer metadata has verification result
- [ ] Test with invalid GST format
- [ ] Test with valid but non-existent GST
- [ ] Verify registration completes even if verification fails

### Expiry Alert Flow
- [ ] Create E-way bill expiring within 24 hours
- [ ] Wait for hourly cron job (or trigger manually)
- [ ] Verify SMS sent to customer
- [ ] Verify notification sent to staff
- [ ] Check `expiryAlertSent` flag updated
- [ ] Verify no duplicate alerts sent

## Performance Testing

### Load Testing
- [ ] Test with 100+ E-way bills
- [ ] Test list endpoint with various filters
- [ ] Test search functionality with large dataset
- [ ] Verify pagination works correctly
- [ ] Check database query performance

### Cron Job Testing
- [ ] Test with multiple expiring bills
- [ ] Verify job completes within reasonable time
- [ ] Check memory usage during job execution
- [ ] Monitor for any memory leaks

## Security Testing

### Authentication & Authorization
- [ ] Test endpoints without authentication (should fail)
- [ ] Test endpoints with customer role (should fail)
- [ ] Test endpoints with driver role (should fail)
- [ ] Test Part-B update without finance permission (should fail)
- [ ] Test Part-B update with finance permission (should succeed)
- [ ] Test with expired JWT token (should fail)

### Input Validation
- [ ] Test with invalid GSTIN format
- [ ] Test with invalid vehicle number format
- [ ] Test with invalid HSN codes
- [ ] Test with negative tax values
- [ ] Test with missing required fields
- [ ] Test with XSS attempts in text fields
- [ ] Test with SQL injection attempts

## Documentation

- [x] Implementation documentation created
- [x] API reference created
- [ ] Update main README.md
- [ ] Create Postman collection
- [ ] Add examples to documentation
- [ ] Document common issues and solutions

## Backup & Recovery

- [ ] Database backup before deployment
- [ ] Test data recovery procedure
- [ ] Document rollback steps
- [ ] Verify audit logs are immutable

## Monitoring Setup

### Alerts
- [ ] Set up alert for cron job failures
- [ ] Set up alert for SMS delivery failures
- [ ] Set up alert for GST verification failures
- [ ] Set up alert for high error rates

### Dashboards
- [ ] Create dashboard for E-way bill metrics
- [ ] Track expiry alert success rate
- [ ] Monitor Part-B update frequency
- [ ] Track API usage by endpoint

## Final Checks

- [ ] All environment variables documented
- [ ] All API endpoints tested
- [ ] Error handling verified
- [ ] Logging is comprehensive
- [ ] Performance is acceptable
- [ ] Security measures in place
- [ ] Documentation is complete
- [ ] Team has been trained

## Go-Live

- [ ] Notify stakeholders of deployment
- [ ] Monitor logs actively for first 24 hours
- [ ] Have rollback plan ready
- [ ] Document any issues encountered
- [ ] Collect user feedback

## Sign-Off

- [ ] Development Team Lead
- [ ] QA Team Lead
- [ ] DevOps Team
- [ ] Product Owner
- [ ] Technical Architect

---

**Date:** _________________  
**Deployed By:** _________________  
**Version:** 1.0.0
