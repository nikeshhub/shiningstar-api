import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Subject, Class } from './src/Model/model.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/shining_star';

const getRequiredEnv = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const seedUserConfigs = [
  {
    label: 'SuperAdmin',
    role: 'SuperAdmin',
    phoneNumber: getRequiredEnv('SEED_SUPERADMIN_PHONE'),
    email: getRequiredEnv('SEED_SUPERADMIN_EMAIL'),
    password: getRequiredEnv('SEED_SUPERADMIN_PASSWORD'),
  },
  {
    label: 'Admin',
    role: 'Admin',
    phoneNumber: getRequiredEnv('SEED_ADMIN_PHONE'),
    email: getRequiredEnv('SEED_ADMIN_EMAIL'),
    password: getRequiredEnv('SEED_ADMIN_PASSWORD'),
  },
];

// Nepal curriculum subjects with credit hours and marks distribution
// Major subjects: 50 written + 50 practical = 100 total
// Minor subjects: 25 written + 25 practical = 50 total
const subjects = [
  // Nursery subjects
  { subjectName: 'Nepali', subjectCode: 'NEP', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['Nursery', 'LKG_UKG', 'Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'English', subjectCode: 'ENG', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['Nursery', 'LKG_UKG', 'Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'Mathematics', subjectCode: 'MAT', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['Nursery', 'LKG_UKG', 'Class_1_2_3', 'Class_4_8'] },

  // Oral subjects (Minor - for Nursery)
  { subjectName: 'English Oral', subjectCode: 'ENG_ORAL', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['Nursery'] },
  { subjectName: 'Nepali Oral', subjectCode: 'NEP_ORAL', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['Nursery'] },
  { subjectName: 'Math Oral', subjectCode: 'MAT_ORAL', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['Nursery'] },
  { subjectName: 'Rhymes', subjectCode: 'RHY', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['Nursery', 'LKG_UKG'] },
  { subjectName: 'Conversation', subjectCode: 'CONV', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['Nursery', 'LKG_UKG'] },

  // LKG/UKG specific subjects
  { subjectName: 'English-I (Grammar)', subjectCode: 'ENG_GRAM', subjectType: 'Minor', creditHours: 2.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['LKG_UKG', 'Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'English-II', subjectCode: 'ENG_II', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['LKG_UKG'] },
  { subjectName: 'Integrated', subjectCode: 'INTEG', subjectType: 'Minor', creditHours: 3.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['LKG_UKG'] },
  { subjectName: 'Neatness', subjectCode: 'NEAT', subjectType: 'Minor', creditHours: 1.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['LKG_UKG'] },

  // Class 1-8 core subjects
  { subjectName: 'Science', subjectCode: 'SCI', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['LKG_UKG', 'Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'Social Studies', subjectCode: 'SOC', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['LKG_UKG', 'Class_4_8'] },
  { subjectName: 'Health & Physical Education', subjectCode: 'HEALTH', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['Class_4_8'] },

  // Special subjects
  { subjectName: 'Yangwarak', subjectCode: 'YANG', subjectType: 'Major', creditHours: 5.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'SEROPHERO', subjectCode: 'SERO', subjectType: 'Major', creditHours: 8.0, writtenMarks: 50, practicalMarks: 50, fullMarks: 100, passMarks: 32, isOptional: false, applicableCategories: ['Class_1_2_3'] },

  // Minor/Additional subjects
  { subjectName: 'Nepali Byakaran', subjectCode: 'NEP_BYA', subjectType: 'Minor', creditHours: 1.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: false, applicableCategories: ['Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'General Knowledge', subjectCode: 'GK', subjectType: 'Minor', creditHours: 2.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: true, applicableCategories: ['Class_1_2_3', 'Class_4_8'] },
  { subjectName: 'Optional Mathematics', subjectCode: 'OPT_MAT', subjectType: 'Minor', creditHours: 2.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: true, applicableCategories: ['Class_4_8'] },
  { subjectName: 'Computer', subjectCode: 'COM', subjectType: 'Minor', creditHours: 2.0, writtenMarks: 25, practicalMarks: 25, fullMarks: 50, passMarks: 16, isOptional: true, applicableCategories: ['Class_1_2_3', 'Class_4_8'] },
];

// Class names from Nursery to Class 8
const classNames = [
  'Nursery',
  'KG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
];

// Which subjects apply per class
const classSubjects = {
  'Nursery':  ['NEP', 'ENG', 'MAT', 'NEP_ORAL', 'ENG_ORAL', 'MAT_ORAL', 'RHY', 'CONV'],
  'KG':       ['NEP', 'ENG', 'MAT', 'ENG_GRAM', 'ENG_II', 'SCI', 'SOC', 'INTEG', 'CONV', 'RHY', 'NEAT'],
  'Class 1':  ['NEP', 'ENG', 'MAT', 'SCI', 'YANG', 'SERO', 'ENG_GRAM', 'GK', 'CONV', 'COM', 'NEP_BYA'],
  'Class 2':  ['NEP', 'ENG', 'MAT', 'SCI', 'YANG', 'SERO', 'ENG_GRAM', 'GK', 'CONV', 'COM', 'NEP_BYA'],
  'Class 3':  ['NEP', 'ENG', 'MAT', 'SCI', 'YANG', 'SERO', 'ENG_GRAM', 'GK', 'CONV', 'COM', 'NEP_BYA'],
  'Class 4':  ['NEP', 'ENG', 'MAT', 'SCI', 'SOC', 'HEALTH', 'YANG', 'ENG_GRAM', 'GK', 'OPT_MAT', 'COM', 'NEP_BYA'],
  'Class 5':  ['NEP', 'ENG', 'MAT', 'SCI', 'SOC', 'HEALTH', 'YANG', 'ENG_GRAM', 'GK', 'OPT_MAT', 'COM', 'NEP_BYA'],
  'Class 6':  ['NEP', 'ENG', 'MAT', 'SCI', 'SOC', 'HEALTH', 'YANG', 'ENG_GRAM', 'GK', 'OPT_MAT', 'COM', 'NEP_BYA'],
  'Class 7':  ['NEP', 'ENG', 'MAT', 'SCI', 'SOC', 'HEALTH', 'YANG', 'ENG_GRAM', 'GK', 'OPT_MAT', 'COM', 'NEP_BYA'],
  'Class 8':  ['NEP', 'ENG', 'MAT', 'SCI', 'SOC', 'HEALTH', 'YANG', 'ENG_GRAM', 'GK', 'OPT_MAT', 'COM', 'NEP_BYA'],
};

const seedUsers = async () => {
  try {
    for (const userConfig of seedUserConfigs) {
      const existingUser = await User.findOne({
        $or: [
          { phoneNumber: userConfig.phoneNumber },
          { email: userConfig.email },
        ],
      });

      if (existingUser) {
        console.log(`  ${userConfig.label} already exists — skipping.`);
        continue;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userConfig.password, salt);

      await User.create({
        phoneNumber: userConfig.phoneNumber,
        email: userConfig.email,
        password: hashedPassword,
        role: userConfig.role,
        isActive: true,
        permissions: [],
      });

      console.log(`  ${userConfig.label} created.`);
      console.log(`    Phone:    ${userConfig.phoneNumber}`);
      console.log(`    Email:    ${userConfig.email}`);
      console.log('    Password: loaded from env');
    }
  } catch (error) {
    console.error('  Failed to seed default users:', error);
    throw error;
  }
};

const buildSubjectMap = async () => {
  const allSubjects = await Subject.find({}, { subjectCode: 1 });
  const map = {};
  allSubjects.forEach(s => { map[s.subjectCode] = s._id; });
  return map;
};

const seedSubjects = async () => {
  try {
    const operations = subjects.map(subject => ({
      updateOne: {
        filter: { subjectCode: subject.subjectCode },
        update: { $setOnInsert: subject },
        upsert: true,
      }
    }));

    const result = await Subject.bulkWrite(operations, { ordered: false });
    const inserted = result.upsertedCount || 0;
    const skipped = subjects.length - inserted;
    console.log(`  ${inserted} subjects seeded, ${skipped} skipped.`);

    return await buildSubjectMap();
  } catch (error) {
    console.error('  Failed to seed subjects:', error);
    throw error;
  }
};

const seedClasses = async (subjectMap) => {
  try {
    // If subjects weren't just created, fetch them
    if (Object.keys(subjectMap).length === 0) {
      subjectMap = await buildSubjectMap();
    }

    const missingSubjectCodes = new Set();
    const classDocuments = classNames.map(name => {
      const codes = classSubjects[name] || [];
      const subjectsList = codes
        .filter(code => {
          const hasSubject = Boolean(subjectMap[code]);
          if (!hasSubject) {
            missingSubjectCodes.add(code);
          }
          return hasSubject;
        })
        .map(code => ({
          subject: subjectMap[code],
          book: {
            bookName: '',
            publication: '',
            cost: 0,
            coverPhoto: ''
          }
        }));

      return {
        className: name,
        capacity: 40,
        monthlyFee: 0,
        status: 'Active',
        subjects: subjectsList,
      };
    });

    if (missingSubjectCodes.size > 0) {
      console.warn(`  Warning: Missing subject codes for classes: ${Array.from(missingSubjectCodes).join(', ')}`);
    }

    const operations = classDocuments.map(classDoc => ({
      updateOne: {
        filter: { className: classDoc.className },
        update: { $setOnInsert: classDoc },
        upsert: true,
      }
    }));

    const result = await Class.bulkWrite(operations, { ordered: false });
    const inserted = result.upsertedCount || 0;
    const skipped = classDocuments.length - inserted;
    console.log(`  ${inserted} classes seeded, ${skipped} skipped.`);
  } catch (error) {
    console.error('  Failed to seed classes:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    console.log('Seeding users...');
    await seedUsers();

    console.log('Seeding subjects...');
    const subjectMap = await seedSubjects();

    console.log('Seeding classes...');
    await seedClasses(subjectMap);

    console.log('\nDone.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

main();
