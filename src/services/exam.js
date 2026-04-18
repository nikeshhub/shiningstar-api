import { Exam, Marks, Student, Class, FeeStructure, FeeTransaction, Subject, Family } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getApplicableTerminals, calculateGrade, calculateGPA, calculateTotalMarks } from "../utils/gradeCalculator.js";
import { generateExamNoticePDF, generateStudentExamNotice } from "../utils/pdfGenerator.js";
import { uploadBufferToCloudinary } from "../config/cloudinary.js";
import { getRequestTeacherId } from "../utils/requestUser.js";

// Create exam with routine and auto-fee generation
export let createExam = async (req, res) => {
  try {
    const { examName, examType, terminalNumber, academicYear, classes, startDate, endDate, routine, remarks } = req.body;

    // Validate terminal numbers for classes
    if (examType === 'Terminal' && terminalNumber && classes && classes.length > 0) {
      for (const classId of classes) {
        const classDoc = await Class.findById(classId);
        if (!classDoc) {
          return res.status(404).json({
            success: false,
            message: `Class not found: ${classId}`
          });
        }

        const applicableTerminals = getApplicableTerminals(classDoc.className);
        if (!applicableTerminals.includes(terminalNumber)) {
          return res.status(400).json({
            success: false,
            message: `Terminal ${terminalNumber} is not applicable for ${classDoc.className}. Valid terminals: ${applicableTerminals.join(', ')}`
          });
        }
      }
    }

    // Create exam
    const exam = await Exam.create({
      examName,
      examType,
      terminalNumber: examType === 'Terminal' ? terminalNumber : undefined,
      academicYear,
      classes,
      startDate,
      endDate,
      routine: routine || [],
      status: 'Scheduled',
      remarks,
      feeGenerated: false,
      noticeGenerated: false
    });

    // Auto-generate fees for all students immediately
    await generateExamFees(exam);

    const result = await Exam.findById(exam._id)
      .populate('classes', 'className')
      .populate('routine.class', 'className')
      .populate('routine.subject', 'subjectName subjectCode');

    res.status(201).json({
      success: true,
      message: "Exam created successfully and fees generated",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Helper: Generate exam fees for all students (with family billing support)
async function generateExamFees(exam) {
  try {
    const familyGroups = new Map(); // familyId -> { family, students: [], totalFee: 0 }
    const individualStudents = []; // Students without family or with Individual billing

    // Process each class in the exam
    for (const classId of exam.classes) {
      // Get fee structure for this class
      const feeStructure = await FeeStructure.findOne({
        class: classId,
        academicYear: exam.academicYear
      });

      const examFeeAmount = feeStructure?.examFee || 0;

      if (examFeeAmount === 0) {
        continue; // Skip if no exam fee configured
      }

      // Get all active students in this class
      const students = await Student.find({
        currentClass: classId,
        status: 'Active'
      }).populate('family');

      // Group students by family vs individual
      for (const student of students) {
        if (student.family) {
          // Student has a family - check billing type
          const family = await Family.findById(student.family._id || student.family);

          if (family && family.billingType === 'Family') {
            // Family billing - group together
            const familyId = family._id.toString();

            if (!familyGroups.has(familyId)) {
              familyGroups.set(familyId, {
                family: family,
                students: [],
                totalFee: 0,
                feeBreakdown: []
              });
            }

            const group = familyGroups.get(familyId);
            group.students.push(student);
            group.totalFee += examFeeAmount;
            group.feeBreakdown.push({
              feeType: `Exam - ${student.name}`,
              amount: examFeeAmount
            });
          } else {
            // Individual billing despite having family
            individualStudents.push({ student, examFeeAmount });
          }
        } else {
          // No family - individual billing
          individualStudents.push({ student, examFeeAmount });
        }
      }
    }

    // Create family-level charges and student notices
    for (const [familyId, group] of familyGroups) {
      // Get last family transaction to calculate running balance
      const lastTransaction = await FeeTransaction
        .findOne({ family: familyId, billingScope: 'Family' })
        .sort({ date: -1 });

      const previousBalance = lastTransaction
        ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
        : 0;

      const newTotalDue = previousBalance + group.totalFee;

      // Use first student as reference for the transaction
      const primaryStudent = group.students[0];

      // Generate unique bill number
      const billNumber = `EXAM-${exam.terminalNumber || 'FINAL'}-${Date.now()}-FAM-${group.family.familyId}`;

      const feeTransaction = await FeeTransaction.create({
        student: primaryStudent._id,
        family: familyId,
        billingScope: 'Family',
        date: new Date(),
        billNumber,
        transactionType: 'Charge',
        description: `${exam.examName} Fee (Family - ${group.students.length} students)`,
        chargeAmount: group.totalFee,
        paidAmount: 0,
        previousBalance,
        totalDue: newTotalDue > 0 ? newTotalDue : 0,
        totalAdvance: newTotalDue < 0 ? Math.abs(newTotalDue) : 0,
        feeBreakdown: group.feeBreakdown,
        remarks: `Auto-generated for ${exam.examName} - Family billing for: ${group.students.map(s => s.name).join(', ')}`
      });

      // Update family balance
      await Family.findByIdAndUpdate(familyId, {
        'familyFeeBalance.totalDue': newTotalDue > 0 ? newTotalDue : 0,
        'familyFeeBalance.totalAdvance': newTotalDue < 0 ? Math.abs(newTotalDue) : 0
      });

      // Generate student exam notices for each student in the family
      for (const student of group.students) {
        try {
          // Get student's exam routine from the exam routine array
          const studentRoutine = exam.routine.filter(r =>
            r.class.toString() === student.currentClass._id.toString()
          );

          // Populate subject details for routine
          const populatedRoutine = await Promise.all(
            studentRoutine.map(async (r) => {
              const subject = await Subject.findById(r.subject);
              return { ...r, subject };
            })
          );

          const pdfBuffer = await generateStudentExamNotice({
            exam, student, studentRoutine: populatedRoutine, feeTransaction, family: group.family,
          });
          await uploadBufferToCloudinary(pdfBuffer, 'exam-notices', 'raw');
          console.log(`Generated exam notice for student ${student.studentId}`);
        } catch (error) {
          console.error(`Error generating notice for student ${student.studentId}:`, error);
        }
      }
    }

    // Create individual charges and student notices
    for (const { student, examFeeAmount } of individualStudents) {
      // Check for existing dues
      const lastTransaction = await FeeTransaction.findOne({
        student: student._id,
        billingScope: 'Individual'
      }).sort({ date: -1 });

      const previousBalance = lastTransaction
        ? (lastTransaction.totalDue - lastTransaction.totalAdvance)
        : 0;

      const newTotalDue = previousBalance + examFeeAmount;

      // Generate unique bill number
      const billNumber = `EXAM-${exam.terminalNumber || 'FINAL'}-${Date.now()}-${student.studentId}`;

      const feeTransaction = await FeeTransaction.create({
        student: student._id,
        billingScope: 'Individual',
        date: new Date(),
        billNumber,
        transactionType: 'Charge',
        description: `${exam.examName} Fee`,
        chargeAmount: examFeeAmount,
        paidAmount: 0,
        previousBalance,
        totalDue: newTotalDue > 0 ? newTotalDue : 0,
        totalAdvance: newTotalDue < 0 ? Math.abs(newTotalDue) : 0,
        feeBreakdown: [{
          feeType: 'Exam',
          amount: examFeeAmount
        }],
        remarks: `Auto-generated for ${exam.examName}`
      });

      // Generate student exam notice
      try {
        // Get student's exam routine from the exam routine array
        const studentRoutine = exam.routine.filter(r =>
          r.class.toString() === student.currentClass._id.toString()
        );

        // Populate subject details for routine
        const populatedRoutine = await Promise.all(
          studentRoutine.map(async (r) => {
            const subject = await Subject.findById(r.subject);
            return { ...r, subject };
          })
        );

        const pdfBuffer = await generateStudentExamNotice({
          exam, student, studentRoutine: populatedRoutine, feeTransaction, family: null,
        });
        await uploadBufferToCloudinary(pdfBuffer, 'exam-notices', 'raw');
        console.log(`Generated exam notice for student ${student.studentId}`);
      } catch (error) {
        console.error(`Error generating notice for student ${student.studentId}:`, error);
      }
    }

    // Mark fees as generated
    exam.feeGenerated = true;
    exam.feeGeneratedAt = new Date();
    await exam.save();

    console.log(`Exam fees generated: ${familyGroups.size} families, ${individualStudents.length} individual students`);

  } catch (error) {
    console.error('Error generating exam fees:', error);
    throw error;
  }
}

// Get all exams
export let getAllExams = async (req, res) => {
  try {
    const { academicYear, examType, status, terminalNumber } = req.query;
    let query = {};

    if (academicYear) query.academicYear = academicYear;
    if (examType) query.examType = examType;
    if (status) query.status = status;
    if (terminalNumber) query.terminalNumber = parseInt(terminalNumber);

    const result = await Exam.find(query)
      .populate('classes', 'className')
      .populate('routine.class', 'className')
      .populate('routine.subject', 'subjectName subjectCode')
      .sort({ startDate: -1 });

    res.status(200).json({
      success: true,
      message: "Exams fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get exam by ID
export let getExamById = async (req, res) => {
  try {
    const result = await Exam.findById(req.params.id)
      .populate('classes', 'className')
      .populate('routine.class', 'className')
      .populate('routine.subject', 'subjectName subjectCode creditHours fullMarks');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update exam
export let updateExam = async (req, res) => {
  try {
    const result = await Exam.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('classes', 'className')
      .populate('routine.class', 'className')
      .populate('routine.subject', 'subjectName subjectCode');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Manually trigger fee generation for an exam
export let triggerExamFeeGeneration = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    if (exam.feeGenerated) {
      return res.status(400).json({
        success: false,
        message: "Fees have already been generated for this exam"
      });
    }

    await generateExamFees(exam);

    const updated = await Exam.findById(exam._id)
      .populate('classes', 'className');

    res.status(200).json({
      success: true,
      message: "Exam fees generated successfully",
      data: updated
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete exam
export let deleteExam = async (req, res) => {
  try {
    // Check if marks have been entered
    const marksCount = await Marks.countDocuments({ exam: req.params.id });

    if (marksCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete exam with ${marksCount} marks entries`
      });
    }

    const result = await Exam.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Exam deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Enter marks for a student (with written + practical separation)
export let enterMarks = async (req, res) => {
  try {
    const { studentId, examId, classId, academicYear, terminalNumber, subjectMarks } = req.body;
    const enteredBy = getRequestTeacherId(req);

    // Validate exam exists
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    // Calculate totals and grades for each subject
    let totalPossibleMarks = 0;
    let totalObtainedMarks = 0;

    const marksWithGrades = await Promise.all(
      subjectMarks.map(async (sm) => {
        // Get subject details
        const subject = await Subject.findById(sm.subject);
        if (!subject) {
          throw new Error(`Subject not found: ${sm.subject}`);
        }

        // Calculate total marks from written + practical
        const obtainedTotal = calculateTotalMarks(
          sm.writtenMarks || 0,
          sm.practicalMarks || 0
        );

        // Use subject's fullMarks
        const fullMarks = subject.fullMarks;
        const passMarks = subject.passMarks;

        totalPossibleMarks += fullMarks;
        totalObtainedMarks += obtainedTotal;

        // Calculate grade using NEB system
        const gradeData = sm.isAbsent
          ? { percentage: 0, gradePoint: 0.0, gradeLetter: 'AB' }
          : calculateGrade(obtainedTotal, fullMarks);

        return {
          subject: sm.subject,
          writtenMarks: sm.writtenMarks || 0,
          practicalMarks: sm.practicalMarks || 0,
          totalMarks: fullMarks,
          fullMarks,
          passMarks,
          obtainedMarks: obtainedTotal,
          percentage: gradeData.percentage,
          gradePoint: gradeData.gradePoint,
          gradeLetter: gradeData.gradeLetter,
          isAbsent: sm.isAbsent || false,
          remarks: sm.remarks || ''
        };
      })
    );

    // Calculate overall percentage
    const overallPercentage = totalPossibleMarks > 0
      ? (totalObtainedMarks / totalPossibleMarks) * 100
      : 0;

    // Calculate GPA from all subject grade points
    const gpaData = calculateGPA(marksWithGrades);

    // Determine pass/fail
    const hasFailed = marksWithGrades.some(
      m => !m.isAbsent && m.obtainedMarks < m.passMarks
    );
    const hasAbsent = marksWithGrades.some(m => m.isAbsent);
    const result = hasFailed || hasAbsent ? 'Fail' : 'Pass';

    // Check if marks already exist
    const existingMarks = await Marks.findOne({
      student: studentId,
      exam: examId
    });

    if (existingMarks) {
      // Update existing marks
      existingMarks.subjectMarks = marksWithGrades;
      existingMarks.terminalNumber = terminalNumber;
      existingMarks.totalMarks = totalPossibleMarks;
      existingMarks.totalObtained = totalObtainedMarks;
      existingMarks.percentage = parseFloat(overallPercentage.toFixed(2));
      existingMarks.gpa = gpaData.gpa;
      existingMarks.overallGrade = gpaData.grade;
      existingMarks.result = result;
      existingMarks.enteredBy = enteredBy || existingMarks.enteredBy;

      await existingMarks.save();

      const populated = await Marks.findById(existingMarks._id)
        .populate('student', 'name studentId rollNumber')
        .populate('subjectMarks.subject', 'subjectName subjectCode');

      return res.status(200).json({
        success: true,
        message: "Marks updated successfully",
        data: populated,
      });
    }

    // Create new marks entry
    const marksEntry = await Marks.create({
      student: studentId,
      exam: examId,
      class: classId,
      academicYear,
      terminalNumber,
      subjectMarks: marksWithGrades,
      totalMarks: totalPossibleMarks,
      totalObtained: totalObtainedMarks,
      percentage: parseFloat(overallPercentage.toFixed(2)),
      gpa: gpaData.gpa,
      overallGrade: gpaData.grade,
      result,
      ...(enteredBy ? { enteredBy } : {})
    });

    const populated = await Marks.findById(marksEntry._id)
      .populate('student', 'name studentId rollNumber')
      .populate('subjectMarks.subject', 'subjectName subjectCode');

    res.status(201).json({
      success: true,
      message: "Marks entered successfully",
      data: populated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Bulk enter marks for multiple students (for efficiency)
export let bulkEnterMarks = async (req, res) => {
  try {
    const { examId, classId, academicYear, terminalNumber, studentsMarks } = req.body;
    const enteredBy = getRequestTeacherId(req);

    if (!studentsMarks || studentsMarks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No student marks provided"
      });
    }

    const results = [];
    const errors = [];

    for (const studentData of studentsMarks) {
      try {
        const { studentId, subjectMarks } = studentData;

        // Process marks for this student
        let totalPossibleMarks = 0;
        let totalObtainedMarks = 0;

        const marksWithGrades = await Promise.all(
          subjectMarks.map(async (sm) => {
            const subject = await Subject.findById(sm.subject);
            if (!subject) {
              throw new Error(`Subject not found: ${sm.subject}`);
            }

            const obtainedTotal = calculateTotalMarks(
              sm.writtenMarks || 0,
              sm.practicalMarks || 0
            );

            const fullMarks = subject.fullMarks;
            const passMarks = subject.passMarks;

            totalPossibleMarks += fullMarks;
            totalObtainedMarks += obtainedTotal;

            const gradeData = sm.isAbsent
              ? { percentage: 0, gradePoint: 0.0, gradeLetter: 'AB' }
              : calculateGrade(obtainedTotal, fullMarks);

            return {
              subject: sm.subject,
              writtenMarks: sm.writtenMarks || 0,
              practicalMarks: sm.practicalMarks || 0,
              totalMarks: fullMarks,
              fullMarks,
              passMarks,
              obtainedMarks: obtainedTotal,
              percentage: gradeData.percentage,
              gradePoint: gradeData.gradePoint,
              gradeLetter: gradeData.gradeLetter,
              isAbsent: sm.isAbsent || false,
              remarks: sm.remarks || ''
            };
          })
        );

        const overallPercentage = totalPossibleMarks > 0
          ? (totalObtainedMarks / totalPossibleMarks) * 100
          : 0;

        const gpaData = calculateGPA(marksWithGrades);

        const hasFailed = marksWithGrades.some(
          m => !m.isAbsent && m.obtainedMarks < m.passMarks
        );
        const hasAbsent = marksWithGrades.some(m => m.isAbsent);
        const result = hasFailed || hasAbsent ? 'Fail' : 'Pass';

        // Upsert marks
        const marksEntry = await Marks.findOneAndUpdate(
          { student: studentId, exam: examId },
          {
            student: studentId,
            exam: examId,
            class: classId,
            academicYear,
            terminalNumber,
            subjectMarks: marksWithGrades,
            totalMarks: totalPossibleMarks,
            totalObtained: totalObtainedMarks,
            percentage: parseFloat(overallPercentage.toFixed(2)),
            gpa: gpaData.gpa,
            overallGrade: gpaData.grade,
            result,
            ...(enteredBy ? { enteredBy } : {})
          },
          { upsert: true, new: true, runValidators: true }
        );

        results.push({
          studentId,
          success: true,
          marksId: marksEntry._id
        });

      } catch (error) {
        errors.push({
          studentId: studentData.studentId,
          success: false,
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Marks processed: ${results.length} successful, ${errors.length} failed`,
      data: {
        successful: results,
        failed: errors
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Get student marksheet
export let getStudentMarksheet = async (req, res) => {
  try {
    const { studentId, examId } = req.query;

    const marks = await Marks.findOne({
      student: studentId,
      exam: examId
    })
      .populate('student', 'name studentId rollNumber dateOfBirth gender')
      .populate('exam', 'examName examType terminalNumber academicYear startDate')
      .populate('class', 'className')
      .populate('subjectMarks.subject', 'subjectName subjectCode creditHours');

    if (!marks) {
      return res.status(404).json({
        success: false,
        message: "Marksheet not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Marksheet fetched successfully",
      data: marks,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get marks by terminal for a student (for progress report)
export let getStudentTerminalMarks = async (req, res) => {
  try {
    const { studentId, academicYear, terminalNumber } = req.query;

    const marks = await Marks.find({
      student: studentId,
      academicYear,
      terminalNumber: parseInt(terminalNumber)
    })
      .populate('exam', 'examName examType terminalNumber')
      .populate('class', 'className')
      .populate('subjectMarks.subject', 'subjectName subjectCode creditHours')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Terminal marks fetched successfully",
      data: marks,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get class result
export let getClassResult = async (req, res) => {
  try {
    const { classId, examId } = req.query;

    const results = await Marks.find({
      class: classId,
      exam: examId
    })
      .populate('student', 'name studentId rollNumber')
      .sort({ percentage: -1 });

    // Calculate ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Save ranks
    await Promise.all(results.map(r => r.save()));

    const passCount = results.filter(r => r.result === 'Pass').length;
    const failCount = results.filter(r => r.result === 'Fail').length;
    const avgPercentage = results.length > 0
      ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length
      : 0;

    res.status(200).json({
      success: true,
      message: "Class result fetched successfully",
      data: {
        results,
        statistics: {
          totalStudents: results.length,
          passed: passCount,
          failed: failCount,
          passPercentage: results.length > 0 ? ((passCount / results.length) * 100).toFixed(2) : '0.00',
          averagePercentage: avgPercentage.toFixed(2)
        }
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Generate Exam Notice PDF
export let generateExamNotice = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id)
      .populate('classes', 'className')
      .populate({
        path: 'routine.class',
        select: 'className'
      })
      .populate({
        path: 'routine.subject',
        select: 'subjectName subjectCode'
      });

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    const pdfBuffer = await generateExamNoticePDF(exam);
    const uploadResult = await uploadBufferToCloudinary(pdfBuffer, 'pdfs', 'raw');

    exam.noticeGenerated = true;
    exam.noticeGeneratedAt = new Date();
    exam.noticePdfUrl = uploadResult.secure_url;
    await exam.save();

    res.status(200).json({
      success: true,
      message: "Exam notice generated successfully",
      data: {
        pdfUrl: exam.noticePdfUrl,
        downloadUrl: `/api/exams/${exam._id}/notice/download`
      }
    });

  } catch (error) {
    handleError(res, error);
  }
};

// Download Exam Notice PDF
export let downloadExamNotice = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    if (!exam.noticeGenerated || !exam.noticePdfUrl) {
      return res.status(404).json({
        success: false,
        message: "Exam notice not generated yet. Please generate it first."
      });
    }

    res.redirect(exam.noticePdfUrl);

  } catch (error) {
    handleError(res, error);
  }
};
