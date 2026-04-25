import { Class, Inventory, Student } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { withFamilyContactList } from "../utils/studentFamily.js";
import mongoose from "mongoose";
import {
  canParentAccessClassId,
  canTeacherAccessClassId,
  getParentScope,
  getTeacherScope,
  normalizeObjectId,
} from "../utils/accessScope.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const normalizeBookLinks = (value) => {
  const rawBooks = Array.isArray(value) ? value : [];
  const seen = new Set();

  return rawBooks
    .map((book) => {
      const item = normalizeObjectId(
        book?.item
        || book?.itemId
        || book?.inventoryItem
        || book?.inventoryItemId
        || book?.bookItem
      );

      if (!item || !isValidObjectId(item) || seen.has(item)) {
        return null;
      }

      seen.add(item);

      const quantityPerStudent = Number(book?.quantityPerStudent ?? book?.quantity ?? 1);

      return {
        item,
        required: book?.required !== false,
        quantityPerStudent: Number.isFinite(quantityPerStudent) && quantityPerStudent > 0
          ? quantityPerStudent
          : 1,
        note: book?.note || "",
      };
    })
    .filter(Boolean);
};

const normalizeClassSubjects = (subjects = []) =>
  subjects
    .map((entry) => {
      const subject = normalizeObjectId(
        typeof entry === "object" && entry !== null ? entry.subject : entry
      );

      if (!subject || !isValidObjectId(subject)) {
        return null;
      }

      const bookSource = typeof entry === "object" && entry !== null
        ? entry.books || entry.bookItems || (entry.bookItem ? [entry.bookItem] : [])
        : [];

      return {
        subject,
        books: normalizeBookLinks(bookSource),
      };
    })
    .filter(Boolean);

const populateClassBooks = (query) =>
  query.populate(
    'subjects.books.item',
    'itemName itemCode itemType category publication price unitPrice quantity unit minimumQuantity status coverPhoto subject applicableClasses'
  );

const buildBookSetPayload = (body = {}) => {
  if (Array.isArray(body.books)) {
    return body.books;
  }

  const item = body.item || body.itemId || body.inventoryItem || body.inventoryItemId || body.bookItem;
  if (!item) {
    return null;
  }

  return [{
    item,
    required: body.required,
    quantityPerStudent: body.quantityPerStudent ?? body.quantity,
    note: body.note,
  }];
};

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

    if (data.subjects && Array.isArray(data.subjects)) {
      data.subjects = normalizeClassSubjects(data.subjects);
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

    if (req.user?.role === "Teacher") {
      const scope = await getTeacherScope(req);
      query._id = { $in: scope.classIds };
    }

    if (req.user?.role === "Parent") {
      const scope = await getParentScope(req);
      query._id = { $in: scope.classIds };
    }

    const result = await populateClassBooks(Class.find(query))
      .populate('classTeacher', 'name email phone')
      .populate('subjects.subject', 'subjectName subjectCode subjectType creditHours')
      .populate('timetable.subject', 'subjectName subjectCode')
      .populate('timetable.teacher', 'name')
      .sort({ className: 1 });

    const data = req.user?.role === "Admin"
      ? result
      : result.map((classDoc) => {
          const classData = classDoc.toObject();
          delete classData.monthlyFee;
          return classData;
        });

    res.status(200).json({
      success: true,
      message: "Classes fetched successfully",
      data,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get class by ID
export let getClassById = async (req, res) => {
  try {
    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, req.params.id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessClassId(req, req.params.id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view classes linked to your children.",
        });
      }
    }

    const result = await populateClassBooks(Class.findById(req.params.id))
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

    const studentsQuery = {
      currentClass: req.params.id,
      status: 'Active'
    };

    if (req.user?.role === "Parent") {
      const scope = await getParentScope(req);
      studentsQuery.family = scope.familyId;
    }

    // Get enrolled students with details. Parent requests are limited to their own children.
    const students = await Student.find(studentsQuery).select('studentId name gender rollNumber family status')
      .populate('family')
      .sort({ rollNumber: 1, name: 1 });

    const enrolledStudents = withFamilyContactList(students, {
      includeFamilyFeeBalance: req.user?.role !== "Teacher",
    });

    const classData = result.toObject();
    classData.enrolledStudents = enrolledStudents;
    classData.studentCount = enrolledStudents.length;
    classData.totalMonthlyRevenue = classData.monthlyFee * enrolledStudents.length;

    if (req.user?.role !== "Admin") {
      delete classData.monthlyFee;
      delete classData.totalMonthlyRevenue;
    }

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

    if (data.subjects && Array.isArray(data.subjects)) {
      const existingClass = await Class.findById(req.params.id).select('subjects');
      const existingBooksMap = {};
      if (existingClass) {
        existingClass.subjects.forEach(s => {
          existingBooksMap[s.subject.toString()] = s.books;
        });
      }
      const normalizedSubjects = normalizeClassSubjects(data.subjects);
      data.subjects = normalizedSubjects.map(s => ({
        ...s,
        books: existingBooksMap[s.subject.toString()] || [],
      }));
    }

    const result = await populateClassBooks(Class.findByIdAndUpdate(
      req.params.id,
      data,
      { new: true, runValidators: true }
    )).populate('classTeacher', 'name email phone')
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
    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, req.params.id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessClassId(req, req.params.id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view students in your children's classes.",
        });
      }
    }

    const studentsQuery = {
      currentClass: req.params.id,
      status: 'Active'
    };

    if (req.user?.role === "Parent") {
      const scope = await getParentScope(req);
      studentsQuery.family = scope.familyId;
    }

    const students = await Student.find(studentsQuery)
      .populate('family')
      .sort({ rollNumber: 1, name: 1 });

    res.status(200).json({
      success: true,
      message: "Students fetched successfully",
      data: withFamilyContactList(students, {
        includeFamilyFeeBalance: req.user?.role !== "Teacher",
      }),
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get timetable for a class
export let getTimetable = async (req, res) => {
  try {
    if (req.user?.role === "Teacher") {
      const allowed = await canTeacherAccessClassId(req, req.params.id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view timetable for your class teacher classes.",
        });
      }
    }

    if (req.user?.role === "Parent") {
      const allowed = await canParentAccessClassId(req, req.params.id);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view timetable for your children's classes.",
        });
      }
    }

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

