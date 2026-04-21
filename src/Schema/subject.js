import { Schema } from "mongoose";

let subjectSchema = Schema({
  subjectName: {
    type: String,
    required: true
  },
  subjectCode: {
    type: String,
    required: true,
    unique: true
  },
  subjectType: {
    type: String,
    enum: ['Major', 'Minor'],
    required: true,
    default: 'Major'
  },
  creditHours: {
    type: Number,
    required: true,
    default: 5.0
  },
  writtenMarks: {
    type: Number,
    required: true
  },
  practicalMarks: {
    type: Number,
    required: true
  },
  fullMarks: {
    type: Number,
    required: true
  },
  passMarks: {
    type: Number,
    required: true
  },
  isOptional: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

export default subjectSchema;
