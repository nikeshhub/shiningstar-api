import { Schema } from "mongoose";

// Global school settings — one document in the collection (singleton pattern).
// Use Settings.findOne() / Settings.findOneAndUpdate({ }, ..., { upsert: true })
// everywhere; never insert more than one document.
const settingsSchema = new Schema({
  activeAcademicYear: {
    type: String,
    required: true,
    default: '2081-82', // BS academic year, update via admin UI
  },
}, {
  timestamps: true,
});

export default settingsSchema;
