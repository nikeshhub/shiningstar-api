import { Schema } from "mongoose";

let feeStructureSchema = Schema({
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  academicYear: {
    type: String,
    required: true
  },
  fees: [{
    feeType: {
      type: String,
      required: true,
      enum: ['Admission', 'Monthly', 'Exam', 'Uniform', 'Books', 'Stationery', 'Tracksuit', 'Other']
    },
    amount: {
      type: Number,
      required: true
    },
    description: {
      type: String
    }
  }],
  monthlyFee: {
    type: Number,
    default: 0
  },
  admissionFee: {
    type: Number,
    default: 0
  },
  examFee: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

export default feeStructureSchema;
