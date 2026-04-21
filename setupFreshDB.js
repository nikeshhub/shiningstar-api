import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Family, Student, Class, Subject } from './src/Model/model.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/shining-star';

const getRequiredEnv = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const seedCredentials = {
  superAdmin: {
    phoneNumber: getRequiredEnv('SEED_SUPERADMIN_PHONE'),
    email: getRequiredEnv('SEED_SUPERADMIN_EMAIL'),
    password: getRequiredEnv('SEED_SUPERADMIN_PASSWORD'),
  },
  admin: {
    phoneNumber: getRequiredEnv('SEED_ADMIN_PHONE'),
    email: getRequiredEnv('SEED_ADMIN_EMAIL'),
    password: getRequiredEnv('SEED_ADMIN_PASSWORD'),
  },
  parent1: {
    phoneNumber: getRequiredEnv('SEED_PARENT1_PHONE'),
    email: getRequiredEnv('SEED_PARENT1_EMAIL'),
    password: getRequiredEnv('SEED_PARENT1_PASSWORD'),
  },
  parent2: {
    phoneNumber: getRequiredEnv('SEED_PARENT2_PHONE'),
    email: getRequiredEnv('SEED_PARENT2_EMAIL'),
    password: getRequiredEnv('SEED_PARENT2_PASSWORD'),
  },
};

