import { Timetable } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Get timetable slots (filter by classId, teacherId)
export let getTimetable = async (req, res) => {
  try {
    const { classId, teacherId } = req.query;
    const query = {};

    if (classId) query.class = classId;
    if (teacherId) query.teacher = teacherId;

    const result = await Timetable.find(query)
      .populate('class', 'className')
      .populate('subjects', 'subjectName subjectCode')
      .populate('teacher', 'name')
      .sort({ class: 1, period: 1 });

    res.status(200).json({
      success: true,
      message: "Timetable fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Replace timetable for the whole year (all classes + periods)
export let setTimetable = async (req, res) => {
  try {
    const { slots } = req.body;

    if (!Array.isArray(slots)) {
      return res.status(400).json({
        success: false,
        message: "slots array is required"
      });
    }

    const sanitized = slots
      .filter((slot) =>
        slot.class &&
        slot.period >= 1 &&
        slot.period <= 7 &&
        slot.teacher &&
        Array.isArray(slot.subjects) &&
        slot.subjects.length > 0
      )
      .map((slot) => ({
        class: slot.class,
        period: slot.period,
        teacher: slot.teacher,
        subjects: slot.subjects,
      }))
      .filter((slot) => slot.subjects.length > 0);

    // Validate: teacher not double-booked in same period
    const teacherUsage = {};
    for (const slot of sanitized) {
      if (!teacherUsage[slot.period]) teacherUsage[slot.period] = {};
      if (teacherUsage[slot.period][slot.teacher] && teacherUsage[slot.period][slot.teacher] !== slot.class) {
        return res.status(400).json({
          success: false,
          message: "Teacher is assigned to multiple classes in the same period"
        });
      }
      teacherUsage[slot.period][slot.teacher] = slot.class;
    }

    // Validate: subject not repeated across periods within the same class
    const subjectUsage = {};
    for (const slot of sanitized) {
      if (!subjectUsage[slot.class]) subjectUsage[slot.class] = {};
      for (const subjectId of slot.subjects) {
        if (subjectUsage[slot.class][subjectId] && subjectUsage[slot.class][subjectId] !== slot.period) {
          return res.status(400).json({
            success: false,
            message: "Subject is repeated across multiple periods in the same class"
          });
        }
        subjectUsage[slot.class][subjectId] = slot.period;
      }
    }

    await Timetable.deleteMany({});

    if (sanitized.length > 0) {
      await Timetable.insertMany(sanitized);
    }

    const result = await Timetable.find({})
      .populate('class', 'className')
      .populate('subjects', 'subjectName subjectCode')
      .populate('teacher', 'name')
      .sort({ class: 1, period: 1 });

    res.status(200).json({
      success: true,
      message: "Timetable updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};
