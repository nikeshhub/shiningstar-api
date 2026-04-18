import { FeeStructure, FeeTransaction, Student, Class, Family } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { generateDemandBill, generatePaymentReceipt } from "../utils/pdfGenerator.js";
import { uploadBufferToCloudinary } from "../config/cloudinary.js";
import { getRequestUserId } from "../utils/requestUser.js";
import { withFamilyContactList } from "../utils/studentFamily.js";
import { getNextNumericBillNumber } from "../utils/billNumber.js";

// Fee Structure Management (DEPRECATED - kept for backward compatibility)
// New system: Monthly fees stored in Class, Exam fees stored in Exam

export let createFeeStructure = async (req, res) => {
  try {
    const result = await FeeStructure.create(req.body);
    res.status(201).json({
      success: true,
      message: "Fee structure created successfully (deprecated - use Class monthlyFee and Exam examFee instead)",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getFeeStructureByClass = async (req, res) => {
  try {
    const { classId, academicYear } = req.query;
    const result = await FeeStructure.findOne({
      class: classId,
      academicYear
    }).populate('class');

    res.status(200).json({
      success: true,
      message: "Fee structure fetched successfully (deprecated - use Class monthlyFee and Exam examFee instead)",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Fee Transaction Management (Ledger System)

// Create a charge entry (like Dad's notebook - adding fees)
export let createCharge = async (req, res) => {
  try {
    const { studentId, description, chargeAmount, feeBreakdown } = req.body;
    const createdBy = getRequestUserId(req);
    const billNumber =
      req.body.billNumber || (await getNextNumericBillNumber(FeeTransaction));

    // Get student's current balance
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Get last transaction to calculate running balance
    const lastTransaction = await FeeTransaction
      .findOne({ student: studentId })
      .sort({ date: -1 });

    const previousBalance = lastTransaction
      ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
      : 0;

    // Calculate new balances
    const newTotalDue = previousBalance >= 0
      ? previousBalance + chargeAmount
      : chargeAmount;

    const newTotalAdvance = previousBalance < 0
      ? Math.abs(previousBalance)
      : 0;

    // Create transaction
    const transaction = await FeeTransaction.create({
      student: studentId,
      date: new Date(),
      billNumber,
      transactionType: 'Charge',
      description,
      chargeAmount,
      paidAmount: 0,
      previousBalance,
      totalDue: newTotalDue > newTotalAdvance ? newTotalDue - newTotalAdvance : 0,
      totalAdvance: newTotalAdvance > newTotalDue ? newTotalAdvance - newTotalDue : 0,
      feeBreakdown,
      createdBy
    });

    // Update student's fee balance summary
    await Student.findByIdAndUpdate(studentId, {
      'feeBalance.totalDue': transaction.totalDue,
      'feeBalance.totalAdvance': transaction.totalAdvance
    });

    // Generate PDF Bill
    try {
      const studentWithClass = await Student.findById(studentId).populate('currentClass');
      const billData = {
        billNumber,
        date: transaction.date,
        studentName: studentWithClass.name,
        className: studentWithClass.currentClass?.className || '',
        rollNumber: studentWithClass.rollNumber || '',
        feeMonth: req.body.feeMonth || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        feeBreakdown: feeBreakdown || [],
        totalAmount: chargeAmount,
        advance: previousBalance < 0 ? Math.abs(previousBalance) : 0,
      };

      const pdfBuffer = await generateDemandBill(billData);
      const result = await uploadBufferToCloudinary(pdfBuffer, 'pdfs', 'raw');
      transaction.billPdfUrl = result.secure_url;
      await transaction.save();
    } catch (pdfError) {
      console.error('Error generating PDF:', pdfError);
    }

    res.status(201).json({
      success: true,
      message: "Fee charged successfully",
      data: transaction
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Create a payment entry
export let createPayment = async (req, res) => {
  try {
    const { studentId, description, paidAmount, paymentMethod, chequeNumber, transactionReference } = req.body;
    const createdBy = getRequestUserId(req);

    // Get student
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    // Get last transaction
    const lastTransaction = await FeeTransaction
      .findOne({ student: studentId })
      .sort({ date: -1 });

    const previousBalance = lastTransaction
      ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
      : 0;

    // Calculate new balances
    // If previous balance is positive (dues), payment reduces it
    // If previous balance is negative (advance), payment increases advance
    let newTotalDue = 0;
    let newTotalAdvance = 0;

    if (previousBalance > 0) {
      // There are dues
      if (paidAmount >= previousBalance) {
        // Payment covers all dues and creates advance
        newTotalDue = 0;
        newTotalAdvance = paidAmount - previousBalance;
      } else {
        // Payment partially covers dues
        newTotalDue = previousBalance - paidAmount;
        newTotalAdvance = 0;
      }
    } else {
      // There's already advance
      newTotalDue = 0;
      newTotalAdvance = Math.abs(previousBalance) + paidAmount;
    }

    // Create transaction
    const transaction = await FeeTransaction.create({
      student: studentId,
      date: new Date(),
      transactionType: 'Payment',
      description: description || 'Payment received',
      chargeAmount: 0,
      paidAmount,
      previousBalance,
      totalDue: newTotalDue,
      totalAdvance: newTotalAdvance,
      paymentMethod,
      chequeNumber,
      transactionReference,
      createdBy
    });

    // Update student's fee balance
    await Student.findByIdAndUpdate(studentId, {
      'feeBalance.totalDue': transaction.totalDue,
      'feeBalance.totalAdvance': transaction.totalAdvance
    });

    // Generate PDF Receipt
    try {
      const receiptNumber = String(Date.now()).slice(-6);
      const receiptData = {
        receiptNumber,
        receivedFrom: student.name,
        paidAmount,
        outOfAmount: previousBalance > 0 ? previousBalance : paidAmount,
        balanceAmount: newTotalDue,
        feeMonths: req.body.feeMonths || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };

      const pdfBuffer = await generatePaymentReceipt(receiptData);
      const result = await uploadBufferToCloudinary(pdfBuffer, 'pdfs', 'raw');
      transaction.receiptPdfUrl = result.secure_url;
      await transaction.save();
    } catch (pdfError) {
      console.error('Error generating receipt PDF:', pdfError);
    }

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: transaction
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get student ledger (like Dad's notebook)
export let getStudentLedger = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;

    // Only show Individual billing transactions in student ledger
    // Family billing transactions should be viewed in Family Ledger
    let query = { student: studentId, billingScope: 'Individual' };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await FeeTransaction
      .find(query)
      .populate('student', 'name studentId currentClass')
      .populate({
        path: 'student',
        populate: { path: 'currentClass' }
      })
      .sort({ date: 1 });

    // Get current balance
    const latestTransaction = transactions[transactions.length - 1];
    const currentBalance = latestTransaction
      ? {
          totalDue: latestTransaction.totalDue,
          totalAdvance: latestTransaction.totalAdvance,
          netBalance: latestTransaction.totalDue - latestTransaction.totalAdvance
        }
      : { totalDue: 0, totalAdvance: 0, netBalance: 0 };

    res.status(200).json({
      success: true,
      message: "Ledger fetched successfully",
      data: {
        student: transactions[0]?.student,
        transactions,
        currentBalance
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get dues list (बक्यौता सूची)
export let getDuesList = async (req, res) => {
  try {
    const { classId, minAmount } = req.query;

    let studentQuery = { status: 'Active' };
    if (classId) studentQuery.currentClass = classId;

    // Find students with dues
    studentQuery['feeBalance.totalDue'] = { $gt: minAmount || 0 };

    const students = await Student
      .find(studentQuery)
      .populate('currentClass')
      .populate('family')
      .select('studentId name currentClass family feeBalance')
      .sort({ 'feeBalance.totalDue': -1 });

    const studentsWithContact = withFamilyContactList(students);
    const totalDues = studentsWithContact.reduce(
      (sum, student) => sum + student.feeBalance.totalDue,
      0
    );

    res.status(200).json({
      success: true,
      message: "Dues list fetched successfully",
      data: {
        students: studentsWithContact,
        totalDues,
        count: studentsWithContact.length
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Fee collection summary
export let getFeeCollectionSummary = async (req, res) => {
  try {
    const { startDate, endDate, classId } = req.query;

    let query = { transactionType: 'Payment' };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const payments = await FeeTransaction.find(query).populate({
      path: 'student',
      match: classId ? { currentClass: classId } : {}
    });

    const filteredPayments = payments.filter(p => p.student);

    const totalCollection = filteredPayments.reduce((sum, payment) => sum + payment.paidAmount, 0);

    // Group by payment method
    const byPaymentMethod = filteredPayments.reduce((acc, payment) => {
      const method = payment.paymentMethod;
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
        transactionCount: filteredPayments.length,
        byPaymentMethod
      }
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
      data: { billNumber: newBillNumber }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// FAMILY BILLING FUNCTIONS

// Create a family charge (combined bill for all siblings)
export let createFamilyCharge = async (req, res) => {
  try {
    const { familyId, description, chargeAmount, feeBreakdown } = req.body;
    const createdBy = getRequestUserId(req);
    const billNumber =
      req.body.billNumber || (await getNextNumericBillNumber(FeeTransaction));

    // Get family
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: "Family not found"
      });
    }

    // Get all students in the family
    const students = await Student.find({ family: familyId });
    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No students found in this family"
      });
    }

    // Use first student as the primary reference for the transaction
    const primaryStudent = students[0];

    // Get last family transaction to calculate running balance
    const lastTransaction = await FeeTransaction
      .findOne({ family: familyId, billingScope: 'Family' })
      .sort({ date: -1 });

    const previousBalance = lastTransaction
      ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
      : 0;

    // Calculate new balances
    const newTotalDue = previousBalance >= 0
      ? previousBalance + chargeAmount
      : chargeAmount;

    const newTotalAdvance = previousBalance < 0
      ? Math.abs(previousBalance)
      : 0;

    // Create transaction
    const transaction = await FeeTransaction.create({
      student: primaryStudent._id,
      family: familyId,
      billingScope: 'Family',
      date: new Date(),
      billNumber,
      transactionType: 'Charge',
      description,
      chargeAmount,
      paidAmount: 0,
      previousBalance,
      totalDue: newTotalDue > newTotalAdvance ? newTotalDue - newTotalAdvance : 0,
      totalAdvance: newTotalAdvance > newTotalDue ? newTotalAdvance - newTotalDue : 0,
      feeBreakdown,
      createdBy
    });

    // Update family's fee balance
    await Family.findByIdAndUpdate(familyId, {
      'familyFeeBalance.totalDue': transaction.totalDue,
      'familyFeeBalance.totalAdvance': transaction.totalAdvance
    });

    // Generate PDF Bill for Family
    try {
      const primaryStudentWithClass = await Student.findById(primaryStudent._id).populate('currentClass');
      const siblingNames = students.map(s => s.name).join(', ');
      const billData = {
        billNumber,
        date: transaction.date,
        studentName: `${family.primaryContact.name} (Family: ${siblingNames})`,
        className: primaryStudentWithClass.currentClass?.className || 'Multiple Classes',
        rollNumber: '',
        feeMonth: req.body.feeMonth || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        feeBreakdown: feeBreakdown || [],
        totalAmount: chargeAmount,
        advance: previousBalance < 0 ? Math.abs(previousBalance) : 0,
      };

      const pdfBuffer = await generateDemandBill(billData);
      const result = await uploadBufferToCloudinary(pdfBuffer, 'pdfs', 'raw');
      transaction.billPdfUrl = result.secure_url;
      await transaction.save();
    } catch (pdfError) {
      console.error('Error generating family bill PDF:', pdfError);
    }

    res.status(201).json({
      success: true,
      message: "Family fee charged successfully",
      data: transaction
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Create a family payment (payment for entire family)
export let createFamilyPayment = async (req, res) => {
  try {
    const { familyId, description, paidAmount, paymentMethod, chequeNumber, transactionReference } = req.body;
    const createdBy = getRequestUserId(req);

    // Get family
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: "Family not found"
      });
    }

    // Get all students in the family
    const students = await Student.find({ family: familyId });
    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No students found in this family"
      });
    }

    // Use first student as the primary reference
    const primaryStudent = students[0];

    // Get last family transaction
    const lastTransaction = await FeeTransaction
      .findOne({ family: familyId, billingScope: 'Family' })
      .sort({ date: -1 });

    const previousBalance = lastTransaction
      ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
      : 0;

    // Calculate new balances
    let newTotalDue = 0;
    let newTotalAdvance = 0;

    if (previousBalance > 0) {
      if (paidAmount >= previousBalance) {
        newTotalDue = 0;
        newTotalAdvance = paidAmount - previousBalance;
      } else {
        newTotalDue = previousBalance - paidAmount;
        newTotalAdvance = 0;
      }
    } else {
      newTotalDue = 0;
      newTotalAdvance = Math.abs(previousBalance) + paidAmount;
    }

    // Create transaction
    const transaction = await FeeTransaction.create({
      student: primaryStudent._id,
      family: familyId,
      billingScope: 'Family',
      date: new Date(),
      transactionType: 'Payment',
      description: description || 'Payment received',
      chargeAmount: 0,
      paidAmount,
      previousBalance,
      totalDue: newTotalDue,
      totalAdvance: newTotalAdvance,
      paymentMethod,
      chequeNumber,
      transactionReference,
      createdBy
    });

    // Update family's fee balance
    await Family.findByIdAndUpdate(familyId, {
      'familyFeeBalance.totalDue': transaction.totalDue,
      'familyFeeBalance.totalAdvance': transaction.totalAdvance
    });

    // Generate PDF Receipt for Family
    try {
      const receiptNumber = String(Date.now()).slice(-6);
      const receiptData = {
        receiptNumber,
        receivedFrom: `${family.primaryContact.name} (Family)`,
        paidAmount,
        outOfAmount: previousBalance > 0 ? previousBalance : paidAmount,
        balanceAmount: newTotalDue,
        feeMonths: req.body.feeMonths || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };

      const pdfBuffer = await generatePaymentReceipt(receiptData);
      const result = await uploadBufferToCloudinary(pdfBuffer, 'pdfs', 'raw');
      transaction.receiptPdfUrl = result.secure_url;
      await transaction.save();
    } catch (pdfError) {
      console.error('Error generating family receipt PDF:', pdfError);
    }

    res.status(201).json({
      success: true,
      message: "Family payment recorded successfully",
      data: transaction
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get family ledger (combined ledger for all siblings)
export let getFamilyLedger = async (req, res) => {
  try {
    const { familyId } = req.params;
    const { startDate, endDate } = req.query;

    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: "Family not found"
      });
    }

    // Get all students in the family
    const students = await Student.find({ family: familyId })
      .populate('currentClass', 'className')
      .select('studentId name currentClass');

    let query = { family: familyId, billingScope: 'Family' };

    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await FeeTransaction
      .find(query)
      .populate('student', 'name studentId')
      .sort({ date: 1 });

    // Get current balance
    const latestTransaction = transactions[transactions.length - 1];
    const currentBalance = latestTransaction
      ? {
          totalDue: latestTransaction.totalDue,
          totalAdvance: latestTransaction.totalAdvance,
          netBalance: latestTransaction.totalDue - latestTransaction.totalAdvance
        }
      : { totalDue: 0, totalAdvance: 0, netBalance: 0 };

    res.status(200).json({
      success: true,
      message: "Family ledger fetched successfully",
      data: {
        family,
        students,
        transactions,
        currentBalance
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};
