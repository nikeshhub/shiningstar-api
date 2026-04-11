import { Schema } from "mongoose";

let studentSchema = Schema({
  // Basic Information
  studentId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: [true, "Please enter student's name"],
  },
  dateOfBirth: {
    type: Date,
    required: [true, "Please enter the date of birth of students"],
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true
  },
  photo: {
    type: String, // URL or base64 string for student photo
  },
  birthCertificate: {
    type: String, // URL or file path for birth certificate
  },

  // Family Information (required - all parent/guardian info is in Family)
  family: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: [true, "Please link student to a family"]
  },

  // Academic Information
  currentClass: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  rollNumber: {
    type: Number
  },
  admissionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  academicYear: {
    type: String,
    required: true
  },
  enrollmentHistory: [{
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class'
    },
    academicYear: {
      type: String
    },
    action: {
      type: String,
      enum: ['Enrolled', 'Promoted', 'Repeated'],
      default: 'Enrolled'
    },
    actionDate: {
      type: Date,
      default: Date.now
    }
  }],
  previousSchool: {
    type: String
  },

  // ID Card & QR Code
  qrCode: {
    type: String, // QR code data/URL
  },
  idCardIssued: {
    type: Boolean,
    default: false
  },
  idCardIssuedDate: {
    type: Date
  },

  // GPS Tracking
  gpsEnabled: {
    type: Boolean,
    default: false
  },
  lastGPSLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date
  },

  // Documents
  documents: [{
    name: String,
    url: String,
    uploadDate: Date
  }],

  // Status
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Transferred', 'Graduated'],
    default: 'Active'
  },

  // Fee Balance Summary (for quick reference)
  feeBalance: {
    totalDue: {
      type: Number,
      default: 0
    },
    totalAdvance: {
      type: Number,
      default: 0
    }
  },

  // Remarks
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

export default studentSchema;
