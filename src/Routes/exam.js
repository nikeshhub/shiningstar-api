import { Router } from "express";
import {
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  enterMarks,
  bulkEnterMarks,
  deleteMarks,
  getStudentMarksheet,
  getStudentTerminalMarks,
  getClassResult,
  generateExamNotice,
  downloadExamNotice
} from "../Controller/exam.js";
import { authorize } from "../Middleware/auth.js";

let examRouter = Router();

/**
 * @swagger
 * /api/exams:
 *   post:
 *     tags: [Exams]
 *     summary: Create a new terminal exam
 *     description: Every exam is a terminal (1-4). On creation, terminal fees equal to class.monthlyFee × 3 are auto-charged to each student's family.
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
 *         description: Exam created and fees charged
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *   get:
 *     tags: [Exams]
 *     summary: Get all exams
 *     description: Supports filtering by academicYear, terminalNumber, and status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: academicYear
 *         schema:
 *           type: string
 *       - in: query
 *         name: terminalNumber
 *         schema:
 *           type: integer
 *           enum: [1, 2, 3, 4]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Scheduled, Ongoing, Completed, Cancelled]
 *     responses:
 *       200:
 *         description: Exams fetched successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
examRouter.route("/")
  .post(authorize('Admin'), createExam)
  .get(authorize('Admin', 'Teacher'), getAllExams);

/**
 * @swagger
 * /api/exams/{id}:
 *   get:
 *     tags: [Exams]
 *     summary: Get exam by ID
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Exam fetched successfully }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Exams]
 *     summary: Update an exam
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Exam updated successfully }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   delete:
 *     tags: [Exams]
 *     summary: Delete an exam
 *     description: Cannot delete an exam that already has marks entered.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Exam deleted successfully }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { description: Cannot delete exam with existing marks entries }
 */
examRouter.route("/:id")
  .get(authorize('Admin', 'Teacher'), getExamById)
  .put(authorize('Admin'), updateExam)
  .delete(authorize('Admin'), deleteExam);

/**
 * @swagger
 * /api/exams/marks/enter:
 *   post:
 *     tags: [Exams]
 *     summary: Enter or update marks for a student
 *     description: Upserts on (student, exam). Calculates grades, GPA, and pass/fail. Validates writtenMarks ≤ subject.writtenMarks and practicalMarks ≤ subject.practicalMarks.
 *     security: [{ bearerAuth: [] }]
 */
examRouter.route("/marks/enter")
  .post(authorize('Admin', 'Teacher'), enterMarks);

// Bulk enter marks for multiple students
examRouter.route("/marks/bulk-enter")
  .post(authorize('Admin', 'Teacher'), bulkEnterMarks);

// Delete a single marks entry (e.g. after a data-entry mistake)
examRouter.route("/marks/:id")
  .delete(authorize('Admin', 'Teacher'), deleteMarks);

/**
 * @swagger
 * /api/exams/marks/marksheet:
 *   get:
 *     tags: [Exams]
 *     summary: Get student marksheet for an exam
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: studentId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: examId
 *         required: true
 *         schema: { type: string }
 */
examRouter.route("/marks/marksheet")
  .get(authorize('Admin', 'Teacher', 'Parent'), getStudentMarksheet);

// Get student marks by terminal (for progress reports)
examRouter.route("/marks/terminal")
  .get(authorize('Admin', 'Teacher', 'Parent'), getStudentTerminalMarks);

/**
 * @swagger
 * /api/exams/marks/class-result:
 *   get:
 *     tags: [Exams]
 *     summary: Get class results for an exam
 *     description: Returns ranked results for all students in a class with pass/fail statistics.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: classId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: examId
 *         required: true
 *         schema: { type: string }
 */
examRouter.route("/marks/class-result")
  .get(authorize('Admin', 'Teacher'), getClassResult);

// Generate and download exam notice PDF
examRouter.route("/:id/notice/generate")
  .post(authorize('Admin'), generateExamNotice);

examRouter.route("/:id/notice/download")
  .get(authorize('Admin', 'Teacher'), downloadExamNotice);

export default examRouter;
