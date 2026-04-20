import { Schema } from "mongoose";

let progressReportSchema = Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },

  terminals: [{
    terminalNumber: {
      type: Number,
      enum: [1, 2, 3, 4],
      required: true
    },
    marks: {
      type: Schema.Types.ObjectId,
      ref: 'Marks'
    },
    gpa: {
      type: Number,
      default: 0
    },
    grade: {
      type: String
    },
    attendance: {
      totalDays: {
        type: Number,
        default: 0
      },
      present: {
        type: Number,
        default: 0
      },
      absent: {
        type: Number,
        default: 0
      },
      percentage: {
        type: Number,
        default: 0
      }
    }
  }],

  yearlyTotal: {
    gradePoint: {
      type: Number,
      default: 0
    },
    grade: {
      type: String
    }
  },

  pdfUrl: String,
  generatedAt: Date,
  generatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
progressReportSchema.index({ student: 1, academicYear: 1 }, { unique: true });

export default progressReportSchema;
