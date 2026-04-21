import { Schema } from "mongoose";

let notificationSchema = Schema({
  message: {
    type: String,
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
    default: false
  },
  sendEmail: {
    type: Boolean,
    default: false
  },
  // Status
  status: {
    type: String,
    enum: ['Draft', 'Scheduled', 'Processing', 'Sent', 'Failed'],
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
  lastError: {
    type: String,
    default: null
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

notificationSchema.index({ status: 1, scheduledDate: 1 });

export default notificationSchema;
