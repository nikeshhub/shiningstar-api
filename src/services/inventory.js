import { Inventory, InventoryDistribution, Student, FeeTransaction } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getRequestUserId } from "../utils/requestUser.js";
import { getNextNumericBillNumber } from "../utils/billNumber.js";
import { parseDateInputForBoundary } from "../utils/nepaliDate.js";
import { postFamilyLedgerEntry } from "./fee.js";

const DEFAULT_INVENTORY_CATEGORY = "Stationery";
const DEFAULT_INVENTORY_UNIT = "Piece";

const toOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
};

const resolveInventoryStatus = (quantity, minimumQuantity, currentStatus) => {
  if (currentStatus === "Discontinued") {
    return "Discontinued";
  }

  const normalizedQuantity = toOptionalNumber(quantity) ?? 0;

  if (normalizedQuantity <= 0) {
    return "Out of Stock";
  }

  return "Available";
};

const normalizeInventoryPayload = (payload = {}) => {
  const data = { ...payload };

  const normalizedCategory = data.category || data.itemType || DEFAULT_INVENTORY_CATEGORY;
  const normalizedPrice = toOptionalNumber(data.unitPrice) ?? toOptionalNumber(data.price);
  const normalizedQuantity = toOptionalNumber(data.quantity);
  const normalizedMinimumQuantity = toOptionalNumber(data.minimumQuantity) ?? 0;

  data.category = normalizedCategory;
  data.itemType = normalizedCategory;
  data.unit = data.unit || DEFAULT_INVENTORY_UNIT;
  data.minimumQuantity = normalizedMinimumQuantity;

  if (normalizedQuantity !== undefined) {
    data.quantity = normalizedQuantity;
  }

  if (normalizedPrice !== undefined) {
    data.price = normalizedPrice;
    data.unitPrice = normalizedPrice;
  }

  data.status = resolveInventoryStatus(data.quantity, data.minimumQuantity, data.status);

  return data;
};

const serializeInventoryItem = (item) => {
  const record = item?.toObject ? item.toObject() : { ...item };

  return {
    ...record,
    category: record.category || record.itemType || DEFAULT_INVENTORY_CATEGORY,
    itemType: record.itemType || record.category || DEFAULT_INVENTORY_CATEGORY,
    unit: record.unit || DEFAULT_INVENTORY_UNIT,
    minimumQuantity: record.minimumQuantity ?? 0,
    unitPrice: record.unitPrice ?? record.price ?? 0,
    price: record.price ?? record.unitPrice ?? 0,
  };
};

// Inventory Item Management

export let createInventoryItem = async (req, res) => {
  try {
    // Auto-generate itemCode if not provided
    if (!req.body.itemCode) {
      const lastItem = await Inventory.findOne().sort({ createdAt: -1 });
      const lastCode = lastItem ? parseInt(lastItem.itemCode.replace('INV', '')) : 0;
      req.body.itemCode = `INV${String(lastCode + 1).padStart(5, '0')}`;
    }

    const result = await Inventory.create(normalizeInventoryPayload(req.body));
    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: serializeInventoryItem(result),
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getAllInventoryItems = async (req, res) => {
  try {
    const { itemType, status, search, classId, subjectId } = req.query;
    let query = {};

    if (itemType) query.itemType = itemType;
    if (status) query.status = status;
    if (classId) query.applicableClasses = classId;
    if (subjectId) query.subject = subjectId;
    if (search) {
      query.$or = [
        { itemName: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await Inventory.find(query)
      .populate('applicableClasses')
      .populate('subject', 'subjectName subjectCode')
      .sort({ itemName: 1 });

    res.status(200).json({
      success: true,
      message: "Inventory items fetched successfully",
      data: result.map(serializeInventoryItem),
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let getInventoryItemById = async (req, res) => {
  try {
    const result = await Inventory.findById(req.params.id)
      .populate('applicableClasses')
      .populate('subject', 'subjectName subjectCode');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Item fetched successfully",
      data: serializeInventoryItem(result),
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let updateInventoryItem = async (req, res) => {
  try {
    const existingItem = await Inventory.findById(req.params.id);

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Item not found"
      });
    }

    const mergedPayload = {
      ...existingItem.toObject(),
      ...req.body,
    };

    delete mergedPayload._id;
    delete mergedPayload.__v;
    delete mergedPayload.createdAt;
    delete mergedPayload.updatedAt;

    const result = await Inventory.findByIdAndUpdate(
      req.params.id,
      normalizeInventoryPayload(mergedPayload),
      { new: true, runValidators: true }
    ).populate('applicableClasses')
      .populate('subject', 'subjectName subjectCode');

    res.status(200).json({
      success: true,
      message: "Item updated successfully",
      data: serializeInventoryItem(result),
    });
  } catch (error) {
    handleError(res, error);
  }
};

export let deleteInventoryItem = async (req, res) => {
  try {
    const distributionCount = await InventoryDistribution.countDocuments({ item: req.params.id });

    if (distributionCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete item with ${distributionCount} distribution record(s).`,
      });
    }

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
    const { studentId, itemId, quantity, paymentStatus, linkToFee, remarks } = req.body;
    const distributedBy = getRequestUserId(req);

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

    const unitPrice = item.unitPrice ?? item.price ?? 0;
    const totalAmount = unitPrice * quantity;
    let feeTransactionId = null;

    // If linked to fee, create a charge on the student's family ledger
    if (linkToFee && paymentStatus === 'Linked to Fee') {
      const student = await Student.findById(studentId).select('family name');
      if (!student || !student.family) {
        return res.status(400).json({
          success: false,
          message: "Student must be linked to a family before charging inventory to fees",
        });
      }

      const billNumber = await getNextNumericBillNumber(FeeTransaction);

      const feeTransaction = await postFamilyLedgerEntry({
        familyId: student.family,
        delta: totalAmount,
        transactionType: 'Charge',
        description: `${item.itemName} x${quantity} (${student.name})`,
        chargeAmount: totalAmount,
        billNumber,
        feeBreakdown: [{
          feeType: item.category || item.itemType,
          amount: totalAmount,
          student: studentId,
        }],
        createdBy: distributedBy,
      });

      feeTransactionId = feeTransaction._id;
    }

    // Create distribution record
    const distribution = await InventoryDistribution.create({
      student: studentId,
      item: itemId,
      quantity,
      price: unitPrice,
      totalAmount,
      paymentStatus: paymentStatus || 'Pending',
      feeTransaction: feeTransactionId,
      distributedBy,
      remarks
    });

    // Update inventory quantity
    item.quantity -= quantity;
    item.status = resolveInventoryStatus(item.quantity, item.minimumQuantity, item.status);
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
      if (startDate) {
        const parsedStart = parseDateInputForBoundary(startDate, { boundary: "start" });
        if (!parsedStart) {
          return res.status(400).json({ success: false, message: "Start date is invalid" });
        }
        query.distributionDate.$gte = parsedStart;
      }
      if (endDate) {
        const parsedEnd = parseDateInputForBoundary(endDate, { boundary: "end" });
        if (!parsedEnd) {
          return res.status(400).json({ success: false, message: "End date is invalid" });
        }
        query.distributionDate.$lte = parsedEnd;
      }
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
