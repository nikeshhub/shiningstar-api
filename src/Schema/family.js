import { Schema } from "mongoose";

let familySchema = Schema({
  familyId: {
    type: String,
    required: true,
    unique: true
  },
  // Primary parent/guardian information
  primaryContact: {
    name: {
      type: String,
      required: true
    },
    relation: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian'],
      required: true
    },
    citizenship: {
      type: String,
      required: true
    },
    mobile: {
      type: String,
      required: true
    },
    alternateMobile: {
      type: String
    },
    email: {
      type: String
    }
  },
  // Secondary contact (optional)
  secondaryContact: {
    name: String,
    relation: {
      type: String,
      enum: ['Father', 'Mother', 'Guardian']
    },
    citizenship: String,
    mobile: String,
    email: String
  },
  // Address (shared by all family members)
  address: {
    type: String,
    required: true
  },
  // User account for parent portal (created automatically)
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  // Combined fee balance for the entire family
  familyFeeBalance: {
    totalDue: {
      type: Number,
      default: 0
    },
    totalAdvance: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

export default familySchema;
