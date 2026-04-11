import { Schema } from "mongoose";

let inventorySchema = Schema({
  itemType: {
    type: String,
    required: true,
    enum: ['Uniform', 'Books', 'Stationery', 'Tracksuit', 'Other']
  },
  itemName: {
    type: String,
    required: true
  },
  itemCode: {
    type: String,
    unique: true
  },
  description: {
    type: String
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  applicableClasses: [{
    type: Schema.Types.ObjectId,
    ref: 'Class'
  }],
  supplier: {
    type: String
  },
  status: {
    type: String,
    enum: ['Available', 'Out of Stock', 'Discontinued'],
    default: 'Available'
  }
}, {
  timestamps: true
});

export default inventorySchema;
