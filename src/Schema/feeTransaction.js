import { Schema } from "mongoose";

// Family-level ledger. Every transaction belongs to a family.
let feeTransactionSchema = Schema({
  family: {
    type: Schema.Types.ObjectId,
    ref: 'Family',
    required: true
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
  academicYear: {
    type: String, // e.g. "2083-84" — tagged from global Settings at creation time
  },

  // ── Charge fields ────────────────────────────────────────────────────────
  chargeAmount: {
    type: Number,
    default: 0
  },
  // How much of this charge has been settled by incoming payments (FIFO)
  settledAmount: {
    type: Number,
    default: 0
  },
  // Charge lifecycle: Unpaid → Partial → Paid
  status: {
    type: String,
    enum: ['Unpaid', 'Partial', 'Paid'],
    default: 'Unpaid'
  },
  // Fee breakdown for charge entries
  feeBreakdown: [{
    feeType: String,
    amount: Number,
    // Optionally attribute a line item to a specific student in the family
    student: {
      type: Schema.Types.ObjectId,
      ref: 'Student'
    }
  }],

  // ── Payment fields ───────────────────────────────────────────────────────
  paidAmount: {
    type: Number,
    default: 0
  },
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

  // ── Running balance snapshot (set at write time) ─────────────────────────
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

feeTransactionSchema.index({ family: 1, date: -1 });
feeTransactionSchema.index({ family: 1, transactionType: 1, status: 1 });

export default feeTransactionSchema;
