import { Schema } from "mongoose";

const INVENTORY_ITEM_TYPES = [
  'Uniform',
  'Books',
  'Stationery',
];

let inventorySchema = Schema({
  itemType: {
    type: String,
    required: true,
    enum: INVENTORY_ITEM_TYPES
  },
  category: {
    type: String,
    enum: INVENTORY_ITEM_TYPES
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
  publication: {
    type: String
  },
  coverPhoto: {
    type: String
  },
  subject: {
    type: Schema.Types.ObjectId,
    ref: 'Subject'
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    default: 'Piece'
  },
  minimumQuantity: {
    type: Number,
    default: 0
  },
  price: {
    type: Number,
    required: true
  },
  unitPrice: {
    type: Number
  },
  applicableClasses: [{
    type: Schema.Types.ObjectId,
    ref: 'Class'
  }],
  location: {
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
