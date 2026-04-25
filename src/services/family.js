import { Family, Student } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { isValidObjectId } from "mongoose";
import { canParentAccessFamilyId, getParentScope } from "../utils/accessScope.js";

const validateReferenceId = async (value, Model, label) => {
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

// Create a new family
export let createFamily = async (req, res) => {
  try {
    const data = req.body;

    // Check for duplicate primary contact mobile
    if (data.primaryContact?.mobile) {
      const existingFamily = await Family.findOne({
        'primaryContact.mobile': data.primaryContact.mobile,
      });
      if (existingFamily) {
        return res.status(409).json({
          success: false,
          message: `A family with mobile ${data.primaryContact.mobile} already exists (${existingFamily.familyId} - ${existingFamily.primaryContact.name})`,
        });
      }
    }

    // Auto-generate familyId if not provided
    if (!data.familyId) {
      const lastFamily = await Family.findOne().sort({ createdAt: -1 });
      if (lastFamily && lastFamily.familyId) {
        const lastNumber = parseInt(lastFamily.familyId.replace('FAM', ''));
        data.familyId = `FAM${String(lastNumber + 1).padStart(4, '0')}`;
      } else {
        data.familyId = 'FAM0001';
      }
    }

    // Set default status to Active if not provided
    if (!data.status) {
      data.status = 'Active';
    }

    const family = await Family.create(data);

    res.status(201).json({
      success: true,
      message: "Family created successfully",
      data: family,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all families
export let getAllFamilies = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) query.status = status;

     if (req.user?.role === "Parent") {
      const scope = await getParentScope(req);
      query._id = scope.familyId;
    }

    const families = await Family.find(query).sort({ createdAt: -1 });

    // Get student count for each family
    const familiesWithStudents = await Promise.all(
      families.map(async (family) => {
        const studentCount = await Student.countDocuments({ family: family._id });
        const students = await Student.find({ family: family._id })
          .select('studentId name currentClass')
          .populate('currentClass', 'className');

        return {
          ...family.toObject(),
          studentCount,
          students
        };
      })
    );

    res.status(200).json({
      success: true,
      message: "Families fetched successfully",
      data: familiesWithStudents,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get family by ID
export let getFamilyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessFamilyId(req, id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your family record.",
        });
      }
    }

    const family = await Family.findById(id);

    if (!family) {
      return res.status(404).json({
        success: false,
        message: "Family not found",
      });
    }

    // Get all students in this family
    const students = await Student.find({ family: id })
      .populate('currentClass', 'className monthlyFee')
      .select('studentId name currentClass admissionDate');

    res.status(200).json({
      success: true,
      message: "Family fetched successfully",
      data: {
        ...family.toObject(),
        students
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update family
export let updateFamily = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Family.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Family not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Family updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete family
export let deleteFamily = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any students are linked to this family
    const studentCount = await Student.countDocuments({ family: id });
    if (studentCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete family. ${studentCount} student(s) are linked to this family. Please reassign them first.`,
      });
    }

    const result = await Family.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Family not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Family deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get family fee summary — reads the running balance from the family ledger
export let getFamilyFeeSummary = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessFamilyId(req, id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view fee summary for your family.",
        });
      }
    }

    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: "Family not found",
      });
    }

    const students = await Student.find({ family: id })
      .select('studentId name currentClass')
      .populate('currentClass', 'className');

    const totalDue = family.familyFeeBalance?.totalDue || 0;
    const totalAdvance = family.familyFeeBalance?.totalAdvance || 0;

    res.status(200).json({
      success: true,
      message: "Family fee summary fetched successfully",
      data: {
        family,
        students,
        combinedBalance: {
          totalDue,
          totalAdvance,
          netBalance: totalDue - totalAdvance
        }
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Link student to family
export let linkStudentToFamily = async (req, res) => {
  try {
    const { familyId, studentId } = req.body;

    const familyValidation = await validateReferenceId(familyId, Family, "Family");
    if (familyValidation) {
      return res.status(familyValidation.status).json({
        success: false,
        message: familyValidation.message,
      });
    }

    const studentValidation = await validateReferenceId(studentId, Student, "Student");
    if (studentValidation) {
      return res.status(studentValidation.status).json({
        success: false,
        message: studentValidation.message,
      });
    }

    const student = await Student.findById(studentId).select("family");
    if (student.family?.toString() === familyId.toString()) {
      return res.status(200).json({
        success: true,
        message: "Student is already linked to this family",
        data: student,
      });
    }

    const updatedStudent = await Student.findByIdAndUpdate(
      studentId,
      { family: familyId },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Student linked to family successfully",
      data: updatedStudent
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Unlink student from family
export let unlinkStudentFromFamily = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: "Students must remain linked to a family. Reassign the student to a different family instead.",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Generate unique family ID
export let generateFamilyId = async (req, res) => {
  try {
    const lastFamily = await Family.findOne().sort({ createdAt: -1 });

    let newFamilyId;
    if (lastFamily && lastFamily.familyId) {
      const lastNumber = parseInt(lastFamily.familyId.replace('FAM', ''));
      newFamilyId = `FAM${String(lastNumber + 1).padStart(4, '0')}`;
    } else {
      newFamilyId = 'FAM0001';
    }

    res.status(200).json({
      success: true,
      data: { familyId: newFamilyId }
    });
  } catch (error) {
    handleError(res, error);
  }
};
