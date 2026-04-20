import { Exam, Marks, Student, Class, Subject } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getApplicableTerminals, calculateGrade, calculateGPA, calculateTotalMarks } from "../utils/gradeCalculator.js";
import { generateExamNoticePDF, generateStudentExamNotice } from "../utils/pdfGenerator.js";
import { uploadBufferToCloudinary } from "../config/cloudinary.js";
import { getRequestTeacherId } from "../utils/requestUser.js";
import { normalizeDateFields } from "../utils/nepaliDate.js";
import { postFamilyLedgerEntry } from "./fee.js";
import {
  canParentAccessStudent,
  canTeacherAccessClassId,
  canTeacherAccessStudent,
  getTeacherScope,
  normalizeObjectId,
} from "../utils/accessScope.js";

// A terminal covers three months of tuition — fee = class.monthlyFee × 3.
const MONTHS_PER_TERMINAL = 3;

const examTouchesAllowedClass = (exam, allowedClassIds) =>
  (exam?.classes || []).some((classId) => allowedClassIds.has(normalizeObjectId(classId)));

const examOnlyUsesAllowedClasses = (exam, allowedClassIds) =>
  (exam?.classes || []).every((classId) => allowedClassIds.has(normalizeObjectId(classId)));

const classRefIsAllowed = (classRef, allowedClassIds) =>
  allowedClassIds.has(normalizeObjectId(classRef));

const filterExamToAllowedClasses = (exam, allowedClassIds) => {
  const data = typeof exam?.toObject === "function" ? exam.toObject() : exam;
  const canAccessFullNotice = examOnlyUsesAllowedClasses(data, allowedClassIds);

  return {
    ...data,
    noticeGenerated: canAccessFullNotice ? data?.noticeGenerated : false,
    noticePdfUrl: canAccessFullNotice ? data?.noticePdfUrl : undefined,
    classes: (data?.classes || []).filter((classRef) =>
      classRefIsAllowed(classRef, allowedClassIds)
    ),
    routine: (data?.routine || []).filter((entry) =>
      classRefIsAllowed(entry?.class, allowedClassIds)
    ),
  };
};

