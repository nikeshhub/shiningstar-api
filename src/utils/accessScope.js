import { Class, Student } from "../Model/model.js";
import { getRequestFamilyId, getRequestTeacherId } from "./requestUser.js";

export const normalizeObjectId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    // If it's already a Mongoose ObjectId, convert to string directly
    if (value.constructor?.name === "ObjectId" || value._bsontype === "ObjectID") {
      return value.toString();
    }

    // Check for nested _id or id properties (with safety check to prevent infinite recursion)
    if (value._id && value._id !== value) {
      return normalizeObjectId(value._id);
    }

    if (value.id && value.id !== value) {
      return normalizeObjectId(value.id);
    }
  }

  return typeof value?.toString === "function" ? value.toString() : null;
};

export const isAdminLike = (req) =>
  ["Admin", "SuperAdmin"].includes(req.user?.role);

export const isTeacherRequest = (req) => req.user?.role === "Teacher";

export const isParentRequest = (req) => req.user?.role === "Parent";

const getScopeCache = (req) => {
  if (!req._accessScopeCache) {
    req._accessScopeCache = {};
  }

  return req._accessScopeCache;
};

export const getTeacherScope = async (req) => {
  if (!isTeacherRequest(req)) {
    return {
      teacherId: null,
      classIds: [],
      classIdSet: new Set(),
    };
  }

  const cache = getScopeCache(req);
  if (cache.teacherScope) {
    return cache.teacherScope;
  }

  const teacherId = normalizeObjectId(getRequestTeacherId(req));
  if (!teacherId) {
    const emptyScope = {
      teacherId: null,
      classIds: [],
      classIdSet: new Set(),
    };
    cache.teacherScope = emptyScope;
    return emptyScope;
  }

  // Teacher portal scope is homeroom/class-teacher only, not subject/timetable assignment.
  const classTeacherClasses = await Class.find({ classTeacher: teacherId }).select("_id");

  const classIds = new Set();

  classTeacherClasses.forEach((classDoc) => {
    const classId = normalizeObjectId(classDoc?._id);
    if (classId) {
      classIds.add(classId);
    }
  });

  const scope = {
    teacherId,
    classIds: [...classIds],
    classIdSet: classIds,
  };

  cache.teacherScope = scope;
  return scope;
};

export const getParentScope = async (req) => {
  if (!isParentRequest(req)) {
    return {
      familyId: null,
      studentIds: [],
      studentIdSet: new Set(),
      classIds: [],
      classIdSet: new Set(),
    };
  }

  const cache = getScopeCache(req);
  if (cache.parentScope) {
    return cache.parentScope;
  }

  const familyId = normalizeObjectId(getRequestFamilyId(req));
  if (!familyId) {
    const emptyScope = {
      familyId: null,
      studentIds: [],
      studentIdSet: new Set(),
      classIds: [],
      classIdSet: new Set(),
    };
    cache.parentScope = emptyScope;
    return emptyScope;
  }

  const students = await Student.find({ family: familyId }).select("_id currentClass");
  const studentIds = new Set();
  const classIds = new Set();

  students.forEach((student) => {
    const studentId = normalizeObjectId(student?._id);
    const classId = normalizeObjectId(student?.currentClass);

    if (studentId) {
      studentIds.add(studentId);
    }

    if (classId) {
      classIds.add(classId);
    }
  });

  const scope = {
    familyId,
    studentIds: [...studentIds],
    studentIdSet: studentIds,
    classIds: [...classIds],
    classIdSet: classIds,
  };

  cache.parentScope = scope;
  return scope;
};

export const canTeacherAccessClassId = async (req, classId) => {
  if (!isTeacherRequest(req)) {
    return true;
  }

  const normalizedClassId = normalizeObjectId(classId);
  if (!normalizedClassId) {
    return false;
  }

  const scope = await getTeacherScope(req);
  return scope.classIdSet.has(normalizedClassId);
};

export const canTeacherAccessStudent = async (req, studentOrId) => {
  if (!isTeacherRequest(req)) {
    return true;
  }

  const student =
    studentOrId && typeof studentOrId === "object" && !Array.isArray(studentOrId)
      ? studentOrId
      : await Student.findById(studentOrId).select("currentClass");

  if (!student) {
    return false;
  }

  return canTeacherAccessClassId(req, student.currentClass);
};

export const canParentAccessFamilyId = async (req, familyId) => {
  if (!isParentRequest(req)) {
    return true;
  }

  const normalizedFamilyId = normalizeObjectId(familyId);
  if (!normalizedFamilyId) {
    return false;
  }

  const scope = await getParentScope(req);
  return scope.familyId === normalizedFamilyId;
};

export const canParentAccessStudent = async (req, studentOrId) => {
  if (!isParentRequest(req)) {
    return true;
  }

  const student =
    studentOrId && typeof studentOrId === "object" && !Array.isArray(studentOrId)
      ? studentOrId
      : await Student.findById(studentOrId).select("family");

  if (!student) {
    return false;
  }

  const scope = await getParentScope(req);
  return scope.studentIdSet.has(normalizeObjectId(student._id))
    || scope.familyId === normalizeObjectId(student.family);
};

export const canParentAccessClassId = async (req, classId) => {
  if (!isParentRequest(req)) {
    return true;
  }

  const normalizedClassId = normalizeObjectId(classId);
  if (!normalizedClassId) {
    return false;
  }

  const scope = await getParentScope(req);
  return scope.classIdSet.has(normalizedClassId);
};
