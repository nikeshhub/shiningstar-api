import { Router } from "express";
import {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  getClassStudents,
  getTimetable,
  setTimetable,
  updateClassSubjectBook
} from "../Controller/class.js";
import { authorize } from "../Middleware/auth.js";

let classRouter = Router();

/**
 * @swagger
 * /api/classes:
 *   post:
 *     tags: [Classes]
 *     summary: Create a new class
 *     description: Creates a class. Status is forced to Active on creation.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClassCreate'
 *     responses:
 *       201:
 *         description: Class created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ClassPopulated'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Class name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Classes]
 *     summary: Get all classes
 *     description: Returns classes with populated classTeacher, subjects, and timetable.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Active, Inactive]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Classes fetched successfully
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
 *                         $ref: '#/components/schemas/ClassPopulated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
classRouter.route("/")
  .post(authorize('Admin'), createClass)
  .get(authorize('Admin', 'Teacher', 'Parent'), getAllClasses);

/**
 * @swagger
 * /api/classes/{id}:
 *   get:
 *     tags: [Classes]
 *     summary: Get class by ID
 *     description: Returns class details including enrolled students, student count, and total monthly revenue.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
 *     responses:
 *       200:
 *         description: Class fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ClassPopulated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Classes]
 *     summary: Update a class
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClassCreate'
 *     responses:
 *       200:
 *         description: Class updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/ClassPopulated'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         $ref: '#/components/responses/Conflict'
 *   delete:
 *     tags: [Classes]
 *     summary: Delete a class
 *     description: Cannot delete a class that has active students enrolled.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
 *     responses:
 *       200:
 *         description: Class deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete class with active students
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
classRouter.route("/:id")
  .get(authorize('Admin', 'Teacher', 'Parent'), getClassById)
  .put(authorize('Admin'), updateClass)
  .delete(authorize('Admin'), deleteClass);

/**
 * @swagger
 * /api/classes/{id}/students:
 *   get:
 *     tags: [Classes]
 *     summary: Get all active students in a class
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
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
classRouter.route("/:id/students")
  .get(authorize('Admin', 'Teacher', 'Parent'), getClassStudents);

/**
 * @swagger
 * /api/classes/{id}/timetable:
 *   get:
 *     tags: [Classes]
 *     summary: Get timetable for a class
 *     description: Returns the weekly timetable with populated subject and teacher references.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
 *     responses:
 *       200:
 *         description: Timetable fetched successfully
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
 *                         $ref: '#/components/schemas/TimetableSlot'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   put:
 *     tags: [Classes]
 *     summary: Set (replace) timetable for a class
 *     description: Replaces the entire timetable. Each slot has a day (Mon-Sat), period (1-7), subject and teacher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Class ObjectId
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TimetableSetRequest'
 *     responses:
 *       200:
 *         description: Timetable updated successfully
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
 *                         $ref: '#/components/schemas/TimetableSlot'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
classRouter.route("/:id/timetable")
  .get(authorize('Admin', 'Teacher', 'Parent'), getTimetable)
  .put(authorize('Admin'), setTimetable);

// Update book details for a subject in a class
classRouter.route("/:classId/subjects/:subjectId/book")
  .put(authorize('Admin'), updateClassSubjectBook);

export default classRouter;
