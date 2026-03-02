import { expect } from 'chai';
import http from 'http';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { startTestDB, stopTestDB, app } from './setup.js';
import User from '../src/models/user.model.js';
import Booking from '../src/models/booking.model.js';
import Driver from '../src/models/driver.model.js';
import trackingSocketHandler from '../src/sockets/tracking.socket.js';

describe('Tracking WebSocket Server', function () {
  let httpServer;
  let io;
  let driverUser;
  let driverToken;
  let customerUser;
  let customerToken;
  let booking;
  let clientSocket;
  let port;

  before(async function () {
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

    // Create a customer user (booking owner)
    customerUser = await User.create({
      phone: '+15550002222',
      role: 'customer',
      status: 'active'
    });
    customerToken = customerUser.generateAccessToken();

    // Create a booking — customer owns it, driver is assigned
    booking = await Booking.create({
      bookingId: 'BK-SOCKET-1',
      customer: customerUser._id,
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

    // Initialize default client socket
    clientSocket = new Client(`http://localhost:${port}/tracking`, {
      auth: { token: driverToken }
    });
    await new Promise((resolve) => clientSocket.once('connect', resolve));
  });

  after(async function () {
    if (clientSocket) clientSocket.close();
    if (io) io.close();
    if (httpServer) httpServer.close();
    await stopTestDB();
  });

  it('should authenticate and connect to /tracking', function (done) {
    expect(clientSocket.connected).to.be.true;
    done();
  });

  it('should allow driver to join booking room', function (done) {
    Driver.findOne({ user: driverUser._id }).then(driver => {
      clientSocket.emit('driver:join', {
        driverId: driver._id.toString(),
        bookingId: booking._id.toString()
      });
    });

    clientSocket.once('driver:joined', (res) => {
      expect(res.bookingId).to.equal(booking._id.toString());
      done();
    });

    clientSocket.once('location:error', (err) => {
      done(new Error(err.message));
    });
  });

  it('should accept location update and broadcast it', function (done) {
    const locationData = {
      bookingId: booking._id.toString(),
      latitude: 12.34,
      longitude: 56.78,
      accuracy: 10,
      speed: 40,
      heading: 90
    };

    clientSocket.emit('location:update', locationData);

    clientSocket.once('location:acknowledged', (res) => {
      expect(res.success).to.be.true;
      expect(res.timestamp).to.exist;
      done();
    });

    clientSocket.once('location:error', (err) => {
      done(new Error(err.message));
    });
  });

  // --- Bug 3: Accuracy filter ---
  it('should silently discard location update with accuracy > 100m', function (done) {
    const poorAccuracyData = {
      bookingId: booking._id.toString(),
      latitude: 12.34,
      longitude: 56.78,
      accuracy: 150,   // poor GPS — exceeds 100m threshold
      speed: 20,
      heading: 90
    };

    clientSocket.emit('location:update', poorAccuracyData);

    clientSocket.once('location:acknowledged', (res) => {
      expect(res.success).to.be.true;
      expect(res.filtered).to.be.true;
      done();
    });

    clientSocket.once('location:error', (err) => {
      done(new Error(`Should not error, but got: ${err.message}`));
    });
  });

  // --- Bug 2: Watcher authorization (unauthorized user) ---
  it('should reject watcher:join for a user unrelated to the booking', function (done) {
    // Create a completely unrelated user
    User.create({ phone: '+15550003333', role: 'customer', status: 'active' }).then(strangerUser => {
      const strangerToken = strangerUser.generateAccessToken();
      const strangerSocket = new Client(`http://localhost:${port}/tracking`, {
        auth: { token: strangerToken }
      });

      strangerSocket.once('connect', () => {
        strangerSocket.emit('watcher:join', {
          userId: strangerUser._id.toString(),
          bookingId: booking._id.toString(),
          role: 'customer'
        });
      });

      strangerSocket.once('location:error', (err) => {
        expect(err.message).to.include('Unauthorized');
        strangerSocket.close();
        done();
      });

      strangerSocket.once('watcher:joined', () => {
        strangerSocket.close();
        done(new Error('Should have been rejected but was accepted'));
      });

      strangerSocket.once('connect_error', (err) => {
        strangerSocket.close();
        done(err);
      });
    });
  });

  // --- Bug 2: Watcher authorization (booking's own customer) ---
  it('should allow watcher:join for the booking\'s own customer', function (done) {
    const customerSocket = new Client(`http://localhost:${port}/tracking`, {
      auth: { token: customerToken }
    });

    customerSocket.once('connect', () => {
      customerSocket.emit('watcher:join', {
        userId: customerUser._id.toString(),
        bookingId: booking._id.toString(),
        role: 'customer'
      });
    });

    customerSocket.once('watcher:joined', (res) => {
      expect(res.bookingId).to.equal(booking._id.toString());
      customerSocket.close();
      done();
    });

    customerSocket.once('location:error', (err) => {
      customerSocket.close();
      done(new Error(`Should have been accepted but got: ${err.message}`));
    });

    customerSocket.once('connect_error', (err) => {
      customerSocket.close();
      done(err);
    });
  });

  // --- Feature 1: Heartbeat / Driver Online Status ---
  it('should broadcast driver:status when driver joins and leaves', function (done) {
    this.timeout(15000);
    let finished = false;
    const safeDone = (err) => { if (!finished) { finished = true; done(err); } };

    const watcherSocket = new Client(`http://localhost:${port}/tracking`, {
      auth: { token: customerToken }
    });

    watcherSocket.once('connect', () => {
      watcherSocket.once('watcher:joined', () => {
        const anotherDriverSocket = new Client(`http://localhost:${port}/tracking`, {
          auth: { token: driverToken }
        });

        anotherDriverSocket.once('connect', () => {
          watcherSocket.once('driver:status', (status) => {
            try {
              expect(status.isOnline).to.be.true;
              expect(status.driverId).to.equal(booking.driver.toString());

              anotherDriverSocket.emit('driver:leave', {
                driverId: booking.driver.toString(),
                bookingId: booking._id.toString()
              });

              watcherSocket.once('driver:status', (status2) => {
                try {
                  expect(status2.isOnline).to.be.false;
                  anotherDriverSocket.close();
                  watcherSocket.close();
                  safeDone();
                } catch (e) { safeDone(e); }
              });
            } catch (e) { safeDone(e); }
          });

          anotherDriverSocket.emit('driver:join', {
            driverId: booking.driver.toString(),
            bookingId: booking._id.toString()
          });
        });

        anotherDriverSocket.once('connect_error', (err) => {
          anotherDriverSocket.close();
          watcherSocket.close();
          safeDone(err);
        });
      });

      watcherSocket.emit('watcher:join', {
        userId: customerUser._id.toString(),
        bookingId: booking._id.toString(),
        role: 'customer'
      });
    });

    watcherSocket.once('connect_error', (err) => {
      watcherSocket.close();
      safeDone(err);
    });
  });

  // --- Feature 2: Reconnection Logic ---
  it('should auto-emit last location when a watcher joins', function (done) {
    this.timeout(30000);
    let finished = false;
    const safeDone = (err) => { if (!finished) { finished = true; done(err); } };

    const locationData = {
      bookingId: booking._id.toString(),
      latitude: 22.22,
      longitude: 33.33,
      accuracy: 10
    };

    // Re-join the driver to ensure the socket is in a known good state before
    // emitting the location update (makes the test self-contained).
    Driver.findOne({ user: driverUser._id }).then(driver => {
      clientSocket.emit('driver:join', {
        driverId: driver._id.toString(),
        bookingId: booking._id.toString()
      });
    });

    clientSocket.once('driver:joined', () => {
      clientSocket.emit('location:update', locationData);

      clientSocket.once('location:acknowledged', () => {
        const newWatcherSocket = new Client(`http://localhost:${port}/tracking`, {
          auth: { token: customerToken }
        });

        newWatcherSocket.once('connect', () => {
          newWatcherSocket.once('location:response', (res) => {
            try {
              expect(res.success).to.be.true;
              expect(res.data.lastLocation.latitude).to.equal(22.22);
              expect(res.data.lastLocation.longitude).to.equal(33.33);
              newWatcherSocket.close();
              safeDone();
            } catch (e) { safeDone(e); }
          });

          newWatcherSocket.emit('watcher:join', {
            userId: customerUser._id.toString(),
            bookingId: booking._id.toString(),
            role: 'customer'
          });
        });

        newWatcherSocket.once('connect_error', (err) => {
          newWatcherSocket.close();
          safeDone(err);
        });
      });

      clientSocket.once('location:error', (err) => {
        safeDone(new Error(`Location update failed: ${err.message}`));
      });
    });
  });
});

