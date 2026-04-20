import { isValidObjectId } from "mongoose";
import { uploadBufferToCloudinary } from "../config/cloudinary.js";
import {
  Attendance,
  Class,
  Counter,
  Family,
  FeeTransaction,
  InventoryDistribution,
  Marks,
  Notification,
  ProgressReport,
  Student,
} from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { normalizeDateFields } from "../utils/nepaliDate.js";
import { withFamilyContact, withFamilyContactList } from "../utils/studentFamily.js";
import {
  canParentAccessStudent,
  canTeacherAccessStudent,
  getParentScope,
  getTeacherScope,
} from "../utils/accessScope.js";

const STUDENT_ID_SEQUENCE_KEY = "studentId";
const STUDENT_ID_PREFIX = "STU";
const STUDENT_ID_PAD_LENGTH = 5;

const ALLOWED_STUDENT_CREATE_FIELDS = new Set([
  "studentId",
  "name",
  "dateOfBirth",
  "gender",
  "family",
  "currentClass",
  "rollNumber",
  "admissionDate",
  "academicYear",
  "previousSchool",
  "qrCode",
  "idCardIssued",
  "idCardIssuedDate",
  "gpsEnabled",
  "documents",
  "remarks",
]);

const ALLOWED_STUDENT_UPDATE_FIELDS = new Set([
  "name",
  "dateOfBirth",
  "gender",
  "family",
  "currentClass",
  "rollNumber",
  "admissionDate",
  "academicYear",
  "previousSchool",
  "qrCode",
  "idCardIssued",
  "idCardIssuedDate",
  "gpsEnabled",
  "documents",
  "status",
  "remarks",
]);

const STUDENT_DELETE_DEPENDENCIES = [
  {
    label: "attendance records",
    count: (studentId) => Attendance.countDocuments({ "students.student": studentId }),
  },
  {
    label: "fee transactions",
    count: (studentId) => FeeTransaction.countDocuments({ student: studentId }),
  },
  {
    label: "marks records",
    count: (studentId) => Marks.countDocuments({ student: studentId }),
  },
  {
    label: "progress reports",
    count: (studentId) => ProgressReport.countDocuments({ student: studentId }),
  },
  {
    label: "inventory distributions",
    count: (studentId) => InventoryDistribution.countDocuments({ student: studentId }),
  },
  {
    label: "notifications",
    count: (studentId) => Notification.countDocuments({ recipients: studentId }),
  },
];

const pickAllowedFields = (payload = {}, allowedFields) => {
  const data = {};
  const rejectedFields = [];

  Object.entries(payload).forEach(([key, value]) => {
    if (allowedFields.has(key)) {
      data[key] = value;
      return;
    }

    rejectedFields.push(key);
  });

  return { data, rejectedFields };
};

const uploadDocumentsToCloudinary = async (files = {}) => {
  const data = {};
  const uploadedUrls = [];

  if (files.photo?.[0]) {
    const result = await uploadBufferToCloudinary(files.photo[0].buffer, 'student-photos');
    data.photo = result.secure_url;
    uploadedUrls.push(result.secure_url);
  }

  if (files.birthCertificate?.[0]) {
    const isPdf = files.birthCertificate[0].mimetype === 'application/pdf';
    const result = await uploadBufferToCloudinary(
      files.birthCertificate[0].buffer,
      'birth-certificates',
      isPdf ? 'raw' : 'image'
    );
    data.birthCertificate = result.secure_url;
    uploadedUrls.push(result.secure_url);
  }

  return { data, uploadedUrls };
};

const cleanupCloudinaryFiles = async (urls = []) => {
  await Promise.all(urls.map(url => deleteFromCloudinary(url)));
};

const respondAndCleanup = async (res, status, message, uploadedUrls = []) => {
  await cleanupCloudinaryFiles(uploadedUrls);

  return res.status(status).json({
    success: false,
    message,
  });
};

const parseStudentIdNumber = (studentId) => {
  const match = new RegExp(`^${STUDENT_ID_PREFIX}(\\d+)$`).exec(studentId || "");
  return match ? Number.parseInt(match[1], 10) : null;
};

const formatStudentId = (sequenceValue) =>
  `${STUDENT_ID_PREFIX}${String(sequenceValue).padStart(STUDENT_ID_PAD_LENGTH, "0")}`;

