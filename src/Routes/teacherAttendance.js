import { Router } from "express";
import {
  getTeacherAttendance,
  createTeacherAttendance,
  updateTeacherAttendance,
  markTeacherAttendance
} from "../Controller/teacherAttendance.js";
import { authorize } from "../Middleware/auth.js";

let teacherAttendanceRouter = Router();

teacherAttendanceRouter.route("/")
  .get(authorize('Admin'), getTeacherAttendance)
  .post(authorize('Admin'), createTeacherAttendance);

teacherAttendanceRouter.route("/mark")
  .patch(authorize('Admin'), markTeacherAttendance);

teacherAttendanceRouter.route("/:id")
  .patch(authorize('Admin'), updateTeacherAttendance);

export default teacherAttendanceRouter;
