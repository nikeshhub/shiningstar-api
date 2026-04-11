import { Schema } from "mongoose";

let inventoryDistributionSchema = Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  item: {
    type: Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 1
  },
  distributionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  price: {
    type: Number,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Linked to Fee'],
    default: 'Pending'
  },
  // If linked to fee transaction
  feeTransaction: {
    type: Schema.Types.ObjectId,
    ref: 'FeeTransaction'
  },
  distributedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

export default inventoryDistributionSchema;