const ensureStudentIdCounter = async () => {
  const existingCounter = await Counter.findOne({ key: STUDENT_ID_SEQUENCE_KEY }).select("value");
  if (existingCounter) {
    return;
  }

  const lastStudent = await Student.findOne({
    studentId: new RegExp(`^${STUDENT_ID_PREFIX}\\d+$`)
  })
    .sort({ studentId: -1 })
    .select("studentId");

  const startingValue = parseStudentIdNumber(lastStudent?.studentId) || 0;

  try {
    await Counter.create({
      key: STUDENT_ID_SEQUENCE_KEY,
      value: startingValue,
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
};

const generateNextStudentId = async () => {
  await ensureStudentIdCounter();

  const counter = await Counter.findOneAndUpdate(
    { key: STUDENT_ID_SEQUENCE_KEY },
    { $inc: { value: 1 } },
    { new: true }
  );

  return formatStudentId(counter.value);
};

const syncStudentIdCounter = async (studentId) => {
  const numericValue = parseStudentIdNumber(studentId);
  if (!numericValue) {
    return;
  }

  await ensureStudentIdCounter();

  await Counter.findOneAndUpdate(
    {
      key: STUDENT_ID_SEQUENCE_KEY,
      value: { $lt: numericValue },
    },
    { $set: { value: numericValue } }
  );
};

const validateReferenceId = async (value, Model, label) => {
  if (value === undefined) {
    return null;
  }

  if (!value) {
    return {
      status: 400,
      message: `${label} ID is required`,
    };
  }

  if (!isValidObjectId(value)) {
    return {
      status: 400,
      message: `${label} ID is invalid`,
    };
  }

  const exists = await Model.exists({ _id: value });
  if (!exists) {
    return {
      status: 404,
      message: `${label} not found`,
    };
  }

  return null;
};

const validateStudentReferences = async (
  data,
  { requireFamily = false, requireCurrentClass = false } = {}
) => {
  if (requireFamily && !data.family) {
    return {
      status: 400,
      message: "Family is required",
    };
  }

  if (requireCurrentClass && !data.currentClass) {
    return {
      status: 400,
      message: "Class is required",
    };
  }

  const familyValidation = await validateReferenceId(data.family, Family, "Family");
  if (familyValidation) {
    return familyValidation;
  }

  const classValidation = await validateReferenceId(data.currentClass, Class, "Class");
  if (classValidation) {
    return classValidation;
  }

  return null;
};

const getStudentDeleteDependencies = async (studentId) => {
  const dependencyCounts = await Promise.all(
    STUDENT_DELETE_DEPENDENCIES.map(async (dependency) => ({
      label: dependency.label,
      count: await dependency.count(studentId),
    }))
  );

  return dependencyCounts.filter((dependency) => dependency.count > 0);
};

// Create student
export let createStudent = async (req, res) => {
  let uploadedUrls = [];

  try {
    const { data: uploadedData, uploadedUrls: ids } = await uploadDocumentsToCloudinary(req.files);
    uploadedUrls = ids;

    const { photo: _p, birthCertificate: _bc, ...bodyFields } = req.body;
    const { data, rejectedFields } = pickAllowedFields(bodyFields, ALLOWED_STUDENT_CREATE_FIELDS);

    if (rejectedFields.length > 0) {
      return respondAndCleanup(
        res,
        400,
        `Unsupported student fields: ${rejectedFields.join(", ")}`,
        uploadedUrls
      );
    }

    Object.assign(
      data,
      normalizeDateFields(data, ["dateOfBirth", "admissionDate", "idCardIssuedDate"])
    );

    // Force status to Active on creation
    data.status = 'Active';
    Object.assign(data, uploadedData);

    const referenceValidation = await validateStudentReferences(data, {
      requireFamily: true,
      requireCurrentClass: true,
    });
    if (referenceValidation) {
      return respondAndCleanup(
        res,
        referenceValidation.status,
        referenceValidation.message,
        uploadedUrls
      );
    }

    // Auto-generate studentId if not provided
    if (!data.studentId) {
      data.studentId = await generateNextStudentId();
    } else {
      await syncStudentIdCounter(data.studentId);
    }

    let result = await Student.create(data);
    res.status(201).json({
      success: true,
      message: "Student added successfully",
      data: result,
    });
  } catch (error) {
    await cleanupCloudinaryFiles(uploadedUrls);
    handleError(res, error);
  }
};

// Get all students
export let readAllStudents = async (req, res) => {
  try {
    const { class: classId, status, search } = req.query;
    let query = {};

    if (req.user?.role === "Teacher") {
      const scope = await getTeacherScope(req);

      if (classId && !scope.classIdSet.has(classId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your class teacher classes.",
        });
      }

      query.currentClass = classId || { $in: scope.classIds };
    } else if (classId) {
      query.currentClass = classId;
    }

    if (req.user?.role === "Parent") {
      const scope = await getParentScope(req);

      if (classId && !scope.classIdSet.has(classId)) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your family.",
        });
      }

      query.family = scope.familyId;
    }

    if (status) query.status = status;
    if (search) {
      const familyMatches = await Family.find({
        $or: [
          { "primaryContact.name": { $regex: search, $options: "i" } },
          { "primaryContact.mobile": { $regex: search, $options: "i" } },
          { "primaryContact.email": { $regex: search, $options: "i" } },
          { "secondaryContact.name": { $regex: search, $options: "i" } },
          { "secondaryContact.mobile": { $regex: search, $options: "i" } },
          { "secondaryContact.email": { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        ...(familyMatches.length > 0
          ? [{ family: { $in: familyMatches.map((family) => family._id) } }]
          : [])
      ];
    }

    let result = await Student.find(query)
      .populate('currentClass')
      .populate('family')
      .sort({ name: 1 });

    const includeFamilyFeeBalance = req.user?.role !== "Teacher";

    res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: withFamilyContactList(result, { includeFamilyFeeBalance }),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get single student
export let getStudentById = async (req, res) => {
  try {
    const result = await Student.findById(req.params.id)
      .populate({
        path: 'currentClass',
        populate: { path: 'classTeacher', select: 'name email phone' }
      })
      .populate('family');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessStudent(req, result);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessStudent(req, result);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your family.",
        });
      }
    }

    const includeFamilyFeeBalance = req.user?.role !== "Teacher";

    res.status(200).json({
      success: true,
      message: "Student fetched successfully",
      data: withFamilyContact(result, { includeFamilyFeeBalance }),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update student
export let updateStudent = async (req, res) => {
  let uploadedUrls = [];

  try {
    const { data: uploadedData, uploadedUrls: ids } = await uploadDocumentsToCloudinary(req.files);
    uploadedUrls = ids;

    const { photo: _p, birthCertificate: _bc, ...bodyFields } = req.body;
    const { data, rejectedFields } = pickAllowedFields(bodyFields, ALLOWED_STUDENT_UPDATE_FIELDS);

    if (rejectedFields.length > 0) {
      return respondAndCleanup(
        res,
        400,
        `Unsupported student fields: ${rejectedFields.join(", ")}`,
        uploadedUrls
      );
    }

    const existingStudent = await Student.findById(req.params.id);

    if (!existingStudent) {
      return respondAndCleanup(res, 404, "Student not found", uploadedUrls);
    }

    const previousPhoto = existingStudent.photo;
    const previousBirthCertificate = existingStudent.birthCertificate;
    const previousClassId = existingStudent.currentClass;
    const previousAcademicYear = existingStudent.academicYear;

    Object.assign(data, uploadedData);

    if (Object.keys(data).length === 0) {
      return respondAndCleanup(res, 400, "No valid student fields provided", uploadedUrls);
    }

    Object.assign(
      data,
      normalizeDateFields(data, ["dateOfBirth", "admissionDate", "idCardIssuedDate"])
    );

    const referenceValidation = await validateStudentReferences(data);
    if (referenceValidation) {
      return respondAndCleanup(
        res,
        referenceValidation.status,
        referenceValidation.message,
        uploadedUrls
      );
    }

    const nextClassId = data.currentClass ?? previousClassId;
    const nextAcademicYear = data.academicYear ?? previousAcademicYear;
    const classChanged = nextClassId?.toString() !== previousClassId?.toString();
    const academicYearChanged = nextAcademicYear !== previousAcademicYear;

    if (classChanged || academicYearChanged) {
      existingStudent.enrollmentHistory.push({
        class: previousClassId,
        academicYear: previousAcademicYear,
        action: classChanged ? "Promoted" : "Repeated",
        actionDate: new Date(),
      });
    }

    Object.assign(existingStudent, data);
    await existingStudent.save();

    const result = await Student.findById(existingStudent._id)
      .populate('currentClass')
      .populate('family');

    if (!result) {
      return respondAndCleanup(res, 404, "Student not found", uploadedUrls);
    }


    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: withFamilyContact(result),
    });
  } catch (error) {
    await cleanupCloudinaryFiles(uploadedUrls);
    handleError(res, error);
  }
};

// Delete student
export let deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .select("photo birthCertificate");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    const dependencies = await getStudentDeleteDependencies(student._id);
    if (dependencies.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete student with linked records: ${dependencies
          .map((dependency) => `${dependency.count} ${dependency.label}`)
          .join(", ")}`,
        data: { dependencies },
      });
    }

    await student.deleteOne();

    res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Promote or repeat students
export let promoteStudents = async (req, res) => {
  try {
    const { studentIds, newClassId, academicYear, action } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No student IDs provided"
      });
    }

    if (!newClassId || !academicYear) {
      return res.status(400).json({
        success: false,
        message: "Target class and academic year are required"
      });
    }

    const invalidStudentId = studentIds.find((studentId) => !isValidObjectId(studentId));
    if (invalidStudentId) {
      return res.status(400).json({
        success: false,
        message: `Invalid student ID: ${invalidStudentId}`,
      });
    }

    const classValidation = await validateReferenceId(newClassId, Class, "Class");
    if (classValidation) {
      return res.status(classValidation.status).json({
        success: false,
        message: classValidation.message,
      });
    }

    const uniqueStudentIds = [...new Set(studentIds)];
    const validAction = action === 'repeat' ? 'Repeated' : 'Promoted';

    // Fetch students to snapshot their current state into history
    const students = await Student.find({ _id: { $in: uniqueStudentIds }, status: 'Active' });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active students found with the provided IDs"
      });
    }

    if (students.length !== uniqueStudentIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more students were not found or are not active",
      });
    }

    // Push current class+year into each student's enrollmentHistory, then update
    const bulkOps = students.map(student => ({
      updateOne: {
        filter: { _id: student._id },
        update: {
          $push: {
            enrollmentHistory: {
              class: student.currentClass,
              academicYear: student.academicYear,
              action: validAction,
              actionDate: new Date()
            }
          },
          $set: {
            currentClass: newClassId,
            academicYear: academicYear
          }
        }
      }
    }));

    const result = await Student.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} students ${validAction.toLowerCase()} successfully`,
      data: { modifiedCount: result.modifiedCount, action: validAction }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get enrollment history for a student
export let getEnrollmentHistory = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('currentClass', 'className')
      .populate('enrollmentHistory.class', 'className')
      .populate('family');

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
          message: "Access denied. You can only view students in your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessStudent(req, student);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your family.",
        });
      }
    }

    // Build timeline: history entries + current enrollment
    const history = (student.enrollmentHistory || []).map(h => ({
      class: h.class?.className || 'Unknown',
      academicYear: h.academicYear,
      action: h.action,
      actionDate: h.actionDate
    }));

    // Append current state
    history.push({
      class: student.currentClass?.className || 'Unknown',
      academicYear: student.academicYear,
      action: 'Current',
      actionDate: null
    });

    res.status(200).json({
      success: true,
      message: "Enrollment history fetched successfully",
      data: {
        studentId: student.studentId,
        name: student.name,
        history
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update GPS location
export let updateGPSLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
      !Number.isFinite(parsedLatitude) ||
      !Number.isFinite(parsedLongitude) ||
      parsedLatitude < -90 ||
      parsedLatitude > 90 ||
      parsedLongitude < -180 ||
      parsedLongitude > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude must be valid coordinates",
      });
    }

    const student = await Student.findById(req.params.id).select("family lastGPSLocation");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessStudent(req, student);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only update GPS for students in your family.",
        });
      }
    }

    student.lastGPSLocation = {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      timestamp: new Date()
    };

    await student.save();

    res.status(200).json({
      success: true,
      message: "GPS location updated",
      data: student.lastGPSLocation
    });
  } catch (error) {
    handleError(res, error);
  }
};