// Create exam and immediately charge 3 months of tuition per student to their
// family ledger. Every exam is a terminal (1-4).
export let createExam = async (req, res) => {
  try {
    const payload = normalizeDateFields(req.body, ["startDate", "endDate"]);
    const routine = (payload.routine || []).map((entry) =>
      normalizeDateFields(entry, ["examDate"])
    );
    const { examName, terminalNumber, academicYear, classes, startDate, endDate, remarks } = payload;

    if (!terminalNumber || ![1, 2, 3, 4].includes(Number(terminalNumber))) {
      return res.status(400).json({
        success: false,
        message: "terminalNumber must be 1, 2, 3, or 4",
      });
    }

    if (!classes || classes.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one class must be selected",
      });
    }

    // Validate each class supports this terminal (e.g. Nursery skips T1).
    const classDocs = await Class.find({ _id: { $in: classes } });
    if (classDocs.length !== classes.length) {
      return res.status(404).json({
        success: false,
        message: "One or more classes not found",
      });
    }
    for (const classDoc of classDocs) {
      const applicable = getApplicableTerminals(classDoc.className);
      if (!applicable.includes(Number(terminalNumber))) {
        return res.status(400).json({
          success: false,
          message: `Terminal ${terminalNumber} is not applicable for ${classDoc.className}. Valid terminals: ${applicable.join(", ")}`,
        });
      }
    }

    const exam = await Exam.create({
      examName,
      terminalNumber,
      academicYear,
      classes,
      startDate,
      endDate,
      routine,
      status: "Scheduled",
      remarks,
      noticeGenerated: false,
    });

    await generateTerminalFees(exam, classDocs);

    const result = await Exam.findById(exam._id)
      .populate("classes", "className")
      .populate("routine.class", "className")
      .populate("routine.subject", "subjectName subjectCode");

    res.status(201).json({
      success: true,
      message: "Exam created and terminal fees charged to families",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Charge each student's family: class.monthlyFee × 3 for the terminal.
async function generateTerminalFees(exam, classDocs) {
  const classFeeById = new Map(
    classDocs.map((c) => [c._id.toString(), Number(c.monthlyFee) || 0])
  );

  // familyId -> { family, entries: [{ student, amount }] }
  const familyGroups = new Map();

  for (const classId of exam.classes) {
    const monthlyFee = classFeeById.get(classId.toString()) || 0;
    const perStudentCharge = monthlyFee * MONTHS_PER_TERMINAL;
    if (perStudentCharge <= 0) continue;

    const students = await Student.find({
      currentClass: classId,
      status: "Active",
    }).populate("family");

    for (const student of students) {
      if (!student.family) {
        console.warn(`Student ${student.studentId} has no family; skipping terminal fee`);
        continue;
      }
      const familyId = student.family._id.toString();
      if (!familyGroups.has(familyId)) {
        familyGroups.set(familyId, { family: student.family, entries: [] });
      }
      familyGroups.get(familyId).entries.push({ student, amount: perStudentCharge });
    }
  }

  for (const [familyId, group] of familyGroups) {
    const totalFee = group.entries.reduce((sum, e) => sum + e.amount, 0);
    const feeBreakdown = group.entries.map(({ student, amount }) => ({
      feeType: `Terminal ${exam.terminalNumber} Fee - ${student.name} (${MONTHS_PER_TERMINAL} months)`,
      amount,
      student: student._id,
    }));
    const billNumber = `EXAM-T${exam.terminalNumber}-${Date.now()}-FAM-${group.family.familyId}`;

    const feeTransaction = await postFamilyLedgerEntry({
      familyId,
      delta: totalFee,
      transactionType: "Charge",
      description: `${exam.examName} - ${MONTHS_PER_TERMINAL} months tuition`,
      chargeAmount: totalFee,
      billNumber,
      feeBreakdown,
      academicYear: exam.academicYear,
      remarks: `Auto-generated on exam creation for ${group.entries.length} student(s)`,
    });

    for (const { student } of group.entries) {
      try {
        const studentRoutine = exam.routine.filter(
          (r) => r.class.toString() === student.currentClass._id.toString()
        );
        const populatedRoutine = await Promise.all(
          studentRoutine.map(async (r) => {
            const subject = await Subject.findById(r.subject);
            return { ...r, subject };
          })
        );
        const pdfBuffer = await generateStudentExamNotice({
          exam,
          student,
          studentRoutine: populatedRoutine,
          feeTransaction,
          family: group.family,
        });
        await uploadBufferToCloudinary(pdfBuffer, "exam-notices", "raw");
      } catch (error) {
        console.error(`Error generating notice for student ${student.studentId}:`, error);
      }
    }
  }

  console.log(`Terminal ${exam.terminalNumber} fees generated: ${familyGroups.size} families`);
}

// Get all exams
export let getAllExams = async (req, res) => {
  try {
    const { academicYear, status, terminalNumber } = req.query;
    let query = {};
    let teacherScope = null;

    if (academicYear) query.academicYear = academicYear;
    if (status) query.status = status;
    if (terminalNumber) query.terminalNumber = parseInt(terminalNumber);

    if (req.user?.role === "Teacher") {
      teacherScope = await getTeacherScope(req);
      query.classes = { $in: teacherScope.classIds };
    }

    const result = await Exam.find(query)
      .populate('classes', 'className')
      .populate('routine.class', 'className')
      .populate('routine.subject', 'subjectName subjectCode')
      .sort({ startDate: -1 });

    const data = teacherScope
      ? result.map((exam) => filterExamToAllowedClasses(exam, teacherScope.classIdSet))
      : result;

    res.status(200).json({
      success: true,
      message: "Exams fetched successfully",
      data,
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

    if (req.user?.role === "Teacher") {
      const scope = await getTeacherScope(req);
      if (!examTouchesAllowedClass(result, scope.classIdSet)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view exams for your class teacher classes.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Exam fetched successfully",
        data: filterExamToAllowedClasses(result, scope.classIdSet),
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
    const payload = normalizeDateFields(req.body, ["startDate", "endDate"]);
    if (Array.isArray(payload.routine)) {
      payload.routine = payload.routine.map((entry) =>
        normalizeDateFields(entry, ["examDate"])
      );
    }

    const result = await Exam.findByIdAndUpdate(
      req.params.id,
      payload,
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

// Validate one subjectMarks entry against the Subject document. Returns a
// shaped-and-graded object ready for persistence, or throws a Error with
// `.status = 400` if the input violates bounds.
async function buildSubjectMarksEntry(sm) {
  const subject = await Subject.findById(sm.subject);
  if (!subject) {
    const err = new Error(`Subject not found: ${sm.subject}`);
    err.status = 404;
    throw err;
  }

  const written = Number(sm.writtenMarks) || 0;
  const practical = Number(sm.practicalMarks) || 0;

  if (written < 0 || practical < 0) {
    const err = new Error(`Marks cannot be negative for ${subject.subjectName}`);
    err.status = 400;
    throw err;
  }
  if (written > subject.writtenMarks) {
    const err = new Error(
      `Written marks (${written}) exceed max (${subject.writtenMarks}) for ${subject.subjectName}`
    );
    err.status = 400;
    throw err;
  }
  if (practical > subject.practicalMarks) {
    const err = new Error(
      `Practical marks (${practical}) exceed max (${subject.practicalMarks}) for ${subject.subjectName}`
    );
    err.status = 400;
    throw err;
  }

  const obtainedTotal = calculateTotalMarks(written, practical);
  const fullMarks = subject.fullMarks;
  const passMarks = subject.passMarks;

  const gradeData = sm.isAbsent
    ? { percentage: 0, gradePoint: 0.0, gradeLetter: 'AB' }
    : calculateGrade(obtainedTotal, fullMarks);

  return {
    entry: {
      subject: sm.subject,
      writtenMarks: written,
      practicalMarks: practical,
      totalMarks: fullMarks,
      fullMarks,
      passMarks,
      obtainedMarks: obtainedTotal,
      percentage: gradeData.percentage,
      gradePoint: gradeData.gradePoint,
      gradeLetter: gradeData.gradeLetter,
      isAbsent: sm.isAbsent || false,
      remarks: sm.remarks || '',
    },
    fullMarks,
    obtainedTotal,
  };
}

// Upsert a Marks document for one student.
async function upsertStudentMarks({ studentId, examId, classId, academicYear, terminalNumber, subjectMarks, enteredBy }) {
  let totalPossibleMarks = 0;
  let totalObtainedMarks = 0;
  const marksWithGrades = [];

  for (const sm of subjectMarks) {
    const built = await buildSubjectMarksEntry(sm);
    totalPossibleMarks += built.fullMarks;
    totalObtainedMarks += built.obtainedTotal;
    marksWithGrades.push(built.entry);
  }

  const overallPercentage = totalPossibleMarks > 0
    ? (totalObtainedMarks / totalPossibleMarks) * 100
    : 0;
  const gpaData = calculateGPA(marksWithGrades);

  const hasFailed = marksWithGrades.some((m) => !m.isAbsent && m.obtainedMarks < m.passMarks);
  const hasAbsent = marksWithGrades.some((m) => m.isAbsent);
  const result = hasFailed || hasAbsent ? 'Fail' : 'Pass';

  return Marks.findOneAndUpdate(
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
      ...(enteredBy ? { enteredBy } : {}),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

// Enter or update marks for a single student. Upserts by (student, exam).
export let enterMarks = async (req, res) => {
  try {
    const { studentId, examId, classId, academicYear, terminalNumber, subjectMarks } = req.body;
    const enteredBy = getRequestTeacherId(req);

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only enter marks for your class teacher classes.",
        });
      }
    }

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    if (exam.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: "Cannot enter marks for a cancelled exam.",
      });
    }
    if (!(exam.classes || []).some((id) => normalizeObjectId(id) === normalizeObjectId(classId))) {
      return res.status(400).json({
        success: false,
        message: "Selected exam is not assigned to this class.",
      });
    }

    const student = await Student.findById(studentId).select("currentClass");
    if (!student) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }
    if (normalizeObjectId(student.currentClass) !== normalizeObjectId(classId)) {
      return res.status(400).json({
        success: false,
        message: "Student does not belong to the selected class.",
      });
    }

    const marksEntry = await upsertStudentMarks({
      studentId, examId, classId, academicYear, terminalNumber, subjectMarks, enteredBy,
    });

    const populated = await Marks.findById(marksEntry._id)
      .populate('student', 'name studentId rollNumber')
      .populate('subjectMarks.subject', 'subjectName subjectCode');

    res.status(200).json({
      success: true,
      message: "Marks saved successfully",
      data: populated,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Bulk enter marks for multiple students.
export let bulkEnterMarks = async (req, res) => {
  try {
    const { examId, classId, academicYear, terminalNumber, studentsMarks } = req.body;
    const enteredBy = getRequestTeacherId(req);

    if (!studentsMarks || studentsMarks.length === 0) {
      return res.status(400).json({ success: false, message: "No student marks provided" });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only enter marks for your class teacher classes.",
        });
      }
    }

    const exam = await Exam.findById(examId).select("classes status");
    if (!exam) {
      return res.status(404).json({ success: false, message: "Exam not found" });
    }
    if (exam.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: "Cannot enter marks for a cancelled exam.",
      });
    }
    if (!(exam.classes || []).some((id) => normalizeObjectId(id) === normalizeObjectId(classId))) {
      return res.status(400).json({
        success: false,
        message: "Selected exam is not assigned to this class.",
      });
    }

    const results = [];
    const errors = [];

    for (const studentData of studentsMarks) {
      try {
        const { studentId, subjectMarks } = studentData;
        const student = await Student.findById(studentId).select("currentClass");
        if (!student) throw new Error("Student not found");
        if (normalizeObjectId(student.currentClass) !== normalizeObjectId(classId)) {
          throw new Error("Student does not belong to the selected class");
        }
        const marksEntry = await upsertStudentMarks({
          studentId, examId, classId, academicYear, terminalNumber, subjectMarks, enteredBy,
        });
        results.push({ studentId, success: true, marksId: marksEntry._id });
      } catch (error) {
        errors.push({
          studentId: studentData.studentId,
          success: false,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Marks processed: ${results.length} successful, ${errors.length} failed`,
      data: { successful: results, failed: errors },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete a marks entry (e.g. to re-enter after a correction).
export let deleteMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const marks = await Marks.findById(id);
    if (!marks) {
      return res.status(404).json({ success: false, message: "Marks entry not found" });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, marks.class);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only delete marks for your class teacher classes.",
        });
      }
    }

    await marks.deleteOne();
    res.status(200).json({ success: true, message: "Marks entry deleted" });
  } catch (error) {
    handleError(res, error);
  }
};

// Get student marksheet
export let getStudentMarksheet = async (req, res) => {
  try {
    const { studentId, examId } = req.query;

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessStudent(req, studentId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view marksheets for students in your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessStudent(req, studentId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view marksheets for your children.",
        });
      }
    }

    const marks = await Marks.findOne({
      student: studentId,
      exam: examId
    })
      .populate('student', 'name studentId rollNumber dateOfBirth gender')
      .populate('exam', 'examName terminalNumber academicYear startDate')
      .populate('class', 'className')
      .populate('subjectMarks.subject', 'subjectName subjectCode creditHours');

    if (!marks) {
      return res.status(404).json({
        success: false,
        message: "Marksheet not found"
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, marks.class);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view marksheets for your class teacher classes.",
        });
      }
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
    let teacherScope = null;

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessStudent(req, studentId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view marks for students in your class teacher classes.",
        });
      }

      teacherScope = await getTeacherScope(req);
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessStudent(req, studentId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view marks for your children.",
        });
      }
    }

    const marksQuery = {
      student: studentId,
      academicYear,
      terminalNumber: parseInt(terminalNumber)
    };

    if (teacherScope) {
      marksQuery.class = { $in: teacherScope.classIds };
    }

    const marks = await Marks.find(marksQuery)
      .populate('exam', 'examName terminalNumber')
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

// Get class result — computes ranks on the fly (not persisted).
export let getClassResult = async (req, res) => {
  try {
    const { classId, examId } = req.query;

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, classId);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view results for your class teacher classes.",
        });
      }
    }

    const docs = await Marks.find({ class: classId, exam: examId })
      .populate('student', 'name studentId rollNumber')
      .sort({ percentage: -1 });

    const results = docs.map((doc, index) => ({
      ...doc.toObject(),
      rank: index + 1,
    }));

    const passCount = results.filter((r) => r.result === 'Pass').length;
    const failCount = results.filter((r) => r.result === 'Fail').length;
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

    if (req.user?.role === "Teacher") {
      const scope = await getTeacherScope(req);
      if (!examTouchesAllowedClass(exam, scope.classIdSet)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only download notices for your class teacher classes.",
        });
      }

      if (!examOnlyUsesAllowedClasses(exam, scope.classIdSet)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. This exam notice includes classes outside your class teacher scope.",
        });
      }
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
