import { Router } from "express";
import {
  createCharge,
  createPayment,
  getFamilyLedger,
  getTransactionById,
  getDuesList,
  getFeeCollectionSummary,
  generateBillNumber,
} from "../Controller/fee.js";
import { authorize } from "../Middleware/auth.js";

let feeRouter = Router();

/**
 * @swagger
 * /api/fee/charge:
 *   post:
 *     tags: [Fees]
 *     summary: Create a fee charge entry on a family ledger
 *     description: Adds a charge to a family's ledger. Calculates running balance from previous family transactions.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [familyId, description, chargeAmount]
 *             properties:
 *               familyId: { type: string }
 *               description: { type: string }
 *               chargeAmount: { type: number }
 *               billNumber: { type: string }
 *               feeMonth: { type: string }
 *               feeBreakdown:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     feeType: { type: string }
 *                     amount: { type: number }
 *                     student: { type: string }
 *     responses:
 *       201: { description: Fee charged successfully }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: Family not found }
 */
feeRouter.route("/charge").post(authorize('Admin'), createCharge);

/**
 * @swagger
 * /api/fee/payment:
 *   post:
 *     tags: [Fees]
 *     summary: Record a fee payment against a family ledger
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [familyId, paidAmount]
 *             properties:
 *               familyId: { type: string }
 *               paidAmount: { type: number }
 *               paymentMethod:
 *                 type: string
 *                 enum: [Cash, Bank Transfer, Cheque, Online]
 *               chequeNumber: { type: string }
 *               transactionReference: { type: string }
 *               description: { type: string }
 *               feeMonths: { type: string }
 *     responses:
 *       201: { description: Payment recorded successfully }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: Family not found }
 */
feeRouter.route("/payment").post(authorize('Admin'), createPayment);

/**
 * @swagger
 * /api/fee/ledger/{familyId}:
 *   get:
 *     tags: [Fees]
 *     summary: Get fee ledger for a family
 *     description: Returns all transactions for the family with the current running balance.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: familyId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         description: Optional BS date (YYYY-MM-DD) lower bound, inclusive
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Optional BS date (YYYY-MM-DD) upper bound, inclusive
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Ledger fetched successfully }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
feeRouter.route("/ledger/:familyId").get(authorize('Admin', 'Parent'), getFamilyLedger);

/**
 * @swagger
 * /api/fee/transaction/{id}:
 *   get:
 *     tags: [Fees]
 *     summary: Get a single fee transaction (bill or receipt) by id
 *     description: Returns the transaction along with the related family and its students. Used by the bill/receipt preview page.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Transaction fetched successfully }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { description: Transaction not found }
 */
feeRouter.route("/transaction/:id").get(authorize('Admin', 'Parent'), getTransactionById);

/**
 * @swagger
 * /api/fee/dues:
 *   get:
 *     tags: [Fees]
 *     summary: Get families with outstanding dues
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema: { type: string }
 *       - in: query
 *         name: minAmount
 *         schema: { type: number }
 *     responses:
 *       200: { description: Dues list fetched successfully }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
feeRouter.route("/dues").get(authorize('Admin'), getDuesList);

/**
 * @swagger
 * /api/fee/collection-summary:
 *   get:
 *     tags: [Fees]
 *     summary: Get fee collection summary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         description: Optional BS date (YYYY-MM-DD) lower bound, inclusive
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         description: Optional BS date (YYYY-MM-DD) upper bound, inclusive
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: classId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Collection summary fetched successfully }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
feeRouter.route("/collection-summary").get(authorize('Admin'), getFeeCollectionSummary);

/**
 * @swagger
 * /api/fee/generate-bill-number:
 *   get:
 *     tags: [Fees]
 *     summary: Generate next sequential bill number
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Bill number generated }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 */
feeRouter.route("/generate-bill-number").get(authorize('Admin'), generateBillNumber);


export default feeRouter;
