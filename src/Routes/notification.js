import { Router } from "express";
import { authorize } from "../Middleware/auth.js";
import {
  createNotification,
  getAllNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  sendNotification,
  sendFeeReminder,
  sendAbsenceAlert
} from "../Controller/notification.js";

let notificationRouter = Router();

notificationRouter.use(authorize("Admin"));

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     tags: [Notifications]
 *     summary: Create a notification
 *     description: Creates a notification draft. Recipients are resolved based on targetAudience (All Parents, Class-wise, Custom Group, Individual).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationCreate'
 *     responses:
 *       201:
 *         description: Notification created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   get:
 *     tags: [Notifications]
 *     summary: Get all notifications
 *     description: Supports filtering by status and targetAudience.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Draft, Scheduled, Sent, Failed]
 *         description: Filter by status
 *       - in: query
 *         name: targetAudience
 *         schema:
 *           type: string
 *           enum: [All Parents, Class-wise, Custom Group, Individual]
 *         description: Filter by target audience
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationRouter.route("/")
  .post(createNotification)
  .get(getAllNotifications);

/**
 * @swagger
 * /api/notifications/{id}:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ObjectId
 *     responses:
 *       200:
 *         description: Notification fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Notifications]
 *     summary: Update a notification
 *     description: Cannot update a notification that has already been sent.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ObjectId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationCreate'
 *     responses:
 *       200:
 *         description: Notification updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot update a sent notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     description: Cannot delete a notification that has already been sent.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ObjectId
 *     responses:
 *       200:
 *         description: Notification deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete a sent notification
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationRouter.route("/:id")
  .get(getNotificationById)
  .put(updateNotification)
  .delete(deleteNotification);

/**
 * @swagger
 * /api/notifications/{id}/send:
 *   post:
 *     tags: [Notifications]
 *     summary: Send a notification
 *     description: Sends the notification to all resolved recipients via configured channels (SMS, Email, Push). Marks as Sent with success/failure counts.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ObjectId
 *     responses:
 *       200:
 *         description: Notification sent successfully
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
 *                         totalRecipients:
 *                           type: integer
 *                         successCount:
 *                           type: integer
 *                         failureCount:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Notification already sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationRouter.route("/:id/send")
  .post(sendNotification);

/**
 * @swagger
 * /api/notifications/alerts/fee-reminder:
 *   post:
 *     tags: [Notifications]
 *     summary: Send fee reminder to students with dues
 *     description: Automatically identifies students with dues above threshold and sends a reminder notification.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FeeReminderRequest'
 *     responses:
 *       200:
 *         description: Fee reminder sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: No students found with pending dues
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
notificationRouter.route("/alerts/fee-reminder")
  .post(sendFeeReminder);

/**
 * @swagger
 * /api/notifications/alerts/absence:
 *   post:
 *     tags: [Notifications]
 *     summary: Send absence alert to parents
 *     description: Sends absence notification to parents of specified students for a given date.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AbsenceAlertRequest'
 *     responses:
 *       201:
 *         description: Absence alert sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationRouter.route("/alerts/absence")
  .post(sendAbsenceAlert);

export default notificationRouter;
