import { expect } from 'chai';
import sinon from 'sinon';
import { startTestDB, stopTestDB } from './setup.js';
import TrackingService from '../src/services/tracking.service.js';
import Booking from '../src/models/booking.model.js';
import User from '../src/models/user.model.js';
import Driver from '../src/models/driver.model.js';
import Customer from '../src/models/customer.model.js';
import NotificationService from '../src/services/notification.service.js';

describe('TrackingService - Geofence Alerts', function () {
    let customerUser;
    let customerRecord;
    let driverUser;
    let driverRecord;
    let booking;
    let sendNotificationStub;

    before(async function () {
        await startTestDB();

        // Setup users
        customerUser = await User.create({ phone: '+15551111', role: 'customer', status: 'active' });
        customerRecord = await Customer.create({ user: customerUser._id, name: 'Test Customer', companyName: 'Varlyq' });

        driverUser = await User.create({ phone: '+15552222', role: 'driver', status: 'active' });
        driverRecord = await Driver.create({ user: driverUser._id, name: 'Test Driver', licenseNumber: 'D123' });

        // Mock NotificationService
        sendNotificationStub = sinon.stub(NotificationService, 'sendNotification').resolves();
    });

    after(async function () {
        if (sendNotificationStub) sendNotificationStub.restore();
        await stopTestDB();
    });

    beforeEach(async function () {
        sendNotificationStub.resetHistory();

        // Create a booking with geofence points
        // Center: [0, 0]
        booking = await Booking.create({
            bookingId: `BK-GEO-${Date.now()}`,
            customer: customerRecord._id,
            driver: driverRecord._id,
            status: 'in-transit',
            pickup: {
                address: 'Pickup',
                location: { type: 'Point', coordinates: [0, 0] }
            },
            drop: {
                address: 'Drop',
                location: { type: 'Point', coordinates: [0.1, 0.1] }
            },
            materialType: 'other',
            weight: { value: 1, unit: 'tons' },
            loadDate: new Date(),
            loadTime: '10:00 AM',
            truckTypeNeeded: 'Open Body',
            bodyType: 'open',
            advanceRequired: 0
        });
    });

    it('should fire notification when driver enters 500m pickup geofence', async function () {
        // 0.001 degrees is roughly 110 meters. 0.004 is roughly 440 meters.
        const nearPickup = { latitude: 0.003, longitude: 0.003, accuracy: 10 };

        await TrackingService.recordLocation(booking._id.toString(), driverRecord._id.toString(), nearPickup);

        expect(sendNotificationStub.calledOnce).to.be.true;
        const args = sendNotificationStub.firstCall.args[0];
        expect(args.type).to.equal('geofence_pickup');

        // Verify booking state updated
        const updatedBooking = await Booking.findById(booking._id);
        expect(updatedBooking.geofenceAlerts.pickup).to.be.true;
        expect(updatedBooking.geofenceAlerts.pickupAt).to.exist;
    });

    it('should NOT fire notification twice for the same geofence', async function () {
        const nearPickup = { latitude: 0.002, longitude: 0.002, accuracy: 10 };

        // First record
        await TrackingService.recordLocation(booking._id.toString(), driverRecord._id.toString(), nearPickup);
        expect(sendNotificationStub.calledOnce).to.be.true;

        // Second record (even closer)
        await TrackingService.recordLocation(booking._id.toString(), driverRecord._id.toString(), { ...nearPickup, latitude: 0.001 });
        expect(sendNotificationStub.calledOnce).to.be.true; // Still only Once
    });

    it('should NOT fire notification if driver is outside 500m radius', async function () {
        // 0.01 degrees is roughly 1.1km
        const farAway = { latitude: 0.01, longitude: 0.01, accuracy: 10 };

        await TrackingService.recordLocation(booking._id.toString(), driverRecord._id.toString(), farAway);

        expect(sendNotificationStub.called).to.be.false;

        const updatedBooking = await Booking.findById(booking._id);
        expect(updatedBooking.geofenceAlerts.pickup).to.be.false;
    });

    it('should fire drop geofence alert when arriving at destination', async function () {
        // Drop point is [0.1, 0.1]. 
        const nearDrop = { latitude: 0.101, longitude: 0.101, accuracy: 10 };

        await TrackingService.recordLocation(booking._id.toString(), driverRecord._id.toString(), nearDrop);

        expect(sendNotificationStub.calledOnce).to.be.true;
        const args = sendNotificationStub.firstCall.args[0];
        expect(args.type).to.equal('geofence_drop');
    });
});
