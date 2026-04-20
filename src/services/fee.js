import { FeeTransaction, Student, Family, Settings } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getRequestUserId } from "../utils/requestUser.js";
import { getNextNumericBillNumber } from "../utils/billNumber.js";
import { parseDateInputForBoundary } from "../utils/nepaliDate.js";
import { canParentAccessFamilyId } from "../utils/accessScope.js";

// Fetch the school's active academic year from Settings (singleton).
// Falls back to a placeholder if Settings hasn't been configured yet.
const getActiveAcademicYear = async () => {
  try {
    const settings = await Settings.findOne({});
    return settings?.activeAcademicYear || '2081-82';
  } catch {
    return '2081-82';
  }
};

// All fees are billed at the family level. Every student belongs to a family
// and transactions are recorded against Family -> familyFeeBalance.
//
// IMPORTANT: `postFamilyLedgerEntry` below is the ONLY function that writes to
// FeeTransaction + Family.familyFeeBalance. Every caller (manual charge/payment,
// exam fees, inventory charges) MUST go through it. Do not write these two
// collections directly anywhere else — doing so breaks the invariant that the
// mirror matches the latest ledger row.

const loadFamilyWithStudents = async (familyId) => {
  const family = await Family.findById(familyId);
  if (!family) return { family: null, students: [] };
  const students = await Student.find({ family: familyId }).populate('currentClass');
  return { family, students };
};

const MAX_CAS_RETRIES = 8;

/**
 * Append one row to a family's fee ledger, atomically updating the
 * denormalized `familyFeeBalance` mirror on the Family document.
 *
 * Concurrency model: optimistic compare-and-swap with retry. We read the
 * current balance, compute the new one, then update conditionally on the
 * balance being unchanged. If a concurrent write bumped it in between we
 * retry. Mongo single-document updates are atomic, so this is race-free
 * without requiring a replica set / multi-doc transaction.
 *
 * Durability model: if the ledger insert fails after the mirror has been
 * bumped, we revert the mirror in a best-effort compensation. Short of a
 * multi-doc transaction, this is the strongest guarantee we can offer.
 *
 * @param {Object} entry
 * @param {string|ObjectId} entry.familyId
 * @param {number} entry.delta                  Signed balance delta (+charge, -payment)
 * @param {'Charge'|'Payment'} entry.transactionType
 * @param {string} entry.description
 * @param {number} [entry.chargeAmount=0]
 * @param {number} [entry.paidAmount=0]
 * @param {string} [entry.billNumber]
 * @param {Array}  [entry.feeBreakdown]
 * @param {string} [entry.paymentMethod]
 * @param {string} [entry.chequeNumber]
 * @param {string} [entry.transactionReference]
 * @param {string} [entry.remarks]
 * @param {string|ObjectId} [entry.createdBy]
 * @param {Date}   [entry.date]
 * @returns {Promise<Document>} The created FeeTransaction
 */
export async function postFamilyLedgerEntry(entry) {
  const {
    familyId,
    delta,
    transactionType,
    description,
    chargeAmount = 0,
    paidAmount = 0,
    billNumber,
    feeBreakdown,
    paymentMethod,
    chequeNumber,
    transactionReference,
    remarks,
    createdBy,
    academicYear,
    date = new Date(),
  } = entry;

  if (!familyId) {
    const err = new Error('familyId is required');
    err.status = 400;
    throw err;
  }
  if (!Number.isFinite(delta)) {
    throw new Error('delta must be a finite number');
  }

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    const family = await Family.findById(familyId).select('familyFeeBalance');
    if (!family) {
      const err = new Error('Family not found');
      err.status = 404;
      throw err;
    }

    const oldDue = family.familyFeeBalance?.totalDue || 0;
    const oldAdv = family.familyFeeBalance?.totalAdvance || 0;
    const previousBalance = oldDue - oldAdv;
    const net = previousBalance + delta;
    const newDue = net > 0 ? net : 0;
    const newAdv = net < 0 ? Math.abs(net) : 0;

    // Atomic compare-and-swap on the mirror. If another writer raced us
    // between the read above and here, matchedCount === 0 and we retry.
    const casResult = await Family.updateOne(
      {
        _id: familyId,
        'familyFeeBalance.totalDue': oldDue,
        'familyFeeBalance.totalAdvance': oldAdv,
      },
      {
        $set: {
          'familyFeeBalance.totalDue': newDue,
          'familyFeeBalance.totalAdvance': newAdv,
        },
      }
    );

    if (casResult.matchedCount === 0) {
      // Exponential-ish backoff between retries
      await new Promise((r) => setTimeout(r, 10 * (attempt + 1)));
      continue;
    }

    // CAS succeeded; write the ledger row.
    try {
      const txn = await FeeTransaction.create({
        family: familyId,
        date,
        billNumber,
        transactionType,
        description,
        chargeAmount,
        paidAmount,
        previousBalance,
        totalDue: newDue,
        totalAdvance: newAdv,
        feeBreakdown,
        paymentMethod,
        chequeNumber,
        transactionReference,
        remarks,
        createdBy,
        academicYear,
        // Charge-specific defaults (payments leave these at schema defaults)
        ...(transactionType === 'Charge' && { settledAmount: 0, status: 'Unpaid' }),
      });
      return txn;
    } catch (err) {
      // Ledger insert failed. Compensate by reverting the mirror so the
      // next writer sees a consistent state. Best-effort — log if it fails.
      try {
        await Family.updateOne(
          {
            _id: familyId,
            'familyFeeBalance.totalDue': newDue,
            'familyFeeBalance.totalAdvance': newAdv,
          },
          {
            $set: {
              'familyFeeBalance.totalDue': oldDue,
              'familyFeeBalance.totalAdvance': oldAdv,
            },
          }
        );
      } catch (rollbackErr) {
        console.error('postFamilyLedgerEntry: failed to roll back mirror', {
          familyId: String(familyId),
          ledgerError: err?.message,
          rollbackError: rollbackErr?.message,
        });
      }
      throw err;
    }
  }

  throw new Error(
    `postFamilyLedgerEntry: exceeded ${MAX_CAS_RETRIES} retries for family ${familyId}`
  );
}

