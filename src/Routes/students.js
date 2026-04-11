import { Router } from "express";
import {
  createStudent,
  readAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  promoteStudents,
  getEnrollmentHistory,
  updateGPSLocation
} from "../Controller/students.js";
import { authenticate, authorize } from "../Middleware/auth.js";
import { uploadStudentDocuments } from "../Middleware/upload.js";

let studentRouter = Router();

// Apply authentication to all student routes
studentRouter.use(authenticate);

/**
 * @swagger
 * /api/students:
 *   post:
 *     tags: [Students]
 *     summary: Create a new student
 *     description: Creates a student record. studentId is auto-generated (STU00001 format) if not provided. Status is forced to Active. Supports file uploads for photo and birth certificate.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/StudentCreate'
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentCreate'
 *     responses:
 *       201:
 *         description: Student added successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *   get:
 *     tags: [Students]
 *     summary: Get all students
 *     description: Supports filtering by class, status, and search (name, studentId, parentContact).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: class
 *         schema:
 *           type: string
 *         description: Filter by class ObjectId
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive, Transferred, Graduated]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, studentId or parentContact
 *     responses:
 *       200:
 *         description: Students fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StudentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
studentRouter.route("/")
  .post(authorize('Admin', 'Teacher'), uploadStudentDocuments, createStudent)
  .get(authorize('Admin', 'Teacher'), readAllStudents);

/**
 * @swagger
 * /api/students/promote:
 *   post:
 *     tags: [Students]
 *     summary: Promote or repeat students
 *     description: Moves selected students to a new class/year. Snapshots current enrollment into enrollmentHistory before updating. Use action 'repeat' to keep students in the same class for a new year.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PromoteRequest'
 *     responses:
 *       200:
 *         description: Students promoted/repeated successfully
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
 *                         modifiedCount:
 *                           type: integer
 *                         action:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: No active students found with provided IDs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
studentRouter.route("/promote")
  .post(authorize('Admin'), promoteStudents);

/**
 * @swagger
 * /api/students/{id}:
 *   get:
 *     tags: [Students]
 *     summary: Get student by ID
 *     description: Returns student with populated class and class teacher details.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *     responses:
 *       200:
 *         description: Student fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Students]
 *     summary: Update a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentCreate'
 *     responses:
 *       200:
 *         description: Student updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/StudentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *   delete:
 *     tags: [Students]
 *     summary: Delete a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *     responses:
 *       200:
 *         description: Student deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
studentRouter.route("/:id")
  .get(authorize('Admin', 'Teacher'), getStudentById)
  .put(authorize('Admin', 'Teacher'), uploadStudentDocuments, updateStudent)
  .delete(authorize('Admin'), deleteStudent);

/**
 * @swagger
 * /api/students/{id}/history:
 *   get:
 *     tags: [Students]
 *     summary: Get enrollment history for a student
 *     description: Returns a timeline of class/year transitions including the current enrollment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *     responses:
 *       200:
 *         description: Enrollment history fetched successfully
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
 *                         studentId:
 *                           type: string
 *                         name:
 *                           type: string
 *                         history:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               class:
 *                                 type: string
 *                               academicYear:
 *                                 type: string
 *                               action:
 *                                 type: string
 *                               actionDate:
 *                                 type: string
 *                                 format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
studentRouter.route("/:id/history")
  .get(authorize('Admin', 'Teacher'), getEnrollmentHistory);

/**
 * @swagger
 * /api/students/{id}/gps:
 *   put:
 *     tags: [Students]
 *     summary: Update GPS location for a student
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Student ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GPSUpdateRequest'
 *     responses:
 *       200:
 *         description: GPS location updated
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
 *                         latitude:
 *                           type: number
 *                         longitude:
 *                           type: number
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
studentRouter.route("/:id/gps")
  .put(authorize('Admin', 'Teacher', 'Parent'), updateGPSLocation);

export default studentRouter;
