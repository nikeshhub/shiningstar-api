import { Inventory, InventoryDistribution, Student, FeeTransaction } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Inventory Item Management

export let createInventoryItem = async (req, res) => {
  try {
    // Auto-generate itemCode if not provided
    if (!req.body.itemCode) {
      const lastItem = await Inventory.findOne().sort({ createdAt: -1 });
      const lastCode = lastItem ? parseInt(lastItem.itemCode.replace('INV', '')) : 0;
      req.body.itemCode = `INV${String(lastCode + 1).padStart(5, '0')}`;
    }

    const result = await Inventory.create(req.body);
    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getAllInventoryItems = async (req, res) => {
  try {
    const { itemType, status, search } = req.query;
    let query = {};

    if (itemType) query.itemType = itemType;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await Inventory.find(query)
      .populate('applicableClasses')
      .sort({ itemName: 1 });

    res.status(200).json({
      success: true,
      message: "Inventory items fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getInventoryItemById = async (req, res) => {
  try {
    const result = await Inventory.findById(req.params.id)
      .populate('applicableClasses');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Item fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let updateInventoryItem = async (req, res) => {
  try {
    const result = await Inventory.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('applicableClasses');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let deleteInventoryItem = async (req, res) => {
  try {
    const result = await Inventory.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Inventory Distribution Management

export let distributeItem = async (req, res) => {
  try {
    const { studentId, itemId, quantity, paymentStatus, linkToFee, distributedBy, remarks } = req.body;

    // Get item details
    const item = await Inventory.findById(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    // Check stock
    if (item.quantity < quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${item.quantity}`
      });
    }

    const totalAmount = item.price * quantity;
    let feeTransactionId = null;

    // If linked to fee, create fee transaction
    if (linkToFee && paymentStatus === 'Linked to Fee') {
      const lastTransaction = await FeeTransaction
        .findOne({ student: studentId })
        .sort({ date: -1 });

      const previousBalance = lastTransaction
        ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
        : 0;

      const newTotalDue = previousBalance >= 0
        ? previousBalance + totalAmount
        : totalAmount;

      const newTotalAdvance = previousBalance < 0
        ? Math.abs(previousBalance)
        : 0;

      // Generate bill number
      const lastCharge = await FeeTransaction
        .findOne({ transactionType: 'Charge', billNumber: { $exists: true } })
        .sort({ createdAt: -1 });

      const lastNumber = lastCharge ? parseInt(lastCharge.billNumber) : 0;
      const billNumber = String(lastNumber + 1).padStart(6, '0');

      // Create fee transaction
      const feeTransaction = await FeeTransaction.create({
        student: studentId,
        billNumber,
        transactionType: 'Charge',
        description: `${item.itemName} x${quantity}`,
        chargeAmount: totalAmount,
        paidAmount: 0,
        previousBalance,
        totalDue: newTotalDue > newTotalAdvance ? newTotalDue - newTotalAdvance : 0,
        totalAdvance: newTotalAdvance > newTotalDue ? newTotalAdvance - newTotalDue : 0,
        feeBreakdown: [{
          feeType: item.itemType,
          amount: totalAmount
        }],
        createdBy: distributedBy
      });

      feeTransactionId = feeTransaction._id;

      // Update student balance
      await Student.findByIdAndUpdate(studentId, {
        'feeBalance.totalDue': feeTransaction.totalDue,
        'feeBalance.totalAdvance': feeTransaction.totalAdvance
      });
    }

    // Create distribution record
    const distribution = await InventoryDistribution.create({
      student: studentId,
      item: itemId,
      quantity,
      price: item.price,
      totalAmount,
      paymentStatus: paymentStatus || 'Pending',
      feeTransaction: feeTransactionId,
      distributedBy,
      remarks
    });

    // Update inventory quantity
    item.quantity -= quantity;
    if (item.quantity === 0) {
      item.status = 'Out of Stock';
    }
    await item.save();

    res.status(201).json({
      success: true,
      message: "Item distributed successfully",
      data: distribution,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getStudentDistributions = async (req, res) => {
  try {
    const { studentId } = req.params;

    const distributions = await InventoryDistribution.find({
      student: studentId
    })
      .populate('item')
      .populate('feeTransaction')
      .sort({ distributionDate: -1 });

    const totalAmount = distributions.reduce((sum, d) => sum + d.totalAmount, 0);
    const paidAmount = distributions
      .filter(d => d.paymentStatus === 'Paid')
      .reduce((sum, d) => sum + d.totalAmount, 0);

    res.status(200).json({
      success: true,
      message: "Distributions fetched successfully",
      data: {
        distributions,
        summary: {
          totalAmount,
          paidAmount,
          pendingAmount: totalAmount - paidAmount
        }
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getAllDistributions = async (req, res) => {
  try {
    const { itemType, paymentStatus, startDate, endDate } = req.query;
    let query = {};

    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      query.distributionDate = {};
      if (startDate) query.distributionDate.$gte = new Date(startDate);
      if (endDate) query.distributionDate.$lte = new Date(endDate);
    }

    const distributions = await InventoryDistribution.find(query)
      .populate('student', 'name studentId currentClass')
      .populate('item')
      .sort({ distributionDate: -1 });

    // Filter by item type if specified
    const filteredDistributions = itemType
      ? distributions.filter(d => d.item.itemType === itemType)
      : distributions;

    res.status(200).json({
      success: true,
      message: "Distributions fetched successfully",
      data: filteredDistributions,
    });
  } catch (error) {
    handleError(res, error);
  }
};
