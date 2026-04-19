import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Family, Student, Class, Subject } from './src/Model/model.js';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shining-star';

async function setupFreshDatabase() {
  try {
    console.log('🚀 Setting up fresh database...\n');

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Create Admin User
    console.log('👤 Creating Admin user...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await User.create({
      phoneNumber: '9841234567',
      email: 'admin@shiningstar.com',
      password: adminPassword,
      role: 'Admin',
      isActive: true,
    });
    console.log('✅ Admin created (Phone: 9841234567, Password: admin123)\n');

    // 2. Create Sample Subjects
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

    // 3. Create Sample Class
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

    // 4. Create Sample Family with Parent User
    console.log('👨‍👩‍👧 Creating sample family...');
    const sampleFamily = await Family.create({
      familyId: 'FAM0001',
      primaryContact: {
        name: 'Ram Bahadur Sharma',
        relation: 'Father',
        mobile: '9851234567',
        email: 'ram.sharma@example.com',
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
    const parentPassword = await bcrypt.hash('9851234567', 10); // Phone as default password
    const parentUser = await User.create({
      phoneNumber: '9851234567',
      email: 'ram.sharma@example.com',
      password: parentPassword,
      role: 'Parent',
      profile: sampleFamily._id,
      profileModel: 'Family',
      isActive: true,
    });

    // Link user to family
    sampleFamily.user = parentUser._id;
    await sampleFamily.save();
    console.log('✅ Parent user created (Phone: 9851234567, Password: 9851234567)\n');

    // 5. Create Sample Students
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

    // 6. Create Another Family (Single Child)
    console.log('👨‍👧 Creating another family...');
    const family2 = await Family.create({
      familyId: 'FAM0002',
      primaryContact: {
        name: 'Krishna Thapa',
        relation: 'Father',
        mobile: '9801234567',
        email: 'krishna.thapa@example.com',
      },
      secondaryContact: {
        name: 'Gita Thapa',
        relation: 'Mother',
        mobile: '9807654321',
      },
      address: 'Lalitpur, Nepal',
      status: 'Active',
    });

    const parent2Password = await bcrypt.hash('9801234567', 10);
    const parentUser2 = await User.create({
      phoneNumber: '9801234567',
      email: 'krishna.thapa@example.com',
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
    console.log('   👤 1 Admin user');
    console.log('   👥 2 Parent users');
    console.log('   👨‍👩‍👧‍👦 2 Families');
    console.log('   👦 3 Students');
    console.log('   🏫 1 Class');
    console.log('   📚 3 Subjects\n');
    console.log('🔐 Login Credentials:\n');
    console.log('   Admin:');
    console.log('   - Phone/Email: 9841234567 or admin@shiningstar.com');
    console.log('   - Password: admin123\n');
    console.log('   Parent 1 (Sharma Family):');
    console.log('   - Phone: 9851234567');
    console.log('   - Password: 9851234567');
    console.log('   - Children: Rahul & Priya Sharma\n');
    console.log('   Parent 2 (Thapa Family):');
    console.log('   - Phone: 9801234567');
    console.log('   - Password: 9801234567');
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
