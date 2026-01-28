import { expect } from 'chai';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { startTestDB, stopTestDB, app } from './setup.js';
import User from '../src/models/user.model.js';
import Booking from '../src/models/booking.model.js';
import Driver from '../src/models/driver.model.js';
import trackingSocketHandler from '../src/sockets/tracking.socket.js';

describe('Tracking WebSocket Server', function() {
  let httpServer;
  let io;
  let driverUser;
  let driverToken;
  let booking;
  let clientSocket;
  let port;

  before(async function() {
    await startTestDB();
    
    // Create driver user
    driverUser = await User.create({
      phone: '+15550001111',
      role: 'driver',
      status: 'active'
    });
    driverToken = driverUser.generateAccessToken();

    // Create a driver profile
    const driverRecord = await Driver.create({
      user: driverUser._id,
      name: 'Test Driver',
      phone: driverUser.phone,
      licenseNumber: 'DL1234567890',
      isVerified: true
    });

    // Create a booking
    booking = await Booking.create({
      bookingId: 'BK-SOCKET-1',
      customer: new User()._id,
      driver: driverRecord._id,
      status: 'in-transit',
      pickup: { address: 'Origin', location: { type: 'Point', coordinates: [0, 0] } },
      drop: { address: 'Dest', location: { type: 'Point', coordinates: [0, 0] } },
      materialType: 'general-cargo',
      weight: { value: 10, unit: 'tons' },
      truckTypeNeeded: 'Taurus',
      bodyType: 'open',
      loadDate: new Date(),
      loadTime: '10:00 AM',
      advanceRequired: 0
    });

    // Start server
    httpServer = http.createServer(app);
    io = new Server(httpServer);
    const trackingNamespace = io.of('/tracking');
    trackingSocketHandler(trackingNamespace);
    
    await new Promise((resolve) => {
      httpServer.listen(() => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  after(async function() {
    if (clientSocket) clientSocket.close();
    if (io) io.close();
    if (httpServer) httpServer.close();
    await stopTestDB();
  });

  it('should authenticate and connect to /tracking', function(done) {
    clientSocket = new Client(`http://localhost:${port}/tracking`, {
      auth: { token: driverToken }
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).to.be.true;
      done();
    });

    clientSocket.on('connect_error', (err) => {
      done(err);
    });
  });

  it('should allow driver to join booking room', function(done) {
    Driver.findOne({ user: driverUser._id }).then(driver => {
      clientSocket.emit('driver:join', {
        driverId: driver._id.toString(),
        bookingId: booking._id.toString()
      });
    });

    clientSocket.on('driver:joined', (res) => {
      expect(res.bookingId).to.equal(booking._id.toString());
      done();
    });

    clientSocket.on('location:error', (err) => {
      done(new Error(err.message));
    });
  });

  it('should accept location update and broadcast it', function(done) {
    const locationData = {
      bookingId: booking._id.toString(),
      latitude: 12.34,
      longitude: 56.78,
      accuracy: 10,
      speed: 40,
      heading: 90
    };

    clientSocket.emit('location:update', locationData);

    clientSocket.on('location:acknowledged', (res) => {
      expect(res.success).to.be.true;
      expect(res.timestamp).to.exist;
      done();
    });

    clientSocket.on('location:error', (err) => {
      done(new Error(err.message));
    });
  });
});
