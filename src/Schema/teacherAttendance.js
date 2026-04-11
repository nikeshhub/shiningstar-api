import { Schema } from "mongoose";

let teacherAttendanceSchema = Schema({
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Present', 'Absent', 'Leave'],
    default: 'Present'
  },
  inTime: {
    type: Date
  },
  outTime: {
    type: Date
  },
  remarks: {
    type: String
  },
  deviceName: {
    type: String
  },
  markedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

teacherAttendanceSchema.index({ teacher: 1, date: 1 }, { unique: true });

export default teacherAttendanceSchema;