// Set inventory-backed book set for a subject in a class.
// Inventory owns book name/price/publication/stock. Class subjects only store
// references plus set-specific metadata.
export let updateClassSubjectBook = async (req, res) => {
  try {
    const { classId, subjectId } = req.params;

    if (!isValidObjectId(classId) || !isValidObjectId(subjectId)) {
      return res.status(400).json({
        success: false,
        message: "Class ID or subject ID is invalid",
      });
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({
        success: false,
        message: "Class not found"
      });
    }

    const subjectIndex = classDoc.subjects.findIndex(
      s => s.subject.toString() === subjectId
    );

    if (subjectIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "Subject not found in this class"
      });
    }

    const requestedBooks = buildBookSetPayload(req.body);
    if (!requestedBooks) {
      return res.status(400).json({
        success: false,
        message: "Provide books array or an inventory item ID",
      });
    }

    const books = normalizeBookLinks(requestedBooks);
    if (books.length !== requestedBooks.length) {
      return res.status(400).json({
        success: false,
        message: "One or more book inventory item IDs are invalid or duplicated",
      });
    }

    const bookIds = books.map((book) => book.item);
    const inventoryBooks = bookIds.length
      ? await Inventory.find({ _id: { $in: bookIds } })
      : [];

    if (inventoryBooks.length !== bookIds.length) {
      return res.status(404).json({
        success: false,
        message: "One or more inventory books were not found",
      });
    }

    const normalizedClassId = normalizeObjectId(classDoc._id);
    for (const item of inventoryBooks) {
      const itemType = item.itemType || item.category;
      if (itemType !== "Books") {
        return res.status(400).json({
          success: false,
          message: `${item.itemName} is not a Books inventory item`,
        });
      }

      const existingSubjectId = normalizeObjectId(item.subject);
      if (existingSubjectId && existingSubjectId !== subjectId) {
        return res.status(400).json({
          success: false,
          message: `${item.itemName} is already linked to another subject`,
        });
      }

      item.subject = subjectId;

      const classIds = new Set(
        (item.applicableClasses || []).map((classRef) => normalizeObjectId(classRef)).filter(Boolean)
      );
      if (!classIds.has(normalizedClassId)) {
        item.applicableClasses = [...(item.applicableClasses || []), classDoc._id];
      }

      await item.save();
    }

    classDoc.subjects[subjectIndex].books = books;

    await classDoc.save();

    const updated = await populateClassBooks(Class.findById(classId))
      .populate('subjects.subject', 'subjectName subjectCode');

    res.status(200).json({
      success: true,
      message: "Subject book set updated successfully",
      data: updated.subjects
    });
  } catch (error) {
    handleError(res, error);
  }
};
