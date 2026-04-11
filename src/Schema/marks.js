import { Schema } from "mongoose";

let marksSchema = Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  exam: {
    type: Schema.Types.ObjectId,
    ref: 'Exam',
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
  terminalNumber: {
    type: Number,
    enum: [1, 2, 3, 4]
  },
  subjectMarks: [{
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    writtenMarks: {
      type: Number,
      default: 0
    },
    practicalMarks: {
      type: Number,
      default: 0
    },
    totalMarks: {
      type: Number,
      default: 0
    },
    fullMarks: {
      type: Number,
      required: true
    },
    passMarks: {
      type: Number,
      required: true
    },
    obtainedMarks: {
      type: Number,
      default: 0
    },
    percentage: {
      type: Number,
      default: 0
    },
    gradePoint: {
      type: Number,
      default: 0,
      min: 0,
      max: 4
    },
    gradeLetter: {
      type: String,
      enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'NG', 'AB'],
      default: 'NG'
    },
    isAbsent: {
      type: Boolean,
      default: false
    },
    remarks: String
  }],
  totalMarks: {
    type: Number,
    default: 0
  },
  totalObtained: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  gpa: {
    type: Number,
    default: 0
  },
  overallGrade: {
    type: String
  },
  rank: {
    type: Number
  },
  result: {
    type: String,
    enum: ['Pass', 'Fail', 'Pending'],
    default: 'Pending'
  },
  enteredBy: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher'
  }
}, {
  timestamps: true
});

// Index for faster queries
marksSchema.index({ student: 1, exam: 1 }, { unique: true });

export default marksSchema;
