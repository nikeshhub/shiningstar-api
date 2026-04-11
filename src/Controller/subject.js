import { Subject, Class } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Create subject
export let createSubject = async (req, res) => {
  try {
    const result = await Subject.create(req.body);
    res.status(201).json({
      success: true,
      message: "Subject created successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all subjects
export let getAllSubjects = async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { subjectName: { $regex: search, $options: 'i' } },
        { subjectCode: { $regex: search, $options: 'i' } }
      ];
    }

    const result = await Subject.find(query)
      .sort({ subjectName: 1 });

    res.status(200).json({
      success: true,
      message: "Subjects fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get subject by ID
export let getSubjectById = async (req, res) => {
  try {
    const result = await Subject.findById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Subject fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update subject
export let updateSubject = async (req, res) => {
  try {
    const result = await Subject.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Subject updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete subject
export let deleteSubject = async (req, res) => {
  try {
    // Check if subject is used in any class
    const classCount = await Class.countDocuments({
      $or: [
        { 'subjects.subject': req.params.id },
        { 'timetable.subject': req.params.id }
      ]
    });

    if (classCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete subject used in ${classCount} class(es). Remove from classes first.`
      });
    }

    const result = await Subject.findByIdAndDelete(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Subject not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Subject deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};
