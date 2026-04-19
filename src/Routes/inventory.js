import { Router } from "express";
import {
  createInventoryItem,
  getAllInventoryItems,
  getInventoryItemById,
  updateInventoryItem,
  deleteInventoryItem,
  distributeItem,
  getStudentDistributions,
  getAllDistributions
} from "../Controller/inventory.js";
import { authorize } from "../Middleware/auth.js";

let inventoryRouter = Router();

/**
 * @swagger
 * /api/inventory:
 *   post:
 *     tags: [Inventory]
 *     summary: Create an inventory item
 *     description: Creates an inventory item. itemCode is auto-generated (INV00001 format) if not provided.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryCreate'
 *     responses:
 *       201:
 *         description: Inventory item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Item code already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Inventory]
 *     summary: Get all inventory items
 *     description: Supports filtering by itemType, status, and searching by name or code.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Uniform, Books, Stationery]
 *         description: Filter by item type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Available, Out of Stock, Discontinued]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by item name or code
 *     responses:
 *       200:
 *         description: Inventory items fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
inventoryRouter.route("/")
  .post(authorize('Admin'), createInventoryItem)
  .get(authorize('Admin'), getAllInventoryItems);

/**
 * @swagger
 * /api/inventory/{id}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get inventory item by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ObjectId
 *     responses:
 *       200:
 *         description: Item fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Inventory]
 *     summary: Update an inventory item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ObjectId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InventoryCreate'
 *     responses:
 *       200:
 *         description: Item updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Inventory]
 *     summary: Delete an inventory item
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Inventory item ObjectId
 *     responses:
 *       200:
 *         description: Item deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
inventoryRouter.route("/:id")
  .get(authorize('Admin'), getInventoryItemById)
  .put(authorize('Admin'), updateInventoryItem)
  .delete(authorize('Admin'), deleteInventoryItem);

/**
 * @swagger
 * /api/inventory/distribution/distribute:
 *   post:
 *     tags: [Inventory]
 *     summary: Distribute an inventory item to a student
 *     description: Distributes item, decrements stock. Optionally links to fee system (creates a charge entry).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DistributeRequest'
 *     responses:
 *       201:
 *         description: Item distributed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Insufficient stock
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
inventoryRouter.route("/distribution/distribute")
  .post(authorize('Admin'), distributeItem);

/**
 * @swagger
 * /api/inventory/distribution/student/{studentId}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get distributions for a specific student
 *     description: Returns all items distributed to a student with payment summary.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *     responses:
 *       200:
 *         description: Distributions fetched successfully
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
 *                         distributions:
 *                           type: array
 *                           items:
 *                             type: object
 *                         summary:
 *                           type: object
 *                           properties:
 *                             totalAmount:
 *                               type: number
 *                             paidAmount:
 *                               type: number
 *                             pendingAmount:
 *                               type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
inventoryRouter.route("/distribution/student/:studentId")
  .get(authorize('Admin'), getStudentDistributions);

/**
 * @swagger
 * /api/inventory/distribution/all:
 *   get:
 *     tags: [Inventory]
 *     summary: Get all distributions
 *     description: Returns all item distributions with optional filtering.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: itemType
 *         schema:
 *           type: string
 *           enum: [Uniform, Books, Stationery]
 *         description: Filter by item type
 *       - in: query
 *         name: paymentStatus
 *         schema:
 *           type: string
 *           enum: [Paid, Pending, Linked to Fee]
 *         description: Filter by payment status
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
 *     responses:
 *       200:
 *         description: Distributions fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
inventoryRouter.route("/distribution/all")
  .get(authorize('Admin'), getAllDistributions);

export default inventoryRouter;
