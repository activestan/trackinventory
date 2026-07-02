/**
 * One-time database seeding script. Run with: npm run seed
 * Creates a default Administrator account and a few sample categories
 * so the system can be logged into and explored immediately after setup.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');

async function seed() {
  await connectDB();

  const adminEmail = 'admin@example.com';
  const existingAdmin = await User.findOne({ email: adminEmail });

  if (!existingAdmin) {
    await User.create({
      full_name: 'System Administrator',
      email: adminEmail,
      password_hash: 'Admin@123', // hashed automatically by the User model
      role: 'Administrator',
      department: 'Management',
    });
    console.log(`Created default administrator account: ${adminEmail} / Admin@123`);
    console.log('IMPORTANT: Log in and change this password immediately.');
  } else {
    console.log('Administrator account already exists. Skipping.');
  }

  const defaultCategories = ['Networking Equipment', 'Computers & Laptops', 'Printers & MFPs', 'Consumables'];
  for (const name of defaultCategories) {
    const existing = await Category.findOne({ category_name: name });
    if (!existing) {
      await Category.create({ category_name: name, description: `${name} category` });
      console.log(`Created category: ${name}`);
    }
  }

  console.log('Seeding complete.');
  await mongoose.disconnect();
}

seed().catch((error) => {
  console.error('Seeding failed:', error);
  process.exit(1);
});
