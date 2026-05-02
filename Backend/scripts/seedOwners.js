// Backend/scripts/seedOwners.js
//
// Seeds owner (landlord) accounts into the database.
// Run with: node scripts/seedOwners.js
//
// Behavior:
//   - Idempotent: running twice does NOT create duplicates.
//   - Reads owner list from owners.json (gitignored, see owners.example.json).
//   - Hashes passwords with bcrypt before inserting.
//   - Skips owners that already exist (by email).
//   - Updates password if the --reset flag is passed (use with caution).

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const OWNERS_FILE = path.join(__dirname, 'owners.json');
const RESET_FLAG = process.argv.includes('--reset');

const seedOwners = async () => {
  // Verify owners.json exists
  if (!fs.existsSync(OWNERS_FILE)) {
    console.error(`❌ Missing file: ${OWNERS_FILE}`);
    console.error('   Copy scripts/owners.example.json to scripts/owners.json and edit it.');
    process.exit(1);
  }

  // Load owner data
  let owners;
  try {
    owners = JSON.parse(fs.readFileSync(OWNERS_FILE, 'utf8'));
  } catch (err) {
    console.error('❌ Could not parse owners.json:', err.message);
    process.exit(1);
  }

  if (!Array.isArray(owners) || owners.length === 0) {
    console.error('❌ owners.json must be a non-empty array.');
    process.exit(1);
  }

  // Connect to Mongo
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected.');

  let created = 0;
  let skipped = 0;
  let updated = 0;

for (const owner of owners) {
    if (!owner.email || !owner.password) {
      console.warn(`⚠️  Skipping malformed entry (missing email or password):`, owner);
      continue;
    }

    const email = owner.email.trim().toLowerCase();
    const existing = await User.findOne({ email });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(owner.password, salt);

    if (existing) {
      if (RESET_FLAG) {
        existing.password = hashedPassword;
        existing.role = 'owner';
        existing.name = (owner.name || existing.name || '').trim();
        existing.mustSetPassword = false;
        existing.inviteToken = null;
        existing.inviteTokenExpiry = null;
        await existing.save();
        console.log(`🔄 Updated owner: ${email}`);
        updated++;
      } else {
        console.log(`⏭️  Owner already exists, skipping: ${email}`);
        skipped++;
      }
      continue;
    }

    await User.create({
      email,
      password: hashedPassword,
      role: 'owner',
      name: (owner.name || '').trim(),
      mustSetPassword: false,
      inviteToken: null,
      inviteTokenExpiry: null
    });
    console.log(`✅ Created owner: ${email}`);
    created++;
  }

  console.log('\n--- Summary ---');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);

  await mongoose.connection.close();
  process.exit(0);
};

seedOwners().catch(async (err) => {
  console.error('❌ Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});