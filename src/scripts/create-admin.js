import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.model.js';
import Staff from '../models/staff.model.js';

dotenv.config();

const parseArgs = (argv) => {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
};

const requireArg = (args, key) => {
  const value = args[key];
  if (!value || value === true) {
    throw new Error(`Missing required argument: --${key}`);
  }
  return value;
};

const getPositional = (argv) => {
  return argv.filter((t) => typeof t === 'string' && t.length > 0 && !t.startsWith('--'));
};

const main = async () => {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const positional = getPositional(argv);

  const email = args.email && args.email !== true ? args.email : positional[0];
  const password = args.password && args.password !== true ? args.password : positional[1];
  const name = args.name && args.name !== true ? args.name : positional[2];

  if (!email) throw new Error('Missing email. Use --email <value> (or positional arg #1).');
  if (!password) throw new Error('Missing password. Use --password <value> (or positional arg #2).');
  if (!name) throw new Error('Missing name. Use --name <value> (or positional arg #3).');

  const role = args.role || positional[3] || 'super-admin';
  const phone = args.phone || positional[4] || '+910000000000';
  const department = args.department || positional[5] || 'ops';
  const title = args.title || positional[6] || 'Administrator';

  if (!['staff', 'internal', 'super-admin'].includes(role)) {
    throw new Error("--role must be one of: staff | internal | super-admin");
  }

  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cloudtruck';
  await mongoose.connect(mongoURI);

  const existing = await User.findOne({ email, isDeleted: false }).lean();
  if (existing) {
    throw new Error(`User already exists with email: ${email}`);
  }

  const user = await User.create({
    phone,
    email,
    password,
    role,
    status: 'active'
  });

  await Staff.create({
    user: user._id,
    name,
    department,
    title,
    isActive: true,
    createdBy: user._id
  });

  // Print minimal output for copy/paste
  // Note: password is never printed.
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    ok: true,
    userId: user._id.toString(),
    email: user.email,
    role: user.role
  }, null, 2));

  await mongoose.disconnect();
};

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
