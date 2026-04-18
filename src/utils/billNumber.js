const NUMERIC_BILL_NUMBER_REGEX = /^[0-9]+$/;

export const getNextNumericBillNumber = async (FeeTransactionModel) => {
  const charges = await FeeTransactionModel.find({
    transactionType: "Charge",
    billNumber: { $regex: NUMERIC_BILL_NUMBER_REGEX.source },
  }).select("billNumber");

  const maxBillNumber = charges.reduce((max, charge) => {
    const parsed = parseInt(charge.billNumber, 10);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, 0);

  return String(maxBillNumber + 1).padStart(6, "0");
};
