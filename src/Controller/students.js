import { Student } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Create student
export let createStudent = async (req, res) => {
  try {
    let data = req.body;

    // Handle file uploads from multer
    if (req.files) {
      if (req.files.photo && req.files.photo[0]) {
        data.photo = `/uploads/student-photos/${req.files.photo[0].filename}`;
      }
      if (req.files.birthCertificate && req.files.birthCertificate[0]) {
        data.birthCertificate = `/uploads/birth-certificates/${req.files.birthCertificate[0].filename}`;
      }
    }

    // Force status to Active on creation
    data.status = 'Active';

    // Auto-generate studentId if not provided
    if (!data.studentId) {
      const lastStudent = await Student.findOne().sort({ createdAt: -1 });
      const lastId = lastStudent ? parseInt(lastStudent.studentId.replace('STU', '')) : 0;
      data.studentId = `STU${String(lastId + 1).padStart(5, '0')}`;
    }

    let result = await Student.create(data);
    res.status(201).json({
      success: true,
      message: "Student added successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all students
export let readAllStudents = async (req, res) => {
  try {
    const { class: classId, status, search } = req.query;
    let query = {};

    if (classId) query.currentClass = classId;
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { studentId: { $regex: search, $options: 'i' } },
        { parentContact: { $regex: search, $options: 'i' } }
      ];
    }

    let result = await Student.find(query)
      .populate('currentClass')
      .populate('family')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: result,
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

    res.status(200).json({
      success: true,
      message: "Student fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update student
export let updateStudent = async (req, res) => {
  try {
    let data = req.body;

    // Handle file uploads from multer
    if (req.files) {
      if (req.files.photo && req.files.photo[0]) {
        data.photo = `/uploads/student-photos/${req.files.photo[0].filename}`;
      }
      if (req.files.birthCertificate && req.files.birthCertificate[0]) {
        data.birthCertificate = `/uploads/birth-certificates/${req.files.birthCertificate[0].filename}`;
      }
    }

    const result = await Student.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    ).populate('currentClass').populate('family');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Student updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete student
export let deleteStudent = async (req, res) => {
  try {
    const result = await Student.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

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

    if (!studentIds || studentIds.length === 0) {
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

    const validAction = action === 'repeat' ? 'Repeated' : 'Promoted';

    // Fetch students to snapshot their current state into history
    const students = await Student.find({ _id: { $in: studentIds }, status: 'Active' });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No active students found with the provided IDs"
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

    const result = await Student.findByIdAndUpdate(
      req.params.id,
      {
        lastGPSLocation: {
          latitude,
          longitude,
          timestamp: new Date()
        }
      },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Student not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "GPS location updated",
      data: result.lastGPSLocation
    });
  } catch (error) {
    handleError(res, error);
  }
};
