import { Schema } from "mongoose";

let teacherSchema = Schema({
  teacherId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  address: {
    type: String
  },
  photo: {
    type: String
  },
  qualification: {
    type: String
  },
  subjects: [{
    type: Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  assignedClasses: [{
    class: {
      type: Schema.Types.ObjectId,
      ref: 'Class'
    },
    subject: {
      type: Schema.Types.ObjectId,
      ref: 'Subject'
    }
  }],
  joinDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  salary: {
    type: Number
  }
}, {
  timestamps: true
});

export default teacherSchema;
