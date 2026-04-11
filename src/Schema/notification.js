import { Schema } from "mongoose";

let notificationSchema = Schema({
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  notificationType: {
    type: String,
    enum: ['Fee Reminder', 'Result Published', 'Holiday', 'Event', 'Exam Schedule', 'General', 'Attendance Alert'],
    required: true
  },
  targetAudience: {
    type: String,
    enum: ['All Parents', 'Class-wise', 'Custom Group', 'Individual'],
    required: true
  },
  // If class-wise
  classes: [{
    type: Schema.Types.ObjectId,
    ref: 'Class'
  }],
  // If custom group or individual
  recipients: [{
    type: Schema.Types.ObjectId,
    ref: 'Student'
  }],
  // Delivery methods
  sendSMS: {
    type: Boolean,
    default: false
  },
  sendPushNotification: {
    type: Boolean,
    default: true
  },
  sendEmail: {
    type: Boolean,
    default: false
  },
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Scheduled', 'Sent', 'Failed'],
    default: 'Draft'
  },
  scheduledDate: {
    type: Date
  },
  sentDate: {
    type: Date
  },
  totalRecipients: {
    type: Number,
    default: 0
  },
  successCount: {
    type: Number,
    default: 0
  },
  failureCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

export default notificationSchema;
