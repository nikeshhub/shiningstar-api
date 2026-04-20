import { Attendance, Student, Class } from "../Model/model.js";
import { isValidObjectId } from "mongoose";
import { handleError } from "../utils/errorHandler.js";
import {
  formatBSDate,
  getBSMonthRange,
  getDayRangeFromInput,
  parseDateInputForBoundary,
} from "../utils/nepaliDate.js";
import { createAndSendNotification } from "./notificationEngine.js";
import { getRequestTeacherId, getRequestUserId } from "../utils/requestUser.js";
import {
  canParentAccessStudent,
  canTeacherAccessClassId,
  canTeacherAccessStudent,
  normalizeObjectId,
} from "../utils/accessScope.js";

const ATTENDANCE_STATUSES = new Set(["Present", "Absent", "Late", "Excused"]);

const validateClassAttendanceRoster = async ({ classId, students }) => {
  if (!classId) {
    return {
      status: 400,
      message: "Class is required",
    };
  }

  if (!isValidObjectId(classId)) {
    return {
      status: 400,
      message: "Class ID is invalid",
    };
  }

  if (!Array.isArray(students) || students.length === 0) {
    return {
      status: 400,
      message: "At least one student attendance record is required",
    };
  }

  const classExists = await Class.exists({ _id: classId });
  if (!classExists) {
    return {
      status: 404,
      message: "Class not found",
    };
  }

  const studentIds = students.map((record) => normalizeObjectId(record?.student));
  if (studentIds.some((studentId) => !studentId)) {
    return {
      status: 400,
      message: "Every attendance record must include a student",
    };
  }

  const invalidStudentId = studentIds.find((studentId) => !isValidObjectId(studentId));
  if (invalidStudentId) {
    return {
      status: 400,
      message: "Attendance contains an invalid student ID",
    };
  }

  const invalidStatusRecord = students.find((record) => !ATTENDANCE_STATUSES.has(record?.status));
  if (invalidStatusRecord) {
    return {
      status: 400,
      message: "Attendance status is invalid",
    };
  }

  const uniqueStudentIds = [...new Set(studentIds)];
  if (uniqueStudentIds.length !== studentIds.length) {
    return {
      status: 400,
      message: "Duplicate students are not allowed in attendance",
    };
  }

  const rosterStudents = await Student.find({
    _id: { $in: uniqueStudentIds },
    currentClass: classId,
    status: "Active",
  }).select("_id");
  const rosterStudentIds = new Set(rosterStudents.map((student) => normalizeObjectId(student._id)));
  const outsideClassStudent = uniqueStudentIds.find((studentId) => !rosterStudentIds.has(studentId));

  if (outsideClassStudent) {
    return {
      status: 403,
      message: "Attendance can only include active students from the selected class.",
    };
  }

  return null;
};

const filterAttendanceToClassRoster = (attendance, classId) => {
  if (!attendance) {
    return attendance;
  }

  const data = typeof attendance.toObject === "function" ? attendance.toObject() : attendance;
  const normalizedClassId = normalizeObjectId(classId);

  return {
    ...data,
    students: (data.students || []).filter(
      (record) => normalizeObjectId(record?.student?.currentClass) === normalizedClassId
    ),
  };
};

// Helper function to send absence notifications
async function sendAbsenceNotifications(students, date, createdBy) {
  try {
    const absentStudents = students.filter((student) => student.status === 'Absent');

    if (absentStudents.length === 0) {
      return;
    }

    await createAndSendNotification({
      message: `Dear Parent, your ward was absent from school on ${formatBSDate(date)} (BS). If this is unexpected, please contact the school.`,
      targetAudience: "Custom Group",
      recipients: absentStudents.map((student) => student.student),
      sendSMS: true,
      sendEmail: false,
      sendPushNotification: false,
    }, { createdBy });

  } catch (error) {
    console.error('Error sending absence notifications:', error);
    // Don't throw error - notifications should not block attendance marking
  }
}

