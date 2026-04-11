import { Schema } from "mongoose";

// This is the ledger system like "Dad's notebook"
let feeTransactionSchema = Schema({
  student: {
    type: Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  // For family billing - when billingScope is 'Family', this links to family
  family: {
    type: Schema.Types.ObjectId,
    ref: 'Family'
  },
  // Billing scope: 'Individual' or 'Family'
  billingScope: {
    type: String,
    enum: ['Individual', 'Family'],
    default: 'Individual'
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  billNumber: {
    type: String,
    unique: true,
    sparse: true // Only for charge entries
  },
  transactionType: {
    type: String,
    enum: ['Charge', 'Payment'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  // For Charge entries
  chargeAmount: {
    type: Number,
    default: 0
  },
  // For Payment entries
  paidAmount: {
    type: Number,
    default: 0
  },
  // Running balance calculations
  previousBalance: {
    type: Number,
    default: 0
  },
  totalDue: {
    type: Number,
    default: 0
  },
  totalAdvance: {
    type: Number,
    default: 0
  },
  // Payment details
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Bank Transfer', 'Cheque', 'Online'],
    default: 'Cash'
  },
  chequeNumber: {
    type: String
  },
  transactionReference: {
    type: String
  },
  // Fee breakdown for charge entries
  feeBreakdown: [{
    feeType: String,
    amount: Number
  }],
  // PDF URLs
  billPdfUrl: {
    type: String // For charge transactions - link to demand bill PDF
  },
  receiptPdfUrl: {
    type: String // For payment transactions - link to receipt PDF
  },
  remarks: {
    type: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
feeTransactionSchema.index({ student: 1, date: -1 });

export default feeTransactionSchema;
