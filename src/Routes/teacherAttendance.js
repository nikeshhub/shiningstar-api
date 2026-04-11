import { Router } from "express";
import {
  getTeacherAttendance,
  createTeacherAttendance,
  updateTeacherAttendance,
  markTeacherAttendance
} from "../Controller/teacherAttendance.js";

let teacherAttendanceRouter = Router();

teacherAttendanceRouter.route("/")
  .get(getTeacherAttendance)
  .post(createTeacherAttendance);

teacherAttendanceRouter.route("/mark")
  .patch(markTeacherAttendance);

teacherAttendanceRouter.route("/:id")
  .patch(updateTeacherAttendance);

export default teacherAttendanceRouter;
