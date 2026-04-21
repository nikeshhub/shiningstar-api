import { Schema } from "mongoose";

const counterSchema = Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

export default counterSchema;
