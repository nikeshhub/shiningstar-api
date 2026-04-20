import { ProgressReport, Marks, Student, Class, Attendance, Exam } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getReportCategory, getApplicableTerminals, calculateGPA } from "../utils/gradeCalculator.js";
import { generateProgressReportPDF } from "../utils/pdfGenerator.js";
import { uploadBufferToCloudinary } from "../config/cloudinary.js";
import { getRequestUserId } from "../utils/requestUser.js";
import { withFamilyContact } from "../utils/studentFamily.js";

const emptyAttendance = () => ({
  totalDays: 0,
  present: 0,
  absent: 0,
  percentage: 0
});

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

async function buildTerminalDateRanges(classId, academicYear) {
  const [terminalExams, firstAttendance] = await Promise.all([
    Exam.find({
      examType: "Terminal",
      academicYear,
      classes: classId,
      terminalNumber: { $ne: null },
    })
      .select("terminalNumber startDate endDate")
      .sort({ terminalNumber: 1, startDate: 1 }),
    Attendance.findOne({
      class: classId,
      academicYear,
    })
      .select("date")
      .sort({ date: 1 }),
  ]);

  const rawRanges = new Map();

  for (const exam of terminalExams) {
    const existingRange = rawRanges.get(exam.terminalNumber);
    if (!existingRange) {
      rawRanges.set(exam.terminalNumber, {
        startDate: exam.startDate,
        endDate: exam.endDate,
      });
      continue;
    }

    rawRanges.set(exam.terminalNumber, {
      startDate:
        exam.startDate < existingRange.startDate
          ? exam.startDate
          : existingRange.startDate,
      endDate:
        exam.endDate > existingRange.endDate
          ? exam.endDate
          : existingRange.endDate,
    });
  }

  const terminalRanges = new Map();
  let previousTerminalEnd = null;

  for (const [terminalNumber, range] of [...rawRanges.entries()].sort(
    ([left], [right]) => left - right
  )) {
    const startDate = previousTerminalEnd
      ? addDays(previousTerminalEnd, 1)
      : firstAttendance?.date || range.startDate;

    terminalRanges.set(terminalNumber, {
      startDate,
      endDate: range.endDate,
    });

    previousTerminalEnd = range.endDate;
  }

  return terminalRanges;
}

