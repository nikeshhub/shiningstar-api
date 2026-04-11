import { Teacher, Class } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Create teacher
export let createTeacher = async (req, res) => {
  try {
    let data = req.body;

    // Force status to Active on creation — frontend should not control this
    data.status = 'Active';

    // Auto-generate teacherId if not provided
    if (!data.teacherId) {
      const lastTeacher = await Teacher.findOne().sort({ createdAt: -1 });
      const lastId = lastTeacher ? parseInt(lastTeacher.teacherId.replace('TCH', '')) : 0;
      data.teacherId = `TCH${String(lastId + 1).padStart(5, '0')}`;
    }

    const result = await Teacher.create(data);
    res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all teachers
export let getAllTeachers = async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = {};

    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const result = await Teacher.find(query)
      .populate('subjects', 'subjectName subjectCode')
      .sort({ name: 1 });

    res.status(200).json({
      success: true,
      message: "Teachers fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get teacher by ID
export let getTeacherById = async (req, res) => {
  try {
    const result = await Teacher.findById(req.params.id)
      .populate('subjects', 'subjectName subjectCode')
      .populate('assignedClasses.class', 'className')
      .populate('assignedClasses.subject', 'subjectName');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    // Get classes where this teacher is the class teacher
    const classesTeaching = await Class.find({
      classTeacher: req.params.id
    }).select('className capacity monthlyFee status');

    const teacherData = result.toObject();
    teacherData.classesTeaching = classesTeaching;

    res.status(200).json({
      success: true,
      message: "Teacher fetched successfully",
      data: teacherData,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update teacher
export let updateTeacher = async (req, res) => {
  try {
    const result = await Teacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('subjects', 'subjectName subjectCode');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete teacher
export let deleteTeacher = async (req, res) => {
  try {
    // Check if teacher is assigned as class teacher
    const classCount = await Class.countDocuments({
      classTeacher: req.params.id
    });

    if (classCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete teacher assigned to ${classCount} class(es). Reassign first.`
      });
    }

    const result = await Teacher.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Teacher deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};
