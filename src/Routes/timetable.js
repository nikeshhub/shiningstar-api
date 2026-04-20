import { Router } from "express";
import { getTimetable, setTimetable } from "../Controller/timetable.js";
import { authorize } from "../Middleware/auth.js";

let timetableRouter = Router();

// GET /api/timetable?classId=&teacherId=
timetableRouter.route("/")
  .get(authorize('Admin', 'Teacher', 'Parent'), getTimetable)
  .put(authorize('Admin'), setTimetable);

export default timetableRouter;
