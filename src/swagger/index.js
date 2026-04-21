import swaggerJsdoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Shining Star School Management System API',
    version: '1.0.0',
    description: 'RESTful API for managing students, classes, teachers, attendance, exams, fees, inventory, and notifications.',
    contact: {
      name: 'Shining Star Dev Team',
    },
    license: {
      name: 'ISC',
    },
  },
  servers: [
    {
      url: 'http://localhost:8000',
      description: 'Local Development Server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      // ── Auth ──────────────────────────────────────────────────────────────
      RegisterRequest: {
        type: 'object',
        required: ['phoneNumber', 'password', 'role'],
        properties: {
          phoneNumber: { type: 'string', example: '9811223344' },
          email: { type: 'string', format: 'email', example: 'admin@shiningstar.edu' },
          password: { type: 'string', example: 'Str0ngP@ss' },
          role: { type: 'string', enum: ['SuperAdmin', 'Admin'], example: 'Admin' },
          profile: { type: 'string', description: 'ObjectId linking to Teacher or Family profile' },
          profileModel: { type: 'string', enum: ['Teacher', 'Family'] },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['identifier', 'password'],
        properties: {
          identifier: { type: 'string', example: '9811223344' },
          password: { type: 'string', example: 'Str0ngP@ss' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  phoneNumber: { type: 'string' },
                  email: { type: 'string' },
                  role: { type: 'string' },
                  permissions: { type: 'array', items: { type: 'object' } },
                },
              },
              token: { type: 'string', description: 'JWT token (expires in 7 days)' },
            },
          },
        },
      },
      ChangePasswordRequest: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string' },
        },
      },
      UpdatePermissionsRequest: {
        type: 'object',
        required: ['userId', 'permissions'],
        properties: {
          userId: { type: 'string' },
          permissions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                module: { type: 'string', example: 'Students' },
                actions: { type: 'array', items: { type: 'string', enum: ['create', 'read', 'update', 'delete'] } },
              },
            },
          },
        },
      },
      ToggleStatusRequest: {
        type: 'object',
        required: ['userId', 'isActive'],
        properties: {
          userId: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },

      // ── Student ───────────────────────────────────────────────────────────
      StudentCreate: {
        type: 'object',
        required: ['name', 'dateOfBirth', 'gender', 'family', 'currentClass', 'admissionDate', 'academicYear'],
        properties: {
          studentId: { type: 'string', example: 'STU00001', description: 'Optional. Auto-generated if omitted.' },
          name: { type: 'string', example: 'Ram Kumar Sharma' },
          dateOfBirth: { type: 'string', format: 'date', example: '2066-12-01', description: 'BS date (YYYY-MM-DD)' },
          gender: { type: 'string', enum: ['Male', 'Female', 'Other'], example: 'Male' },
          family: { type: 'string', description: 'Family ObjectId', example: '507f1f77bcf86cd799439099' },
          currentClass: { type: 'string', description: 'Class ObjectId', example: '507f1f77bcf86cd799439011' },
          rollNumber: { type: 'integer', example: 5 },
          admissionDate: { type: 'string', format: 'date', example: '2080-01-01', description: 'BS date (YYYY-MM-DD)' },
          academicYear: { type: 'string', example: '2081-2082' },
          previousSchool: { type: 'string' },
          photo: { type: 'string', description: 'Uploaded photo URL' },
          birthCertificate: { type: 'string', description: 'Uploaded birth certificate URL' },
          status: { type: 'string', enum: ['Active', 'Inactive', 'Transferred', 'Graduated'], default: 'Active' },
          remarks: { type: 'string' },
        },
      },
      StudentResponse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          studentId: { type: 'string', example: 'STU00001' },
          name: { type: 'string' },
          dateOfBirth: { type: 'string', format: 'date-time' },
          gender: { type: 'string' },
          family: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              familyId: { type: 'string' },
              primaryContact: { type: 'object' },
              secondaryContact: { type: 'object' },
              address: { type: 'string' },
            },
          },
          address: { type: 'string' },
          parentName: { type: 'string' },
          parentRelation: { type: 'string' },
          parentContact: { type: 'string' },
          parentEmail: { type: 'string' },
          currentClass: { $ref: '#/components/schemas/ClassPopulated' },
          rollNumber: { type: 'integer' },
          admissionDate: { type: 'string', format: 'date-time' },
          academicYear: { type: 'string' },
          status: { type: 'string' },
          enrollmentHistory: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                class: { type: 'string' },
                academicYear: { type: 'string' },
                action: { type: 'string', enum: ['Enrolled', 'Promoted', 'Repeated'] },
                actionDate: { type: 'string', format: 'date-time' },
              },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      PromoteRequest: {
        type: 'object',
        required: ['studentIds', 'newClassId', 'academicYear', 'action'],
        properties: {
          studentIds: { type: 'array', items: { type: 'string' }, example: ['507f1f77bcf86cd799439011'] },
          newClassId: { type: 'string', example: '507f1f77bcf86cd799439012' },
          academicYear: { type: 'string', example: '2082-2083' },
          action: { type: 'string', enum: ['promote', 'repeat'], example: 'promote' },
        },
      },
      GPSUpdateRequest: {
        type: 'object',
        required: ['latitude', 'longitude'],
        properties: {
          latitude: { type: 'number', example: 27.7030 },
          longitude: { type: 'number', example: 85.3151 },
        },
      },

      // ── Class ─────────────────────────────────────────────────────────────
      ClassCreate: {
        type: 'object',
        required: ['className'],
        properties: {
          className: { type: 'string', example: 'Class 5' },
          classTeacher: { type: 'string', description: 'Teacher ObjectId' },
          capacity: { type: 'integer', default: 40, example: 35 },
          monthlyFee: { type: 'number', default: 0, example: 5000 },
          subjects: {
            type: 'array',
            description: 'Array of Subject ObjectIds or subject/book-set objects. Book details live in Inventory; class subjects only link inventory book items.',
            items: {
              oneOf: [
                { type: 'string', description: 'Subject ObjectId' },
                {
                  type: 'object',
                  properties: {
                    subject: { type: 'string', description: 'Subject ObjectId' },
                    books: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ClassSubjectBookLink' },
                    },
                  },
                },
              ],
            },
          },
          status: { type: 'string', enum: ['Active', 'Inactive'], default: 'Active' },
        },
      },
      ClassSubjectBookLink: {
        type: 'object',
        required: ['item'],
        properties: {
          item: { type: 'string', description: 'Inventory ObjectId for an itemType=Books item' },
          required: { type: 'boolean', default: true },
          quantityPerStudent: { type: 'number', default: 1 },
          note: { type: 'string' },
        },
      },
      ClassPopulated: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          className: { type: 'string' },
          classTeacher: {
            type: 'object',
            properties: { name: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' } },
          },
          capacity: { type: 'integer' },
          monthlyFee: { type: 'number' },
          subjects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'object', properties: { subjectName: { type: 'string' }, subjectCode: { type: 'string' } } },
                books: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      item: { type: 'object', description: 'Populated Inventory book item' },
                      required: { type: 'boolean' },
                      quantityPerStudent: { type: 'number' },
                      note: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          status: { type: 'string' },
          studentCount: { type: 'integer' },
          totalMonthlyRevenue: { type: 'number' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TimetableSlot: {
        type: 'object',
        properties: {
          day: { type: 'string', enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
          period: { type: 'integer', minimum: 1, maximum: 7 },
          subject: { type: 'string', description: 'Subject ObjectId or populated object' },
          teacher: { type: 'string', description: 'Teacher ObjectId or populated object' },
        },
      },
      TimetableSetRequest: {
        type: 'object',
        required: ['timetable'],
        properties: {
          timetable: { type: 'array', items: { $ref: '#/components/schemas/TimetableSlot' } },
        },
      },

      // ── Teacher ───────────────────────────────────────────────────────────
      TeacherCreate: {
        type: 'object',
        required: ['name', 'email', 'phone'],
        properties: {
          name: { type: 'string', example: 'Ms. Priya Devi' },
          email: { type: 'string', format: 'email', example: 'priya@shiningstar.edu' },
          phone: { type: 'string', example: '9811223344' },
          dateOfBirth: { type: 'string', format: 'date', example: '2048-07-12', description: 'BS date (YYYY-MM-DD)' },
          gender: { type: 'string', enum: ['Male', 'Female', 'Other'] },
          address: { type: 'string' },
          qualification: { type: 'string', example: 'B.Ed' },
          salary: { type: 'number', example: 45000 },
          status: { type: 'string', enum: ['Active', 'Inactive'], default: 'Active' },
        },
      },
      TeacherResponse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          qualification: { type: 'string' },
          salary: { type: 'number' },
          status: { type: 'string' },
          subjects: { type: 'array', items: { type: 'object' } },
          classesTeaching: { type: 'array', items: { type: 'object' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Subject ───────────────────────────────────────────────────────────
      SubjectCreate: {
        type: 'object',
        required: ['subjectName', 'subjectCode', 'fullMarks', 'passMarks'],
        properties: {
          subjectName: { type: 'string', example: 'Nepali' },
          subjectCode: { type: 'string', example: 'NEP' },
          fullMarks: { type: 'integer', example: 100 },
          passMarks: { type: 'integer', example: 35 },
          isOptional: { type: 'boolean', default: false },
        },
      },
      SubjectResponse: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          subjectName: { type: 'string' },
          subjectCode: { type: 'string' },
          fullMarks: { type: 'integer' },
          passMarks: { type: 'integer' },
          isOptional: { type: 'boolean' },
          classes: { type: 'array', items: { type: 'object' } },
        },
      },

      // ── Attendance ────────────────────────────────────────────────────────
      AttendanceMarkRequest: {
        type: 'object',
        required: ['classId', 'date', 'students', 'academicYear'],
        properties: {
          classId: { type: 'string' },
          date: { type: 'string', format: 'date', example: '2081-10-15' },
          academicYear: { type: 'string', example: '2081-2082' },
          students: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                student: { type: 'string', description: 'Student ObjectId' },
                status: { type: 'string', enum: ['Present', 'Absent', 'Late', 'Excused'] },
                remarks: { type: 'string' },
              },
            },
          },
        },
      },
      AttendanceReport: {
        type: 'object',
        properties: {
          student: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, studentId: { type: 'string' } } },
          summary: {
            type: 'object',
            properties: {
              totalDays: { type: 'integer' },
              present: { type: 'integer' },
              absent: { type: 'integer' },
              late: { type: 'integer' },
              excused: { type: 'integer' },
              attendancePercentage: { type: 'string' },
            },
          },
          records: { type: 'array', items: { type: 'object' } },
        },
      },

      // ── Exam ──────────────────────────────────────────────────────────────
      ExamCreate: {
        type: 'object',
        required: ['examName', 'terminalNumber', 'academicYear', 'startDate', 'endDate'],
        properties: {
          examName: { type: 'string', example: '1st Terminal' },
          terminalNumber: { type: 'integer', enum: [1, 2, 3, 4], description: 'Terminal 1-4. Auto-charges 3 months tuition per family on creation.' },
          academicYear: { type: 'string', example: '2081-2082' },
          classes: { type: 'array', items: { type: 'string' } },
          startDate: { type: 'string', format: 'date', example: '2081-06-10', description: 'BS date (YYYY-MM-DD)' },
          endDate: { type: 'string', format: 'date', example: '2081-06-20', description: 'BS date (YYYY-MM-DD)' },
          status: { type: 'string', enum: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'], default: 'Scheduled' },
          subjects: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                examDate: { type: 'string', format: 'date', example: '2081-06-12', description: 'BS date (YYYY-MM-DD)' },
                fullMarks: { type: 'integer' },
                passMarks: { type: 'integer' },
              },
            },
          },
          remarks: { type: 'string' },
        },
      },
      EnterMarksRequest: {
        type: 'object',
        required: ['studentId', 'examId', 'classId', 'academicYear', 'subjectMarks'],
        properties: {
          studentId: { type: 'string' },
          examId: { type: 'string' },
          classId: { type: 'string' },
          academicYear: { type: 'string' },
          subjectMarks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                subject: { type: 'string' },
                fullMarks: { type: 'integer' },
                passMarks: { type: 'integer' },
                obtainedMarks: { type: 'integer' },
                remarks: { type: 'string' },
              },
            },
          },
        },
      },

      // ── Fee (family-level billing) ────────────────────────────────────────
      FeeChargeRequest: {
        type: 'object',
        required: ['familyId', 'description', 'chargeAmount'],
        properties: {
          familyId: { type: 'string' },
          description: { type: 'string', example: 'Monthly fee - Asar 2081' },
          chargeAmount: { type: 'number', example: 5000 },
          billNumber: { type: 'string' },
          feeMonth: { type: 'string' },
          feeBreakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                feeType: { type: 'string' },
                amount: { type: 'number' },
                student: { type: 'string', description: 'Optional student ObjectId' },
              },
            },
          },
        },
      },
      FeePaymentRequest: {
        type: 'object',
        required: ['familyId', 'paidAmount'],
        properties: {
          familyId: { type: 'string' },
          description: { type: 'string' },
          paidAmount: { type: 'number', example: 5000 },
          paymentMethod: { type: 'string', enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'], default: 'Cash' },
          chequeNumber: { type: 'string' },
          transactionReference: { type: 'string' },
          feeMonths: { type: 'string' },
        },
      },

      // ── Inventory ─────────────────────────────────────────────────────────
      InventoryCreate: {
        type: 'object',
        required: ['itemType', 'itemName', 'quantity', 'price'],
        properties: {
          itemType: { type: 'string', enum: ['Uniform', 'Books', 'Stationery'] },
          itemName: { type: 'string', example: 'School Uniform Set' },
          description: { type: 'string' },
          publication: { type: 'string', description: 'Book publication/publisher when itemType is Books' },
          coverPhoto: { type: 'string', description: 'Book cover image URL when itemType is Books' },
          subject: { type: 'string', description: 'Subject ObjectId when itemType is Books' },
          quantity: { type: 'integer', example: 50 },
          price: { type: 'number', example: 1500 },
          applicableClasses: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['Available', 'Out of Stock', 'Discontinued'], default: 'Available' },
        },
      },
      DistributeRequest: {
        type: 'object',
        required: ['studentId', 'itemId', 'quantity'],
        properties: {
          studentId: { type: 'string' },
          itemId: { type: 'string' },
          quantity: { type: 'integer', example: 1 },
          paymentStatus: { type: 'string', enum: ['Paid', 'Pending', 'Linked to Fee'], default: 'Pending' },
          linkToFee: { type: 'boolean', default: false },
          remarks: { type: 'string' },
        },
      },

      // ── Notification ──────────────────────────────────────────────────────
      NotificationCreate: {
        type: 'object',
        required: ['message', 'targetAudience'],
        properties: {
          message: { type: 'string', example: 'Dear Parent, school will remain closed tomorrow.' },
          targetAudience: { type: 'string', enum: ['All Parents', 'Class-wise', 'Custom Group', 'Individual'] },
          classes: { type: 'array', items: { type: 'string' }, description: 'Required if targetAudience is Class-wise' },
          recipients: { type: 'array', items: { type: 'string' }, description: 'Required if targetAudience is Custom Group or Individual' },
          sendSMS: { type: 'boolean', default: false },
          sendPushNotification: { type: 'boolean', default: false },
          sendEmail: { type: 'boolean', default: false },
          scheduledDate: { type: 'string', format: 'date-time', example: '2081-06-15T09:00', description: 'BS local date-time' },
        },
      },
      FeeReminderRequest: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'Filter by class (optional)' },
          minDueAmount: { type: 'number', default: 0, description: 'Minimum due amount threshold' },
        },
      },
      AbsenceAlertRequest: {
        type: 'object',
        required: ['studentIds', 'date'],
        properties: {
          studentIds: { type: 'array', items: { type: 'string' } },
          date: { type: 'string', format: 'date', example: '2081-10-15', description: 'BS date (YYYY-MM-DD)' },
        },
      },

      // ── Generic ───────────────────────────────────────────────────────────
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: { type: 'object' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Something went wrong' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required or invalid token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Conflict: {
        description: 'Conflict — duplicate or constraint violation',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      ValidationError: {
        description: 'Bad request — validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
  tags: [
    { name: 'Auth', description: 'User registration, login, profile & permissions management' },
    { name: 'Students', description: 'Student CRUD, promotion, enrollment history & GPS tracking' },
    { name: 'Classes', description: 'Class management, enrolled students & timetable' },
    { name: 'Teachers', description: 'Teacher CRUD operations' },
    { name: 'Subjects', description: 'Subject configuration' },
    { name: 'Attendance', description: 'Daily attendance marking & reporting' },
    { name: 'Exams', description: 'Exam scheduling, marks entry & results' },
    { name: 'Fees', description: 'Fee structures, charges, payments & ledger' },
    { name: 'Inventory', description: 'School inventory items & student distributions' },
    { name: 'Notifications', description: 'Notifications, fee reminders & absence alerts' },
  ],
};

const options = {
  swaggerDefinition,
  apis: [
    './src/Routes/auth.js',
    './src/Routes/students.js',
    './src/Routes/class.js',
    './src/Routes/teachers.js',
    './src/Routes/subject.js',
    './src/Routes/attendance.js',
    './src/Routes/exam.js',
    './src/Routes/fee.js',
    './src/Routes/inventory.js',
    './src/Routes/notification.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
