import { Schema } from "mongoose";

let userSchema = Schema({
  email: {
    type: String,
    unique: true,
    sparse: true // Optional but unique if provided
  },
  phoneNumber: {
    type: String,
    required: [true, "Phone number is required"],
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Admin', 'Teacher', 'Parent', 'Staff'],
    required: true,
    default: 'Parent'
  },
  // Link to corresponding profile (Teacher or Family for Parent)
  profile: {
    type: Schema.Types.ObjectId,
    refPath: 'profileModel'
  },
  profileModel: {
    type: String,
    enum: ['Teacher', 'Family']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  permissions: [{
    module: String,
    actions: [String] // ['create', 'read', 'update', 'delete']
  }]
}, {
  timestamps: true
});

export default userSchema;
