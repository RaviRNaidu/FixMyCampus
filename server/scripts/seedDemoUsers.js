import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

const accounts = [
  { role: 'admin', email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD, name: 'Campus Admin' },
  { role: 'staff', email: process.env.SEED_STAFF_EMAIL, password: process.env.SEED_STAFF_PASSWORD, name: 'Campus Staff' },
];

if (!process.env.MONGODB_URI || accounts.some(account => !account.email || !account.password)) {
  console.error('Configure MONGODB_URI and SEED_ADMIN_/SEED_STAFF_ credentials in server/.env first.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const existingAccounts = await Promise.all(accounts.map(account => User.findOne({ email: account.email.toLowerCase() }).select('role')));
  const conflict = existingAccounts.findIndex((existing, index) => existing && existing.role !== accounts[index].role);
  if (conflict !== -1) {
    throw new Error(`The configured ${accounts[conflict].role} email already belongs to a ${existingAccounts[conflict].role} account. No accounts were changed.`);
  }

  for (const [index, account] of accounts.entries()) {
    if (existingAccounts[index]) {
      console.log(`Existing ${account.role} account left unchanged.`);
      continue;
    }
    await User.create({
      name: account.name,
      email: account.email.toLowerCase(),
      passwordHash: await bcrypt.hash(account.password, 12),
      role: account.role,
      isActive: true,
    });
    console.log(`Created ${account.role} account.`);
  }
} finally {
  await mongoose.disconnect();
}