// Mark attendance for a class
export let markAttendance = async (req, res) => {
  try {
    const { classId, date, students, academicYear } = req.body;
    const takenBy = getRequestTeacherId(req);
    const createdBy = getRequestUserId(req);
    const dayRange = getDayRangeFromInput(date);

    if (!dayRange) {
      return res.status(400).json({
        success: false,
        message: "Date is invalid",
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only mark attendance for your class teacher classes.",
        });
      }
    }

    const rosterValidation = await validateClassAttendanceRoster({ classId, students });
    if (rosterValidation) {
      return res.status(rosterValidation.status).json({
        success: false,
        message: rosterValidation.message,
      });
    }

    // Check if attendance already exists for this class and date
    const existingAttendance = await Attendance.findOne({
      class: classId,
      date: { $gte: dayRange.start, $lte: dayRange.end }
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.students = students;
      existingAttendance.takenBy = takenBy || existingAttendance.takenBy;
      await existingAttendance.save();

      // Send notifications for absent students (async, don't wait)
      sendAbsenceNotifications(students, date, createdBy);

      return res.status(200).json({
        success: true,
        message: "Attendance updated successfully",
        data: existingAttendance,
      });
    }

    // Create new attendance
    const result = await Attendance.create({
      class: classId,
      date: dayRange.start,
      academicYear,
      students,
      ...(takenBy ? { takenBy } : {})
    });

    // Send notifications for absent students (async, don't wait)
    sendAbsenceNotifications(students, date, createdBy);

    res.status(201).json({
      success: true,
      message: "Attendance marked successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get attendance for a class on a specific date
export let getAttendanceByDate = async (req, res) => {
  try {
    const { classId, date } = req.query;
    const dayRange = getDayRangeFromInput(date);

    if (!dayRange) {
      return res.status(400).json({
        success: false,
        message: "Date is invalid",
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance for your class teacher classes.",
        });
      }
    }

    const result = await Attendance.findOne({
      class: classId,
      date: { $gte: dayRange.start, $lte: dayRange.end }
    })
      .populate('class')
      .populate('students.student')
      .populate('takenBy');

    const data = filterAttendanceToClassRoster(result, classId);

    res.status(200).json({
      success: true,
      message: result ? "Attendance fetched successfully" : "No attendance record found",
      data,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get attendance report for a student
export let getStudentAttendanceReport = async (req, res) => {
  try {
    const { studentId, startDate, endDate } = req.query;

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessStudent(req, student);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance for students in your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessStudent(req, student);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance for your children.",
        });
      }
    }

    let dateQuery = {};
    if (startDate) {
      const parsedStart = parseDateInputForBoundary(startDate, { boundary: "start" });
      if (!parsedStart) {
        return res.status(400).json({ success: false, message: "Start date is invalid" });
      }
      dateQuery.$gte = parsedStart;
    }
    if (endDate) {
      const parsedEnd = parseDateInputForBoundary(endDate, { boundary: "end" });
      if (!parsedEnd) {
        return res.status(400).json({ success: false, message: "End date is invalid" });
      }
      dateQuery.$lte = parsedEnd;
    }

    const attendanceRecords = await Attendance.find({
      class: student.currentClass,
      ...(startDate || endDate ? { date: dateQuery } : {})
    }).sort({ date: -1 });

    // Filter and count attendance for this student
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let excusedCount = 0;
    const studentRecords = [];

    attendanceRecords.forEach(record => {
      const studentAttendance = record.students.find(
        s => s.student.toString() === studentId
      );
      if (studentAttendance) {
        studentRecords.push({
          date: record.date,
          status: studentAttendance.status,
          remarks: studentAttendance.remarks
        });

        switch (studentAttendance.status) {
          case 'Present': presentCount++; break;
          case 'Absent': absentCount++; break;
          case 'Late': lateCount++; break;
          case 'Excused': excusedCount++; break;
        }
      }
    });

    const totalDays = studentRecords.length;
    const attendancePercentage = totalDays > 0
      ? ((presentCount + lateCount) / totalDays * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      message: "Attendance report fetched successfully",
      data: {
        student: {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
          class: student.currentClass
        },
        summary: {
          totalDays,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendancePercentage
        },
        records: studentRecords
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get monthly attendance report for a class
export let getClassMonthlyReport = async (req, res) => {
  try {
    const { classId, month, year } = req.query;
    const monthRange = getBSMonthRange(year, month);

    if (!monthRange) {
      return res.status(400).json({
        success: false,
        message: "Month or year is invalid",
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view attendance reports for your class teacher classes.",
        });
      }
    }

    const attendanceRecords = await Attendance.find({
      class: classId,
      date: { $gte: monthRange.start, $lte: monthRange.end }
    })
      .populate('students.student')
      .sort({ date: 1 });

    // Get all students in class
    const classStudents = await Student.find({
      currentClass: classId,
      status: 'Active'
    }).sort({ rollNumber: 1, name: 1 });

    // Calculate attendance for each student
    const studentAttendance = classStudents.map(student => {
      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      attendanceRecords.forEach(record => {
        const studentRecord = record.students.find(
          s => s.student._id.toString() === student._id.toString()
        );
        if (studentRecord) {
          switch (studentRecord.status) {
            case 'Present': present++; break;
            case 'Absent': absent++; break;
            case 'Late': late++; break;
            case 'Excused': excused++; break;
          }
        }
      });

      const total = present + absent + late + excused;
      const percentage = total > 0 ? ((present + late) / total * 100).toFixed(2) : 0;

      return {
        student: {
          id: student._id,
          name: student.name,
          studentId: student.studentId,
          rollNumber: student.rollNumber
        },
        present,
        absent,
        late,
        excused,
        total,
        percentage
      };
    });

    res.status(200).json({
      success: true,
      message: "Monthly report fetched successfully",
      data: {
        month,
        year,
        totalWorkingDays: attendanceRecords.length,
        studentAttendance
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get list of absent students for notification
export let getAbsentStudents = async (req, res) => {
  try {
    const { classId, date } = req.query;
    const dayRange = getDayRangeFromInput(date);

    if (!dayRange) {
      return res.status(400).json({
        success: false,
        message: "Date is invalid",
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view absent students for your class teacher classes.",
        });
      }
    }

    const attendance = await Attendance.findOne({
      class: classId,
      date: { $gte: dayRange.start, $lte: dayRange.end }
    }).populate('students.student');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found for this date"
      });
    }

    const absentStudents = attendance.students
      .filter(s => normalizeObjectId(s.student?.currentClass) === normalizeObjectId(classId))
      .filter(s => s.status === 'Absent')
      .map(s => ({
        student: s.student,
        remarks: s.remarks
      }));

    res.status(200).json({
      success: true,
      message: "Absent students fetched successfully",
      data: absentStudents
    });
  } catch (error) {
    handleError(res, error);
  }
};
