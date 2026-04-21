import { Schema } from "mongoose";

let classSchema = Schema({
  className: {
    type: String,
    required: true,
    unique: true
  },
  classTeacher: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher'
  },
  capacity: {
    type: Number,
    default: 40
  },
  monthlyFee: {
    type: Number,
    required: true,
    default: 0
  },
  subjects: [{
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true
    },
    books: [{
      item: {
        type: Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
      },
      required: {
        type: Boolean,
        default: true
      },
      quantityPerStudent: {
        type: Number,
        default: 1,
        min: 1
      },
      note: String
    }]
  }],
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  timetable: [{
    day: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      required: true
    },
    period: {
      type: Number,
      required: true,
      min: 1,
      max: 7
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject'
    },
    teacher: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher'
    }
  }]
}, {
  timestamps: true
});

export default classSchema;