// Create a charge on the family ledger
export let createCharge = async (req, res) => {
  try {
    const { familyId, description, chargeAmount, feeBreakdown } = req.body;
    if (!familyId) {
      return res.status(400).json({ success: false, message: "familyId is required" });
    }

    const { family } = await loadFamilyWithStudents(familyId);
    if (!family) {
      return res.status(404).json({ success: false, message: "Family not found" });
    }

    const createdBy = getRequestUserId(req);
    const billNumber =
      req.body.billNumber || (await getNextNumericBillNumber(FeeTransaction));
    const academicYear = await getActiveAcademicYear();

    const transaction = await postFamilyLedgerEntry({
      familyId,
      delta: Number(chargeAmount) || 0,
      transactionType: 'Charge',
      description,
      chargeAmount: Number(chargeAmount) || 0,
      billNumber,
      feeBreakdown,
      academicYear,
      createdBy,
    });

    res.status(201).json({
      success: true,
      message: "Fee charged successfully",
      data: transaction,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Record a payment against the family ledger and apply FIFO allocation to
// outstanding charge transactions (oldest unpaid/partial first).
export let createPayment = async (req, res) => {
  try {
    const { familyId, description, paidAmount, paymentMethod, chequeNumber, transactionReference } = req.body;
    if (!familyId) {
      return res.status(400).json({ success: false, message: "familyId is required" });
    }

    const { family } = await loadFamilyWithStudents(familyId);
    if (!family) {
      return res.status(404).json({ success: false, message: "Family not found" });
    }

    const createdBy = getRequestUserId(req);
    const amount = Number(paidAmount) || 0;
    const academicYear = await getActiveAcademicYear();

    const transaction = await postFamilyLedgerEntry({
      familyId,
      delta: -amount,
      transactionType: 'Payment',
      description: description || 'Payment received',
      paidAmount: amount,
      paymentMethod,
      chequeNumber,
      transactionReference,
      academicYear,
      createdBy,
    });

    // ── FIFO allocation ───────────────────────────────────────────────────
    // Apply payment to oldest unpaid/partial charges first.
    // We treat missing `status` (legacy rows) as 'Unpaid' via $ne 'Paid'.
    const unpaidCharges = await FeeTransaction.find({
      family: familyId,
      transactionType: 'Charge',
      status: { $ne: 'Paid' },
    }).sort({ date: 1, createdAt: 1 });

    let remaining = amount;
    const bulkOps = [];

    for (const charge of unpaidCharges) {
      if (remaining <= 0) break;

      const alreadySettled = charge.settledAmount || 0;
      const chargeRemaining = charge.chargeAmount - alreadySettled;
      if (chargeRemaining <= 0) continue;

      const toApply = Math.min(remaining, chargeRemaining);
      const newSettled = alreadySettled + toApply;
      const newStatus = newSettled >= charge.chargeAmount ? 'Paid' : 'Partial';

      bulkOps.push({
        updateOne: {
          filter: { _id: charge._id },
          update: { $set: { settledAmount: newSettled, status: newStatus } },
        },
      });

      remaining -= toApply;
    }

    if (bulkOps.length > 0) {
      await FeeTransaction.bulkWrite(bulkOps);
    }
    // ─────────────────────────────────────────────────────────────────────

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: transaction,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Family ledger (all transactions, full history, current balance, and member students)
export let getFamilyLedger = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { startDate, endDate } = req.query;

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessFamilyId(req, familyId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your family ledger.",
        });
      }
    }

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ success: false, message: "Family not found" });
    }

    const students = await Student.find({ family: familyId })
      .populate('currentClass', 'className')
      .select('studentId name currentClass');

    let query = { family: familyId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const parsedStart = parseDateInputForBoundary(startDate, { boundary: "start" });
        if (!parsedStart) {
          return res.status(400).json({ success: false, message: "Start date is invalid" });
        }
        query.date.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = parseDateInputForBoundary(endDate, { boundary: "end" });
        if (!parsedEnd) {
          return res.status(400).json({ success: false, message: "End date is invalid" });
        }
        query.date.$lte = parsedEnd;
      }
    }

    const transactions = await FeeTransaction
      .find(query)
      .sort({ date: 1, createdAt: 1 });

    const latest = transactions[transactions.length - 1];
    const currentBalance = latest
      ? {
          totalDue: latest.totalDue,
          totalAdvance: latest.totalAdvance,
          netBalance: latest.totalDue - latest.totalAdvance,
        }
      : { totalDue: 0, totalAdvance: 0, netBalance: 0 };

    res.status(200).json({
      success: true,
      message: "Family ledger fetched successfully",
      data: { family, students, transactions, currentBalance },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Fetch a single fee transaction (charge or payment) along with the family +
// students, for rendering the bill/receipt preview page.
export let getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const txn = await FeeTransaction.findById(id).populate({
      path: 'createdBy',
      select: 'phoneNumber email role',
    });

    if (!txn) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessFamilyId(req, txn.family);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view transactions for your family.",
        });
      }
    }

    const family = await Family.findById(txn.family);
    if (!family) {
      return res.status(404).json({ success: false, message: "Family not found" });
    }

    const students = await Student.find({ family: txn.family })
      .populate('currentClass', 'className')
      .select('studentId name currentClass rollNumber');

    res.status(200).json({
      success: true,
      message: "Transaction fetched successfully",
      data: { transaction: txn, family, students },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Dues list — families with outstanding balances
export let getDuesList = async (req, res) => {
  try {
    const { classId, minAmount } = req.query;
    const threshold = Number(minAmount) || 0;

    let familyQuery = {
      status: 'Active',
      'familyFeeBalance.totalDue': { $gt: threshold },
    };

    // If a class filter is provided, restrict to families that have at least
    // one active student in that class.
    if (classId) {
      const studentsInClass = await Student.find({
        currentClass: classId,
        status: 'Active',
      }).select('family');
      const familyIds = [...new Set(
        studentsInClass.map(s => s.family?.toString()).filter(Boolean)
      )];
      familyQuery._id = { $in: familyIds };
    }

    const families = await Family.find(familyQuery)
      .sort({ 'familyFeeBalance.totalDue': -1 });

    // Batch-fetch all students across every family in a single query,
    // then bucket them by family in memory. Kills the previous N+1.
    const familyIds = families.map((f) => f._id);
    const allStudents = familyIds.length
      ? await Student.find({ family: { $in: familyIds } })
          .populate('currentClass', 'className')
          .select('studentId name currentClass family')
      : [];

    const studentsByFamily = new Map();
    for (const s of allStudents) {
      const key = s.family?.toString();
      if (!key) continue;
      if (!studentsByFamily.has(key)) studentsByFamily.set(key, []);
      studentsByFamily.get(key).push(s);
    }

    const data = families.map((family) => ({
      ...family.toObject(),
      students: studentsByFamily.get(family._id.toString()) || [],
      parentName: family.primaryContact?.name || null,
      parentContact: family.primaryContact?.mobile || null,
    }));

    const totalDues = data.reduce(
      (sum, f) => sum + (f.familyFeeBalance?.totalDue || 0),
      0
    );

    res.status(200).json({
      success: true,
      message: "Dues list fetched successfully",
      data: { families: data, totalDues, count: data.length },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Fee collection summary — payments across families, optionally filtered by class membership
export let getFeeCollectionSummary = async (req, res) => {
  try {
    const { startDate, endDate, classId } = req.query;

    let query = { transactionType: 'Payment' };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        const parsedStart = parseDateInputForBoundary(startDate, { boundary: "start" });
        if (!parsedStart) {
          return res.status(400).json({ success: false, message: "Start date is invalid" });
        }
        query.date.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = parseDateInputForBoundary(endDate, { boundary: "end" });
        if (!parsedEnd) {
          return res.status(400).json({ success: false, message: "End date is invalid" });
        }
        query.date.$lte = parsedEnd;
      }
    }

    // Class filter: restrict to families that contain a student in the class
    if (classId) {
      const studentsInClass = await Student.find({
        currentClass: classId,
        status: 'Active',
      }).select('family');
      const familyIds = [...new Set(
        studentsInClass.map(s => s.family?.toString()).filter(Boolean)
      )];
      query.family = { $in: familyIds };
    }

    const payments = await FeeTransaction.find(query);

    const totalCollection = payments.reduce((sum, p) => sum + p.paidAmount, 0);

    const byPaymentMethod = payments.reduce((acc, payment) => {
      const method = payment.paymentMethod || 'Cash';
      if (!acc[method]) acc[method] = { count: 0, amount: 0 };
      acc[method].count++;
      acc[method].amount += payment.paidAmount;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      message: "Collection summary fetched successfully",
      data: {
        totalCollection,
        transactionCount: payments.length,
        byPaymentMethod,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};


// Auto-generate bill number
export let generateBillNumber = async (req, res) => {
  try {
    const newBillNumber = await getNextNumericBillNumber(FeeTransaction);
    res.status(200).json({
      success: true,
      data: { billNumber: newBillNumber },
    });
  } catch (error) {
    handleError(res, error);
  }
};
