import { Class, Student, Subject } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { withFamilyContactList } from "../utils/studentFamily.js";
import mongoose from "mongoose";

// Create class
export let createClass = async (req, res) => {
  try {
    let data = req.body;

    // Force status to Active on creation
    data.status = 'Active';

    // Validate and clean classTeacher if provided
    if (data.classTeacher && !mongoose.Types.ObjectId.isValid(data.classTeacher)) {
      delete data.classTeacher; // Remove invalid classTeacher ID
    }

    // Transform subjects array if needed
    // If subjects is an array of strings (IDs), convert to proper embedded document structure
    if (data.subjects && Array.isArray(data.subjects)) {
      data.subjects = data.subjects
        .filter(subjectId => {
          // Filter out invalid entries
          if (typeof subjectId === 'object' && subjectId.subject) {
            return mongoose.Types.ObjectId.isValid(subjectId.subject);
          }
          return mongoose.Types.ObjectId.isValid(subjectId);
        })
        .map(subjectId => {
          // If it's already an object with 'subject' property, keep it
          if (typeof subjectId === 'object' && subjectId.subject) {
            return subjectId;
          }
          // Otherwise, convert string ID to proper structure
          return {
            subject: subjectId,
            book: {
              bookName: '',
              publication: '',
              cost: 0,
              coverPhoto: ''
            }
          };
        });
    }

    const result = await Class.create(data);
    res.status(201).json({
      success: true,
      message: "Class created successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all classes
export let getAllClasses = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};

    if (status) query.status = status;

    const result = await Class.find(query)
      .populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'subjectName subjectCode subjectType creditHours')
      .populate('timetable.subject', 'subjectName subjectCode')
      .populate('timetable.teacher', 'name')
      .sort({ className: 1 });

    res.status(200).json({
      success: true,
      message: "Classes fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get class by ID
export let getClassById = async (req, res) => {
  try {
    const result = await Class.findById(req.params.id)
      .populate('classTeacher', 'name email phone qualification gender status')
      .populate('subjects.subject', 'subjectName subjectCode subjectType creditHours writtenMarks practicalMarks fullMarks passMarks')
      .populate('timetable.subject', 'subjectName subjectCode')
      .populate('timetable.teacher', 'name');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    // Get enrolled students with details
    const students = await Student.find({
      currentClass: req.params.id,
      status: 'Active'
    }).select('studentId name gender rollNumber family feeBalance status')
      .populate('family')
      .sort({ rollNumber: 1, name: 1 });

    const enrolledStudents = withFamilyContactList(students);

    const classData = result.toObject();
    classData.enrolledStudents = enrolledStudents;
    classData.studentCount = enrolledStudents.length;
    classData.totalMonthlyRevenue = classData.monthlyFee * enrolledStudents.length;

    res.status(200).json({
      success: true,
      message: "Class fetched successfully",
      data: classData,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update class
export let updateClass = async (req, res) => {
  try {
    let data = req.body;

    // Validate and clean classTeacher if provided
    if (data.classTeacher && !mongoose.Types.ObjectId.isValid(data.classTeacher)) {
      delete data.classTeacher; // Remove invalid classTeacher ID
    }

    // Transform subjects array if needed
    // If subjects is an array of strings (IDs), convert to proper embedded document structure
    if (data.subjects && Array.isArray(data.subjects)) {
      data.subjects = data.subjects
        .filter(subjectId => {
          // Filter out invalid entries
          if (typeof subjectId === 'object' && subjectId.subject) {
            return mongoose.Types.ObjectId.isValid(subjectId.subject);
          }
          return mongoose.Types.ObjectId.isValid(subjectId);
        })
        .map(subjectId => {
          // If it's already an object with 'subject' property, keep it
          if (typeof subjectId === 'object' && subjectId.subject) {
            return subjectId;
          }
          // Otherwise, convert string ID to proper structure
          return {
            subject: subjectId,
            book: {
              bookName: '',
              publication: '',
              cost: 0,
              coverPhoto: ''
            }
          };
        });
    }

    const result = await Class.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    ).populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'subjectName subjectCode subjectType creditHours')
      .populate('timetable.subject', 'subjectName subjectCode')
      .populate('timetable.teacher', 'name');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Class updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete class
export let deleteClass = async (req, res) => {
  try {
    // Check if class has active students
    const studentCount = await Student.countDocuments({
      currentClass: req.params.id,
      status: 'Active'
    });

    if (studentCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete class with ${studentCount} active students`
      });
    }

    const result = await Class.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Class deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get students in a class
export let getClassStudents = async (req, res) => {
  try {
    const students = await Student.find({
      currentClass: req.params.id,
      status: 'Active'
    })
      .populate('family')
      .sort({ rollNumber: 1, name: 1 });

    res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: withFamilyContactList(students),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get timetable for a class
export let getTimetable = async (req, res) => {
  try {
    const classDoc = await Class.findById(req.params.id)
      .populate('timetable.subject', 'subjectName subjectCode')
      .populate('timetable.teacher', 'name');

    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Timetable fetched successfully",
      data: classDoc.timetable || []
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Set (replace) timetable for a class
export let setTimetable = async (req, res) => {
  try {
    const { timetable } = req.body;

    const classDoc = await Class.findById(req.params.id);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    // Replace entire timetable
    classDoc.timetable = timetable || [];
    await classDoc.save({ validateBeforeSave: true });

    // Return with populated references
    const updated = await Class.findById(req.params.id)
      .populate('timetable.subject', 'subjectName subjectCode')
      .populate('timetable.teacher', 'name');

    res.status(200).json({
      success: true,
      message: "Timetable updated successfully",
      data: updated.timetable
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update class subject book details
export let updateClassSubjectBook = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { bookName, publication, cost, coverPhoto } = req.body;

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    // Find and update the specific subject's book information
    const subjectIndex = classDoc.subjects.findIndex(
      s => s.subject.toString() === subjectId
    );

    if (subjectIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Subject not found in this class"
      });
    }

    classDoc.subjects[subjectIndex].book = {
      bookName: bookName || '',
      publication: publication || '',
      cost: cost || 0,
      coverPhoto: coverPhoto || ''
    };

    await classDoc.save();

    const updated = await Class.findById(classId)
      .populate('subjects.subject', 'subjectName subjectCode');

    res.status(200).json({
      success: true,
      message: "Subject book details updated successfully",
      data: updated.subjects
    });
  } catch (error) {
    handleError(res, error);
  }
};
