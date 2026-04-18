import { Family, Student, User } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import bcrypt from "bcryptjs";
import { isValidObjectId } from "mongoose";

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

    // Create the family first
    const family = await Family.create(data);

    // Auto-create parent user account
    try {
      // Check if user already exists with this phone number
      const existingUser = await User.findOne({ phoneNumber: data.primaryContact.mobile });

      if (!existingUser) {
        // Default password is phone number (parent should change after first login)
        const defaultPassword = data.primaryContact.mobile;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(defaultPassword, salt);

        const parentUser = await User.create({
          phoneNumber: data.primaryContact.mobile,
          email: data.primaryContact.email || undefined,
          password: hashedPassword,
          role: 'Parent',
          profile: family._id,
          profileModel: 'Family',
          isActive: true,
        });

        // Link user to family
        family.user = parentUser._id;
        await family.save();

        console.log(`✅ Parent user created for family ${family.familyId} - Phone: ${data.primaryContact.mobile}`);
      } else {
        console.log(`ℹ️  User already exists for phone ${data.primaryContact.mobile}`);
      }
    } catch (userError) {
      // Don't fail family creation if user creation fails
      console.error('⚠️  Error creating parent user:', userError.message);
    }

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
      .select('studentId name currentClass feeBalance admissionDate');

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

// Get family fee summary (combined dues/advance for all siblings)
export let getFamilyFeeSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const family = await Family.findById(id);
    if (!family) {
      return res.status(404).json({
        success: false,
        message: "Family not found",
      });
    }

    // Get all students in family
    const students = await Student.find({ family: id })
      .select('studentId name currentClass feeBalance')
      .populate('currentClass', 'className');

    // Calculate combined balance
    let totalDue = 0;
    let totalAdvance = 0;

    students.forEach(student => {
      totalDue += student.feeBalance?.totalDue || 0;
      totalAdvance += student.feeBalance?.totalAdvance || 0;
    });

    // Update family's fee balance
    await Family.findByIdAndUpdate(id, {
      'familyFeeBalance.totalDue': totalDue,
      'familyFeeBalance.totalAdvance': totalAdvance
    });

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
