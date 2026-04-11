import { Router } from "express";
import {
  markAttendance,
  getAttendanceByDate,
  getStudentAttendanceReport,
  getClassMonthlyReport,
  getAbsentStudents
} from "../Controller/attendance.js";

let attendanceRouter = Router();

/**
 * @swagger
 * /api/attendance:
 *   post:
 *     tags: [Attendance]
 *     summary: Mark attendance for a class
 *     description: Creates or updates attendance record for a class on a given date. One record per class per day (upsert).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AttendanceMarkRequest'
 *     responses:
 *       201:
 *         description: Attendance marked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       200:
 *         description: Attendance updated successfully (existing record)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
attendanceRouter.route("/")
  .post(markAttendance);

/**
 * @swagger
 * /api/attendance/date:
 *   get:
 *     tags: [Attendance]
 *     summary: Get attendance for a class on a specific date
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
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Attendance fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
attendanceRouter.route("/date")
  .get(getAttendanceByDate);

/**
 * @swagger
 * /api/attendance/student-report:
 *   get:
 *     tags: [Attendance]
 *     summary: Get attendance report for a specific student
 *     description: Returns summary (present/absent/late/excused counts and percentage) plus daily records.
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
 *         description: Attendance report fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AttendanceReport'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Student not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
attendanceRouter.route("/student-report")
  .get(getStudentAttendanceReport);

/**
 * @swagger
 * /api/attendance/monthly-report:
 *   get:
 *     tags: [Attendance]
 *     summary: Get monthly attendance report for a class
 *     description: Returns per-student attendance statistics for a given month/year.
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
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Month number (1-12)
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *         description: Year (e.g. 2081)
 *     responses:
 *       200:
 *         description: Monthly report fetched successfully
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
 *                         month:
 *                           type: integer
 *                         year:
 *                           type: integer
 *                         totalWorkingDays:
 *                           type: integer
 *                         studentAttendance:
 *                           type: array
 *                           items:
 *                             type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
attendanceRouter.route("/monthly-report")
  .get(getClassMonthlyReport);

/**
 * @swagger
 * /api/attendance/absent:
 *   get:
 *     tags: [Attendance]
 *     summary: Get list of absent students for a class on a date
 *     description: Returns students marked as Absent on the specified date.
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
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Absent students fetched successfully
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
 *                         type: object
 *                         properties:
 *                           student:
 *                             type: object
 *                           remarks:
 *                             type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: No attendance record found for this date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
attendanceRouter.route("/absent")
  .get(getAbsentStudents);

export default attendanceRouter;
