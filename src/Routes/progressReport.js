import { Router } from "express";
import {
  generateProgressReport,
  getProgressReport,
  getClassProgressReports,
  bulkGenerateProgressReports,
  generateProgressReportPDFController,
  downloadProgressReportPDF
} from "../Controller/progressReport.js";

let progressReportRouter = Router();

/**
 * @swagger
 * /api/progress-reports/generate:
 *   post:
 *     tags: [Progress Reports]
 *     summary: Generate progress report for a student
 *     description: Compiles all terminal marks and attendance data to create/update progress report
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentId
 *               - academicYear
 *             properties:
 *               studentId:
 *                 type: string
 *                 description: Student ObjectId
 *               academicYear:
 *                 type: string
 *                 description: Academic year (e.g., "2081-2082")
 *     responses:
 *       200:
 *         description: Progress report generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
progressReportRouter.route("/generate")
  .post(generateProgressReport);

/**
 * @swagger
 * /api/progress-reports/bulk-generate:
 *   post:
 *     tags: [Progress Reports]
 *     summary: Bulk generate progress reports for entire class
 *     description: Generates progress reports for all active students in a class
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classId
 *               - academicYear
 *             properties:
 *               classId:
 *                 type: string
 *                 description: Class ObjectId
 *               academicYear:
 *                 type: string
 *                 description: Academic year (e.g., "2081-2082")
 *     responses:
 *       200:
 *         description: Progress reports generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
progressReportRouter.route("/bulk-generate")
  .post(bulkGenerateProgressReports);

/**
 * @swagger
 * /api/progress-reports:
 *   get:
 *     tags: [Progress Reports]
 *     summary: Get progress report for a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *       - in: query
 *         name: academicYear
 *         required: true
 *         schema:
 *           type: string
 *         description: Academic year (e.g., "2081-2082")
 *     responses:
 *       200:
 *         description: Progress report fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Progress report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
progressReportRouter.route("/")
  .get(getProgressReport);

/**
 * @swagger
 * /api/progress-reports/class:
 *   get:
 *     tags: [Progress Reports]
 *     summary: Get all progress reports for a class
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
 *         description: Academic year (e.g., "2081-2082")
 *     responses:
 *       200:
 *         description: Progress reports fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
progressReportRouter.route("/class")
  .get(getClassProgressReports);

// Generate and download progress report PDF
progressReportRouter.route("/pdf/generate")
  .get(generateProgressReportPDFController);

progressReportRouter.route("/pdf/download")
  .get(downloadProgressReportPDF);

export default progressReportRouter;
