import { Schema } from "mongoose";

let examSchema = Schema({
  examName: {
    type: String,
    required: true // e.g., "First Terminal Exam", "Second Terminal Exam"
  },
  examType: {
    type: String,
    enum: ['Terminal', 'Final', 'Unit Test', 'Other'],
    required: true
  },
  terminalNumber: {
    type: Number,
    enum: [1, 2, 3, 4],
    required: function() {
      return this.examType === 'Terminal';
    }
  },
  academicYear: {
    type: String,
    required: true
  },
  classes: [{
    type: Schema.Types.ObjectId,
    ref: 'Class'
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Ongoing', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  routine: [{
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    examDate: {
      type: Date,
      required: true
    },
    startTime: String, // e.g., "10:00 AM"
    endTime: String,   // e.g., "12:00 PM"
    duration: Number   // in minutes
  }],
  noticeGenerated: {
    type: Boolean,
    default: false
  },
  noticeGeneratedAt: Date,
  noticePdfUrl: String,
  examFee: {
    type: Number,
    default: 0,
    required: true
  },
  feeGenerated: {
    type: Boolean,
    default: false
  },
  feeGeneratedAt: Date,
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

export default examSchema;
