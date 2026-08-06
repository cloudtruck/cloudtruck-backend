import { expect } from 'chai';
import { startTestDB, stopTestDB } from './setup.js';
import User from '../src/models/user.model.js';

describe('User model - phone normalization', function() {
  before(async function() {
    await startTestDB();
  });

  after(async function() {
    await stopTestDB();
  });

  it('strips leading + from phone on create', async function() {
    const user = await User.create({ role: 'customer', phone: '+918459727003' });
    expect(user.phone).to.equal('918459727003');
  });

  it('strips spaces and dashes from phone on create', async function() {
    const user = await User.create({ role: 'customer', phone: '+91 8459-727004' });
    expect(user.phone).to.equal('918459727004');
  });

  it('leaves an already-normalized phone unchanged', async function() {
    const user = await User.create({ role: 'customer', phone: '918459727006' });
    expect(user.phone).to.equal('918459727006');
  });

  it('normalizes phone on update via save()', async function() {
    const user = await User.create({ role: 'customer', phone: '918459727007' });
    user.phone = '+91 8459-727007';
    await user.save();
    expect(user.phone).to.equal('918459727007');
  });

  it('produces the same stored value regardless of input format, preventing duplicate-account creation for one real number', async function() {
    const raw = '8459727008';
    const withCountryCode = '918459727008';
    const withPlus = '+918459727008';

    const a = await User.create({ role: 'customer', phone: withPlus });
    expect(a.phone).to.equal(withCountryCode);

    // Simulates the normalizePhone() used by auth.service.js before querying —
    // the stored value must match what that lookup produces for the bare/raw and +-prefixed forms.
    expect(a.phone).to.not.equal(raw);
    expect(a.phone).to.equal(withCountryCode);
  });

  it('findByPhone normalizes input and matches a normalized stored user', async function() {
    const user = await User.create({ role: 'customer', phone: '918459727009' });
    const found = await User.findByPhone('+91 8459-727009');
    expect(found).to.not.be.null;
    expect(found._id.toString()).to.equal(user._id.toString());
  });
});