async function setupFreshDatabase() {
  try {
    console.log('🚀 Setting up fresh database...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Create SuperAdmin user
    console.log('👤 Creating SuperAdmin user...');
    const superAdminPassword = await bcrypt.hash(seedCredentials.superAdmin.password, 10);
    await User.create({
      phoneNumber: seedCredentials.superAdmin.phoneNumber,
      email: seedCredentials.superAdmin.email,
      password: superAdminPassword,
      role: 'SuperAdmin',
      isActive: true,
    });
    console.log(`✅ SuperAdmin created (Phone: ${seedCredentials.superAdmin.phoneNumber}, Email: ${seedCredentials.superAdmin.email}, Password: loaded from env)\n`);

    // 2. Create Admin user
    console.log('👤 Creating Admin user...');
    const adminPassword = await bcrypt.hash(seedCredentials.admin.password, 10);
    await User.create({
      phoneNumber: seedCredentials.admin.phoneNumber,
      email: seedCredentials.admin.email,
      password: adminPassword,
      role: 'Admin',
      isActive: true,
    });
    console.log(`✅ Admin created (Phone: ${seedCredentials.admin.phoneNumber}, Email: ${seedCredentials.admin.email}, Password: loaded from env)\n`);

    // 3. Create Sample Subjects
    console.log('📚 Creating sample subjects...');
    const mathSubject = await Subject.create({
      subjectId: 'SUB001',
      subjectName: 'Mathematics',
      description: 'Core mathematics subject',
      status: 'Active',
    });

    const englishSubject = await Subject.create({
      subjectId: 'SUB002',
      subjectName: 'English',
      description: 'English language and literature',
      status: 'Active',
    });

    const scienceSubject = await Subject.create({
      subjectId: 'SUB003',
      subjectName: 'Science',
      description: 'General science',
      status: 'Active',
    });
    console.log('✅ Subjects created\n');

    // 4. Create Sample Class
    console.log('🏫 Creating sample class...');
    const sampleClass = await Class.create({
      className: 'Class 5',
      section: 'A',
      academicYear: '2081-2082',
      capacity: 40,
      subjects: [
        { subject: mathSubject._id },
        { subject: englishSubject._id },
        { subject: scienceSubject._id },
      ],
      status: 'Active',
    });
    console.log('✅ Class 5-A created\n');

    // 5. Create Sample Family with Parent User
    console.log('👨‍👩‍👧 Creating sample family...');
    const sampleFamily = await Family.create({
      familyId: 'FAM0001',
      primaryContact: {
        name: 'Ram Bahadur Sharma',
        relation: 'Father',
        mobile: seedCredentials.parent1.phoneNumber,
        email: seedCredentials.parent1.email,
      },
      secondaryContact: {
        name: 'Sita Sharma',
        relation: 'Mother',
        mobile: '9857654321',
      },
      address: 'Kathmandu, Nepal',
      status: 'Active',
    });
    console.log('✅ Family created (ID: FAM0001)\n');

    // Create Parent User for the family
    console.log('👤 Creating parent user account...');
    const parentPassword = await bcrypt.hash(seedCredentials.parent1.password, 10);
    const parentUser = await User.create({
      phoneNumber: seedCredentials.parent1.phoneNumber,
      email: seedCredentials.parent1.email,
      password: parentPassword,
      role: 'Parent',
      profile: sampleFamily._id,
      profileModel: 'Family',
      isActive: true,
    });

    // Link user to family
    sampleFamily.user = parentUser._id;
    await sampleFamily.save();
    console.log(`✅ Parent user created (Phone: ${seedCredentials.parent1.phoneNumber}, Email: ${seedCredentials.parent1.email}, Password: loaded from env)\n`);

    // 6. Create Sample Students
    console.log('👦 Creating sample students...');
    const student1 = await Student.create({
      studentId: 'STU00001',
      name: 'Rahul Sharma',
      dateOfBirth: '2013-05-15',
      gender: 'Male',
      family: sampleFamily._id,
      currentClass: sampleClass._id,
      rollNumber: 1,
      admissionDate: '2020-04-01',
      academicYear: '2081-2082',
      status: 'Active',
    });

    const student2 = await Student.create({
      studentId: 'STU00002',
      name: 'Priya Sharma',
      dateOfBirth: '2015-08-20',
      gender: 'Female',
      family: sampleFamily._id,
      currentClass: sampleClass._id,
      rollNumber: 2,
      admissionDate: '2022-04-01',
      academicYear: '2081-2082',
      status: 'Active',
    });
    console.log('✅ 2 students created (siblings in same family)\n');

    // 7. Create Another Family (Single Child)
    console.log('👨‍👧 Creating another family...');
    const family2 = await Family.create({
      familyId: 'FAM0002',
      primaryContact: {
        name: 'Krishna Thapa',
        relation: 'Father',
        mobile: seedCredentials.parent2.phoneNumber,
        email: seedCredentials.parent2.email,
      },
      secondaryContact: {
        name: 'Gita Thapa',
        relation: 'Mother',
        mobile: '9807654321',
      },
      address: 'Lalitpur, Nepal',
      status: 'Active',
    });

    const parent2Password = await bcrypt.hash(seedCredentials.parent2.password, 10);
    const parentUser2 = await User.create({
      phoneNumber: seedCredentials.parent2.phoneNumber,
      email: seedCredentials.parent2.email,
      password: parent2Password,
      role: 'Parent',
      profile: family2._id,
      profileModel: 'Family',
      isActive: true,
    });

    family2.user = parentUser2._id;
    await family2.save();

    const student3 = await Student.create({
      studentId: 'STU00003',
      name: 'Anjali Thapa',
      dateOfBirth: '2014-03-10',
      gender: 'Female',
      family: family2._id,
      currentClass: sampleClass._id,
      rollNumber: 3,
      admissionDate: '2021-04-01',
      academicYear: '2081-2082',
      status: 'Active',
    });
    console.log('✅ Second family created with 1 student\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Database setup completed successfully!\n');
    console.log('📋 Summary:');
    console.log('   👤 1 SuperAdmin user');
    console.log('   👤 1 Admin user');
    console.log('   👥 2 Parent users');
    console.log('   👨‍👩‍👧‍👦 2 Families');
    console.log('   👦 3 Students');
    console.log('   🏫 1 Class');
    console.log('   📚 3 Subjects\n');
    console.log('🔐 Login Credentials:\n');
    console.log('   SuperAdmin:');
    console.log(`   - Phone/Email: ${seedCredentials.superAdmin.phoneNumber} or ${seedCredentials.superAdmin.email}`);
    console.log('   - Password: loaded from env\n');
    console.log('   Admin:');
    console.log(`   - Phone/Email: ${seedCredentials.admin.phoneNumber} or ${seedCredentials.admin.email}`);
    console.log('   - Password: loaded from env\n');
    console.log('   Parent 1 (Sharma Family):');
    console.log(`   - Phone/Email: ${seedCredentials.parent1.phoneNumber} or ${seedCredentials.parent1.email}`);
    console.log('   - Password: loaded from env');
    console.log('   - Children: Rahul & Priya Sharma\n');
    console.log('   Parent 2 (Thapa Family):');
    console.log(`   - Phone/Email: ${seedCredentials.parent2.phoneNumber} or ${seedCredentials.parent2.email}`);
    console.log('   - Password: loaded from env');
    console.log('   - Children: Anjali Thapa\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

setupFreshDatabase();
