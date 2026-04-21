import { Schema } from "mongoose";

let timetableSchema = Schema({
  class: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true
  },
  period: {
    type: Number,
    required: true,
    min: 1,
    max: 7
  },
  subjects: [{
    type: Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  }],
  teacher: {
    type: Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  }
}, {
  timestamps: true
});

timetableSchema.index({ class: 1, period: 1 }, { unique: true });

export default timetableSchema;
