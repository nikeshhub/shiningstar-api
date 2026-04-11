import { ProgressReport, Marks, Student, Class, Attendance } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getReportCategory, getApplicableTerminals, calculateGPA } from "../utils/gradeCalculator.js";
import { generateProgressReportPDF, ensureUploadsDir } from "../utils/pdfGenerator.js";
import path from "path";

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
          attendance: {
            totalDays: 0,
            present: 0,
            absent: 0,
            percentage: 0
          }
        });
        continue;
      }

      // Get attendance for this terminal
      // Calculate date range for terminal (approximation: divide academic year into terminals)
      const terminalAttendance = await calculateTerminalAttendance(
        studentId,
        classDoc._id,
        terminalNumber,
        academicYear
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
      progressReport.generatedBy = req.user?._id; // If auth middleware is present

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
        generatedBy: req.user?._id
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
async function calculateTerminalAttendance(studentId, classId, terminalNumber, academicYear) {
  // Get all attendance records for this class/student in the academic year
  const attendanceRecords = await Attendance.find({
    classId,
    academicYear
  });

  if (attendanceRecords.length === 0) {
    return {
      totalDays: 0,
      present: 0,
      absent: 0,
      percentage: 0
    };
  }

  // Filter attendance by terminal (approximate by dividing academic year)
  // For now, we'll calculate total attendance (can be refined later)
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
      .populate('student', 'name studentId rollNumber dateOfBirth gender parentContact')
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
      data: progressReport
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

    for (const student of students) {
      try {
        // Use the same logic as generateProgressReport
        const classDoc = await Class.findById(classId);
        const reportCategory = getReportCategory(classDoc.className);
        const applicableTerminals = getApplicableTerminals(classDoc.className);

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
              attendance: {
                totalDays: 0,
                present: 0,
                absent: 0,
                percentage: 0
              }
            });
            continue;
          }

          const terminalAttendance = await calculateTerminalAttendance(
            student._id,
            classId,
            terminalNumber,
            academicYear
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
            generatedBy: req.user?._id
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

    // Ensure uploads directory exists
    const uploadsDir = ensureUploadsDir();

    // Generate PDF filename
    const filename = `progress_report_${progressReport._id}_${Date.now()}.pdf`;
    const outputPath = path.join(uploadsDir, filename);

    // Generate PDF
    await generateProgressReportPDF(progressReport, outputPath);

    // Update progress report with PDF URL
    progressReport.pdfUrl = `/uploads/pdfs/${filename}`;
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

    const filePath = path.join(process.cwd(), progressReport.pdfUrl);

    res.download(filePath, `progress_report_${progressReport.student.name.replace(/\s/g, '_')}_${academicYear}.pdf`, (err) => {
      if (err) {
        console.error('Download error:', err);
        return res.status(500).json({
          success: false,
          message: "Error downloading file"
        });
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};
