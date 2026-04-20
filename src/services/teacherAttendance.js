import { TeacherAttendance, Teacher } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getRequestUserId } from "../utils/requestUser.js";
import {
  getDayRangeFromInput,
  normalizeDateFields,
  parseDateInput,
  parseDateInputForBoundary,
} from "../utils/nepaliDate.js";

const getDayRange = (dateStr) => {
  return getDayRangeFromInput(dateStr || new Date());
};

// GET /api/teacher-attendance?date=&teacherId=&status=&from=&to=
export let getTeacherAttendance = async (req, res) => {
  try {
    const { date, teacherId, status, from, to } = req.query;
    const query = {};

    if (teacherId) query.teacher = teacherId;
    if (status) query.status = status;

    if (from || to) {
      const start = from
        ? parseDateInputForBoundary(from, { boundary: "start" })
        : new Date('1970-01-01');
      const end = to
        ? parseDateInputForBoundary(to, { boundary: "end" })
        : new Date();

      if ((from && !start) || (to && !end)) {
        return res.status(400).json({
          success: false,
          message: "Date range is invalid",
        });
      }

      query.date = { $gte: start, $lte: end };
    } else if (date) {
      const dayRange = getDayRange(date);
      if (!dayRange) {
        return res.status(400).json({
          success: false,
          message: "Date is invalid",
        });
      }
      const { start, end } = dayRange;
      query.date = { $gte: start, $lte: end };
    }

    const result = await TeacherAttendance.find(query)
      .populate('teacher', 'name email phone')
      .sort({ date: -1, 'teacher.name': 1 });

    res.status(200).json({
      success: true,
      message: "Teacher attendance fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// POST /api/teacher-attendance (manual mark)
export let createTeacherAttendance = async (req, res) => {
  try {
    const { teacher, date, status, remarks, deviceName } = req.body;

    if (!teacher || !date) {
      return res.status(400).json({
        success: false,
        message: "Teacher and date are required"
      });
    }

    const dayRange = getDayRange(date);
    if (!dayRange) {
      return res.status(400).json({
        success: false,
        message: "Date is invalid",
      });
    }

    const payload = normalizeDateFields(req.body, ["date", "inTime", "outTime"]);

    const exists = await TeacherAttendance.findOne({
      teacher,
      date: { $gte: dayRange.start, $lte: dayRange.end }
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this teacher on this date"
      });
    }

    const result = await TeacherAttendance.create({
      teacher,
      date: dayRange.start,
      status: status || 'Present',
      inTime: payload.inTime,
      outTime: payload.outTime,
      remarks,
      deviceName,
      markedBy: getRequestUserId(req)
    });

    res.status(201).json({
      success: true,
      message: "Teacher attendance created",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/teacher-attendance/:id (manual update)
export let updateTeacherAttendance = async (req, res) => {
  try {
    const updateData = normalizeDateFields(req.body, ["date", "inTime", "outTime"]);

    const result = await TeacherAttendance.findByIdAndUpdate(
      req.params.id,
      { ...updateData, markedBy: getRequestUserId(req) },
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher attendance updated",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// PATCH /api/teacher-attendance/mark (device in/out)
export let markTeacherAttendance = async (req, res) => {
  try {
    const { teacherId, date, type, time, deviceName } = req.body;

    if (!teacherId || !type) {
      return res.status(400).json({
        success: false,
        message: "teacherId and type are required"
      });
    }

    if (!['in', 'out'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "type must be 'in' or 'out'"
      });
    }

    const dayRange = getDayRange(date);
    if (!dayRange) {
      return res.status(400).json({
        success: false,
        message: "Date is invalid",
      });
    }
    const { start, end } = dayRange;

    let record = await TeacherAttendance.findOne({
      teacher: teacherId,
      date: { $gte: start, $lte: end }
    });

    if (!record) {
      record = await TeacherAttendance.create({
        teacher: teacherId,
        date: start,
        status: 'Present',
        deviceName
      });
    }

    if (type === 'in') {
      if (record.inTime) {
        return res.status(409).json({
          success: false,
          message: "In time already marked"
        });
      }
      const parsedInTime = time ? parseDateInput(time) : new Date();
      if (!parsedInTime) {
        return res.status(400).json({
          success: false,
          message: "In time is invalid",
        });
      }
      record.inTime = parsedInTime;
    }

    if (type === 'out') {
      if (record.outTime) {
        return res.status(409).json({
          success: false,
          message: "Out time already marked"
        });
      }
      const parsedOutTime = time ? parseDateInput(time) : new Date();
      if (!parsedOutTime) {
        return res.status(400).json({
          success: false,
          message: "Out time is invalid",
        });
      }
      record.outTime = parsedOutTime;
    }

    if (deviceName) record.deviceName = deviceName;
    await record.save();

    res.status(200).json({
      success: true,
      message: "Attendance marked successfully",
      data: record,
    });
  } catch (error) {
    handleError(res, error);
  }
};
