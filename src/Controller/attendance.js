import { Attendance, Student, Class } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Helper function to send absence notifications
async function sendAbsenceNotifications(students, date) {
  try {
    // Filter absent students
    const absentStudents = students.filter(s => s.status === 'Absent');

    if (absentStudents.length === 0) {
      return;
    }

    // Get full student details with parent contact info
    const studentIds = absentStudents.map(s => s.student);
    const studentDetails = await Student.find({ _id: { $in: studentIds } })
      .populate('currentClass');

    // TODO: Implement actual notification logic here
    // This could be SMS, email, or push notification to parent app
    // For now, just log the notification
    console.log(`📧 Sending absence notifications for ${studentDetails.length} students on ${date}`);

    studentDetails.forEach(student => {
      const absentRecord = absentStudents.find(s => s.student.toString() === student._id.toString());
      console.log(`  - Student: ${student.name} (${student.studentId})`);
      console.log(`    Parent: ${student.fatherName} - ${student.contactNumber}`);
      console.log(`    Remarks: ${absentRecord.remarks || 'None'}`);

      // TODO: Send actual notification
      // Example: sendSMS(student.contactNumber, `Your child ${student.name} was absent on ${date}`)
      // Example: sendEmail(student.parentEmail, subject, body)
    });

  } catch (error) {
    console.error('Error sending absence notifications:', error);
    // Don't throw error - notifications should not block attendance marking
  }
}

// Mark attendance for a class
export let markAttendance = async (req, res) => {
  try {
    const { classId, date, students, takenBy, academicYear } = req.body;

    // Check if attendance already exists for this class and date
    const existingAttendance = await Attendance.findOne({
      class: classId,
      date: new Date(date)
    });

    if (existingAttendance) {
      // Update existing attendance
      existingAttendance.students = students;
      existingAttendance.takenBy = takenBy;
      await existingAttendance.save();

      // Send notifications for absent students (async, don't wait)
      sendAbsenceNotifications(students, date);

      return res.status(200).json({
        success: true,
        message: "Attendance updated successfully",
        data: existingAttendance,
      });
    }

    // Create new attendance
    const result = await Attendance.create({
      class: classId,
      date: new Date(date),
      academicYear,
      students,
      takenBy
    });

    // Send notifications for absent students (async, don't wait)
    sendAbsenceNotifications(students, date);

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

    const result = await Attendance.findOne({
      class: classId,
      date: new Date(date)
    })
      .populate('class')
      .populate('students.student')
      .populate('takenBy');

    res.status(200).json({
      success: true,
      message: result ? "Attendance fetched successfully" : "No attendance record found",
      data: result,
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

    let dateQuery = {};
    if (startDate) dateQuery.$gte = new Date(startDate);
    if (endDate) dateQuery.$lte = new Date(endDate);

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

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const attendanceRecords = await Attendance.find({
      class: classId,
      date: { $gte: startDate, $lte: endDate }
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

    const attendance = await Attendance.findOne({
      class: classId,
      date: new Date(date)
    }).populate('students.student');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found for this date"
      });
    }

    const absentStudents = attendance.students
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
