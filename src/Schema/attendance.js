import { Schema } from "mongoose";

let attendanceSchema = Schema({
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  students: [{
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Excused'],
      required: true
    },
    remarks: String
  }],
  takenBy: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher'
  }
}, {
  timestamps: true
});

// Ensure one attendance record per class per day
attendanceSchema.index({ class: 1, date: 1 }, { unique: true });

export default attendanceSchema;
