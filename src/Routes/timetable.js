import { Router } from "express";
import { getTimetable, setTimetable } from "../Controller/timetable.js";

let timetableRouter = Router();

// GET /api/timetable?classId=&teacherId=
timetableRouter.route("/")
  .get(getTimetable)
  .put(setTimetable);

export default timetableRouter;
