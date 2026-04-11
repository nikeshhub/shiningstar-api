import { TeacherAttendance, Teacher } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

const getDayRange = (dateStr) => {
  const date = dateStr ? new Date(dateStr) : new Date();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

// GET /api/teacher-attendance?date=&teacherId=&status=&from=&to=
export let getTeacherAttendance = async (req, res) => {
  try {
    const { date, teacherId, status, from, to } = req.query;
    const query = {};

    if (teacherId) query.teacher = teacherId;
    if (status) query.status = status;

    if (from || to) {
      const start = from ? new Date(from) : new Date('1970-01-01');
      const end = to ? new Date(to) : new Date();
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    } else if (date) {
      const { start, end } = getDayRange(date);
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
    const { teacher, date, status, inTime, outTime, remarks, deviceName } = req.body;

    if (!teacher || !date) {
      return res.status(400).json({
        success: false,
        message: "Teacher and date are required"
      });
    }

    const exists = await TeacherAttendance.findOne({
      teacher,
      date: { $gte: new Date(date).setHours(0, 0, 0, 0), $lte: new Date(date).setHours(23, 59, 59, 999) }
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Attendance already marked for this teacher on this date"
      });
    }

    const result = await TeacherAttendance.create({
      teacher,
      date,
      status: status || 'Present',
      inTime,
      outTime,
      remarks,
      deviceName,
      markedBy: req.user?._id
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
    const result = await TeacherAttendance.findByIdAndUpdate(
      req.params.id,
      { ...req.body, markedBy: req.user?._id },
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

    const { start, end } = getDayRange(date);
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
      record.inTime = time ? new Date(time) : new Date();
    }

    if (type === 'out') {
      if (record.outTime) {
        return res.status(409).json({
          success: false,
          message: "Out time already marked"
        });
      }
      record.outTime = time ? new Date(time) : new Date();
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
