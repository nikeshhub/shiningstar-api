import { Schema } from "mongoose";

// Every exam is a terminal exam (T1-T4). Fees are auto-generated from
// `class.monthlyFee × 3` (a terminal covers three months of tuition) when
// the exam is created — there is no separate `examFee` stored here.
let examSchema = Schema({
  examName: {
    type: String,
    required: true
  },
  terminalNumber: {
    type: Number,
    enum: [1, 2, 3, 4],
    required: true
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
    startTime: String,
    endTime: String,
    duration: Number
  }],
  noticeGenerated: {
    type: Boolean,
    default: false
  },
  noticeGeneratedAt: Date,
  noticePdfUrl: String,
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

export default examSchema;
