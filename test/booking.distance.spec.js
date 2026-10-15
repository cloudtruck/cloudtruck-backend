import { expect } from 'chai';
import sinon from 'sinon';
import Booking from '../src/models/booking.model.js';
import LocationService from '../src/services/location.service.js';

const makeBooking = () =>
  new Booking({
    pickup: { location: { type: 'Point', coordinates: [72.8777, 19.076] } }, // Mumbai
    drop: { location: { type: 'Point', coordinates: [72.8311, 21.1702] } }, // Surat
  });

describe('Booking.calculateDistance', function () {
  afterEach(() => sinon.restore());

  it('uses Google road distance when routing succeeds', async function () {
    sinon.stub(LocationService, 'calculateRoute').resolves({ distance: { value: 284.46 } });
    const km = await makeBooking().calculateDistance();
    expect(km).to.equal(284.5);
  });

  it('falls back to straight-line distance scaled for roads when routing is unavailable', async function () {
    sinon.stub(LocationService, 'calculateRoute').resolves(null);
    const km = await makeBooking().calculateDistance();
    expect(km).to.be.within(285, 295); // ~233 km straight-line x 1.25
  });

  it('returns 0 when coordinates are missing', async function () {
    const km = await new Booking({}).calculateDistance();
    expect(km).to.equal(0);
  });
});