// Generate progress report for a student
export let generateProgressReport = async (req, res) => {
  try {
    const { studentId, academicYear } = req.body;

    // Get student details
    const student = await Student.findById(studentId).populate('currentClass');
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const classDoc = student.currentClass;
    const reportCategory = getReportCategory(classDoc.className);
    const applicableTerminals = getApplicableTerminals(classDoc.className);
    const terminalDateRanges = await buildTerminalDateRanges(classDoc._id, academicYear);

    // Compile terminal data
    const terminals = [];

    for (const terminalNumber of applicableTerminals) {
      // Get marks for this terminal
      const marks = await Marks.findOne({
        student: studentId,
        academicYear,
        terminalNumber
      }).populate('subjectMarks.subject', 'subjectName subjectCode creditHours');

      if (!marks) {
        // Terminal not yet completed - add placeholder
        terminals.push({
          terminalNumber,
          marks: null,
          gpa: 0,
          grade: '',
          attendance: emptyAttendance()
        });
        continue;
      }

      const terminalAttendance = await calculateTerminalAttendance(
        studentId,
        classDoc._id,
        academicYear,
        terminalDateRanges.get(terminalNumber)
      );

      terminals.push({
        terminalNumber,
        marks: marks._id,
        gpa: marks.gpa,
        grade: marks.overallGrade,
        attendance: terminalAttendance
      });
    }

    // Calculate yearly total GPA
    const completedTerminals = terminals.filter(t => t.marks !== null);
    const yearlyGPA = completedTerminals.length > 0
      ? completedTerminals.reduce((sum, t) => sum + t.gpa, 0) / completedTerminals.length
      : 0;

    let yearlyGrade = 'NG';
    if (yearlyGPA >= 3.6) yearlyGrade = 'A+';
    else if (yearlyGPA >= 3.2) yearlyGrade = 'A';
    else if (yearlyGPA >= 2.8) yearlyGrade = 'B+';
    else if (yearlyGPA >= 2.4) yearlyGrade = 'B';
    else if (yearlyGPA >= 2.0) yearlyGrade = 'C+';
    else if (yearlyGPA >= 1.6) yearlyGrade = 'C';
    else if (yearlyGPA >= 1.2) yearlyGrade = 'D';

    // Check if progress report already exists
    let progressReport = await ProgressReport.findOne({
      student: studentId,
      academicYear
    });

    if (progressReport) {
      // Update existing
      progressReport.class = classDoc._id;
      progressReport.reportCategory = reportCategory;
      progressReport.terminals = terminals;
      progressReport.yearlyTotal = {
        gradePoint: parseFloat(yearlyGPA.toFixed(2)),
        grade: yearlyGrade
      };
      progressReport.generatedAt = new Date();
      progressReport.generatedBy = getRequestUserId(req);

      await progressReport.save();
    } else {
      // Create new
      progressReport = await ProgressReport.create({
        student: studentId,
        class: classDoc._id,
        academicYear,
        reportCategory,
        terminals,
        yearlyTotal: {
          gradePoint: parseFloat(yearlyGPA.toFixed(2)),
          grade: yearlyGrade
        },
        generatedAt: new Date(),
        generatedBy: getRequestUserId(req)
      });
    }

    const populated = await ProgressReport.findById(progressReport._id)
      .populate('student', 'name studentId rollNumber dateOfBirth gender')
      .populate('class', 'className')
      .populate({
        path: 'terminals.marks',
        populate: {
          path: 'subjectMarks.subject',
          select: 'subjectName subjectCode creditHours'
        }
      });

    res.status(200).json({
      success: true,
      message: "Progress report generated successfully",
      data: populated
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Helper: Calculate attendance for a terminal
async function calculateTerminalAttendance(studentId, classId, academicYear, dateRange) {
  if (!dateRange?.startDate || !dateRange?.endDate) {
    return emptyAttendance();
  }

  const startDate = new Date(dateRange.startDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(dateRange.endDate);
  endDate.setHours(23, 59, 59, 999);

  const attendanceRecords = await Attendance.find({
    class: classId,
    academicYear,
    date: {
      $gte: startDate,
      $lte: endDate
    }
  });

  if (attendanceRecords.length === 0) {
    return emptyAttendance();
  }

  let totalDays = 0;
  let presentDays = 0;
  let absentDays = 0;

  for (const record of attendanceRecords) {
    const studentRecord = record.students.find(
      s => s.student.toString() === studentId.toString()
    );

    if (studentRecord) {
      totalDays++;
      if (studentRecord.status === 'Present') {
        presentDays++;
      } else if (studentRecord.status === 'Absent') {
        absentDays++;
      }
    }
  }

  const percentage = totalDays > 0
    ? parseFloat(((presentDays / totalDays) * 100).toFixed(2))
    : 0;

  return {
    totalDays,
    present: presentDays,
    absent: absentDays,
    percentage
  };
}

// Get progress report for a student
export let getProgressReport = async (req, res) => {
  try {
    const { studentId, academicYear } = req.query;

    const progressReport = await ProgressReport.findOne({
      student: studentId,
      academicYear
    })
      .populate({
        path: 'student',
        select: 'name studentId rollNumber dateOfBirth gender family',
        populate: {
          path: 'family',
          select: 'familyId primaryContact secondaryContact address'
        }
      })
      .populate('class', 'className')
      .populate({
        path: 'terminals.marks',
        populate: {
          path: 'subjectMarks.subject',
          select: 'subjectName subjectCode creditHours writtenMarks practicalMarks fullMarks'
        }
      });

    if (!progressReport) {
      return res.status(404).json({
        success: false,
        message: "Progress report not found. Please generate it first."
      });
    }

    res.status(200).json({
      success: true,
      message: "Progress report fetched successfully",
      data: {
        ...progressReport.toObject(),
        student: withFamilyContact(progressReport.student)
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Get all progress reports for a class
export let getClassProgressReports = async (req, res) => {
  try {
    const { classId, academicYear } = req.query;

    const progressReports = await ProgressReport.find({
      class: classId,
      academicYear
    })
      .populate('student', 'name studentId rollNumber')
      .sort({ 'student.rollNumber': 1 });

    res.status(200).json({
      success: true,
      message: "Progress reports fetched successfully",
      data: progressReports
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Bulk generate progress reports for entire class
export let bulkGenerateProgressReports = async (req, res) => {
  try {
    const { classId, academicYear } = req.body;

    // Get all active students in the class
    const students = await Student.find({
      currentClass: classId,
      status: 'Active'
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active students found in this class"
      });
    }

    const results = [];
    const errors = [];
    const classDoc = await Class.findById(classId);

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const reportCategory = getReportCategory(classDoc.className);
    const applicableTerminals = getApplicableTerminals(classDoc.className);
    const terminalDateRanges = await buildTerminalDateRanges(classId, academicYear);

    for (const student of students) {
      try {
        const terminals = [];

        for (const terminalNumber of applicableTerminals) {
          const marks = await Marks.findOne({
            student: student._id,
            academicYear,
            terminalNumber
          });

          if (!marks) {
            terminals.push({
              terminalNumber,
              marks: null,
              gpa: 0,
              grade: '',
              attendance: emptyAttendance()
            });
            continue;
          }

          const terminalAttendance = await calculateTerminalAttendance(
            student._id,
            classId,
            academicYear,
            terminalDateRanges.get(terminalNumber)
          );

          terminals.push({
            terminalNumber,
            marks: marks._id,
            gpa: marks.gpa,
            grade: marks.overallGrade,
            attendance: terminalAttendance
          });
        }

        const completedTerminals = terminals.filter(t => t.marks !== null);
        const yearlyGPA = completedTerminals.length > 0
          ? completedTerminals.reduce((sum, t) => sum + t.gpa, 0) / completedTerminals.length
          : 0;

        let yearlyGrade = 'NG';
        if (yearlyGPA >= 3.6) yearlyGrade = 'A+';
        else if (yearlyGPA >= 3.2) yearlyGrade = 'A';
        else if (yearlyGPA >= 2.8) yearlyGrade = 'B+';
        else if (yearlyGPA >= 2.4) yearlyGrade = 'B';
        else if (yearlyGPA >= 2.0) yearlyGrade = 'C+';
        else if (yearlyGPA >= 1.6) yearlyGrade = 'C';
        else if (yearlyGPA >= 1.2) yearlyGrade = 'D';

        // Upsert progress report
        await ProgressReport.findOneAndUpdate(
          { student: student._id, academicYear },
          {
            student: student._id,
            class: classId,
            academicYear,
            reportCategory,
            terminals,
            yearlyTotal: {
              gradePoint: parseFloat(yearlyGPA.toFixed(2)),
              grade: yearlyGrade
            },
            generatedAt: new Date(),
            generatedBy: getRequestUserId(req)
          },
          { upsert: true, new: true }
        );

        results.push({
          studentId: student._id,
          studentName: student.name,
          success: true
        });

      } catch (error) {
        errors.push({
          studentId: student._id,
          studentName: student.name,
          success: false,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Progress reports generated: ${results.length} successful, ${errors.length} failed`,
      data: {
        successful: results,
        failed: errors
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Generate Progress Report PDF
export let generateProgressReportPDFController = async (req, res) => {
  try {
    const { studentId, academicYear } = req.query;

    const progressReport = await ProgressReport.findOne({
      student: studentId,
      academicYear
    })
      .populate('student', 'name studentId rollNumber dateOfBirth gender')
      .populate('class', 'className')
      .populate({
        path: 'terminals.marks',
        populate: {
          path: 'subjectMarks.subject',
          select: 'subjectName subjectCode'
        }
      });

    if (!progressReport) {
      return res.status(404).json({
        success: false,
        message: "Progress report not found. Please generate it first."
      });
    }

    const pdfBuffer = await generateProgressReportPDF(progressReport);
    const uploadResult = await uploadBufferToCloudinary(pdfBuffer, 'pdfs', 'raw');

    progressReport.pdfUrl = uploadResult.secure_url;
    await progressReport.save();

    res.status(200).json({
      success: true,
      message: "Progress report PDF generated successfully",
      data: {
        pdfUrl: progressReport.pdfUrl,
        downloadUrl: `/api/progress-reports/pdf/download?studentId=${studentId}&academicYear=${academicYear}`
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Download Progress Report PDF
export let downloadProgressReportPDF = async (req, res) => {
  try {
    const { studentId, academicYear } = req.query;

    const progressReport = await ProgressReport.findOne({
      student: studentId,
      academicYear
    }).populate('student', 'name');

    if (!progressReport) {
      return res.status(404).json({
        success: false,
        message: "Progress report not found"
      });
    }

    if (!progressReport.pdfUrl) {
      return res.status(404).json({
        success: false,
        message: "Progress report PDF not generated yet. Please generate it first."
      });
    }

    res.redirect(progressReport.pdfUrl);

  } catch (error) {
    handleError(res, error);
  }
};
