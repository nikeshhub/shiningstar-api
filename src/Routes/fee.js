import { Router } from "express";
import {
  createFeeStructure,
  getFeeStructureByClass,
  createCharge,
  createPayment,
  getStudentLedger,
  getDuesList,
  getFeeCollectionSummary,
  generateBillNumber,
  createFamilyCharge,
  createFamilyPayment,
  getFamilyLedger
} from "../Controller/fee.js";

let feeRouter = Router();

/**
 * @swagger
 * /api/fee/structure:
 *   post:
 *     tags: [Fees]
 *     summary: Create a fee structure for a class
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeStructureCreate'
 *     responses:
 *       201:
 *         description: Fee structure created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   get:
 *     tags: [Fees]
 *     summary: Get fee structure by class and year
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
 *       - in: query
 *         name: academicYear
 *         required: true
 *         schema:
 *           type: string
 *         description: Academic year (e.g. 2081-2082)
 *     responses:
 *       200:
 *         description: Fee structure fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
feeRouter.route("/structure")
  .post(createFeeStructure)
  .get(getFeeStructureByClass);

/**
 * @swagger
 * /api/fee/charge:
 *   post:
 *     tags: [Fees]
 *     summary: Create a fee charge entry
 *     description: Adds a charge to a student's ledger. Calculates running balance based on previous transactions.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeChargeRequest'
 *     responses:
 *       201:
 *         description: Fee charged successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
feeRouter.route("/charge")
  .post(createCharge);

/**
 * @swagger
 * /api/fee/payment:
 *   post:
 *     tags: [Fees]
 *     summary: Record a fee payment
 *     description: Records a payment against a student's ledger. Reduces dues or increases advance balance.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeePaymentRequest'
 *     responses:
 *       201:
 *         description: Payment recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
feeRouter.route("/payment")
  .post(createPayment);

/**
 * @swagger
 * /api/fee/ledger/{studentId}:
 *   get:
 *     tags: [Fees]
 *     summary: Get fee ledger for a student
 *     description: Returns all transactions (charges and payments) with running balance history.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter end date
 *     responses:
 *       200:
 *         description: Ledger fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         student:
 *                           type: object
 *                         transactions:
 *                           type: array
 *                           items:
 *                             type: object
 *                         currentBalance:
 *                           type: object
 *                           properties:
 *                             totalDue:
 *                               type: number
 *                             totalAdvance:
 *                               type: number
 *                             netBalance:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
feeRouter.route("/ledger/:studentId")
  .get(getStudentLedger);

/**
 * @swagger
 * /api/fee/dues:
 *   get:
 *     tags: [Fees]
 *     summary: Get dues list
 *     description: Returns students with outstanding dues, sorted by amount descending.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *         description: Filter by class ObjectId
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Minimum due amount threshold (default 0)
 *     responses:
 *       200:
 *         description: Dues list fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         students:
 *                           type: array
 *                           items:
 *                             type: object
 *                         totalDues:
 *                           type: number
 *                         count:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
feeRouter.route("/dues")
  .get(getDuesList);

/**
 * @swagger
 * /api/fee/collection-summary:
 *   get:
 *     tags: [Fees]
 *     summary: Get fee collection summary
 *     description: Returns total collection, transaction count, and breakdown by payment method.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date filter
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date filter
 *       - in: query
 *         name: classId
 *         schema:
 *           type: string
 *         description: Filter by class ObjectId
 *     responses:
 *       200:
 *         description: Collection summary fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalCollection:
 *                           type: number
 *                         transactionCount:
 *                           type: integer
 *                         byPaymentMethod:
 *                           type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
feeRouter.route("/collection-summary")
  .get(getFeeCollectionSummary);

/**
 * @swagger
 * /api/fee/generate-bill-number:
 *   get:
 *     tags: [Fees]
 *     summary: Generate next bill number
 *     description: Returns the next sequential 6-digit bill number for charge entries.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Bill number generated
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         billNumber:
 *                           type: string
 *                           example: '000042'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
feeRouter.route("/generate-bill-number")
  .get(generateBillNumber);

// Family billing routes
feeRouter.route("/family/charge")
  .post(createFamilyCharge);

feeRouter.route("/family/payment")
  .post(createFamilyPayment);

feeRouter.route("/family/ledger/:familyId")
  .get(getFamilyLedger);

export default feeRouter;
