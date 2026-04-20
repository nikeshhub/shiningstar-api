import { Router } from "express";
import {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  triggerExamFeeGeneration,
  enterMarks,
  bulkEnterMarks,
  getStudentMarksheet,
  getStudentTerminalMarks,
  getClassResult,
  generateExamNotice,
  downloadExamNotice
} from "../Controller/exam.js";

let examRouter = Router();

/**
 * @swagger
 * /api/exams:
 *   post:
 *     tags: [Exams]
 *     summary: Create a new exam
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExamCreate'
 *     responses:
 *       201:
 *         description: Exam created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   get:
 *     tags: [Exams]
 *     summary: Get all exams
 *     description: Supports filtering by academicYear, examType, and status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *         description: Filter by academic year
 *       - in: query
 *         name: examType
 *         schema:
 *           type: string
 *           enum: [Terminal, Final, Unit Test, Other]
 *         description: Filter by exam type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Scheduled, Ongoing, Completed, Cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Exams fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
examRouter.route("/")
  .post(createExam)
  .get(getAllExams);

/**
 * @swagger
 * /api/exams/{id}:
 *   get:
 *     tags: [Exams]
 *     summary: Get exam by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam ObjectId
 *     responses:
 *       200:
 *         description: Exam fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Exams]
 *     summary: Update an exam
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam ObjectId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExamCreate'
 *     responses:
 *       200:
 *         description: Exam updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     tags: [Exams]
 *     summary: Delete an exam
 *     description: Cannot delete an exam that already has marks entered.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam ObjectId
 *     responses:
 *       200:
 *         description: Exam deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete exam with existing marks entries
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
examRouter.route("/:id")
  .get(getExamById)
  .put(updateExam)
  .delete(deleteExam);

// Manually trigger fee generation for an exam
examRouter.route("/:id/generate-fees")
  .post(triggerExamFeeGeneration);

/**
 * @swagger
 * /api/exams/marks/enter:
 *   post:
 *     tags: [Exams]
 *     summary: Enter marks for a student
 *     description: Calculates grades, GPA, percentage, and pass/fail result automatically. Creates or updates marks entry (one per student per exam).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnterMarksRequest'
 *     responses:
 *       201:
 *         description: Marks entered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       200:
 *         description: Marks updated successfully (existing entry)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
examRouter.route("/marks/enter")
  .post(enterMarks);

// Bulk enter marks for multiple students
examRouter.route("/marks/bulk-enter")
  .post(bulkEnterMarks);

/**
 * @swagger
 * /api/exams/marks/marksheet:
 *   get:
 *     tags: [Exams]
 *     summary: Get student marksheet for an exam
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
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam ObjectId
 *     responses:
 *       200:
 *         description: Marksheet fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Marksheet not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
examRouter.route("/marks/marksheet")
  .get(getStudentMarksheet);

// Get student marks by terminal (for progress reports)
examRouter.route("/marks/terminal")
  .get(getStudentTerminalMarks);

/**
 * @swagger
 * /api/exams/marks/class-result:
 *   get:
 *     tags: [Exams]
 *     summary: Get class results for an exam
 *     description: Returns ranked results for all students in a class with pass/fail statistics.
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
 *         name: examId
 *         required: true
 *         schema:
 *           type: string
 *         description: Exam ObjectId
 *     responses:
 *       200:
 *         description: Class result fetched successfully
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
 *                         results:
 *                           type: array
 *                           items:
 *                             type: object
 *                         statistics:
 *                           type: object
 *                           properties:
 *                             totalStudents:
 *                               type: integer
 *                             passed:
 *                               type: integer
 *                             failed:
 *                               type: integer
 *                             passPercentage:
 *                               type: string
 *                             averagePercentage:
 *                               type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
examRouter.route("/marks/class-result")
  .get(getClassResult);

// Generate and download exam notice PDF
examRouter.route("/:id/notice/generate")
  .post(generateExamNotice);

examRouter.route("/:id/notice/download")
  .get(downloadExamNotice);

export default examRouter;
