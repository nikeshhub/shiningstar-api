import { Family, Notification, Student } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { getRequestUserId } from "../utils/requestUser.js";
import { formatBSDate } from "../utils/nepaliDate.js";
import {
  buildNotificationData,
  createAndSendNotification,
  dispatchNotificationById,
} from "./notificationEngine.js";

const notificationDetailPopulate = (query) =>
  query
    .populate("classes")
    .populate({
      path: "recipients",
      select: "name studentId family currentClass",
      populate: {
        path: "family",
        select: "familyId primaryContact secondaryContact address",
      },
    })
    .populate("createdBy", "phoneNumber email role");

const fetchNotificationById = (id) =>
  notificationDetailPopulate(Notification.findById(id));

const createAlertNotification = async ({ payload, createdBy }) => {
  const result = await createAndSendNotification(payload, { createdBy });
  return Notification.findById(result.notification._id)
    .populate("classes")
    .populate("createdBy", "phoneNumber email role");
};

// Create notification
export let createNotification = async (req, res) => {
  try {
    const createdBy = getRequestUserId(req);
    const notificationData = await buildNotificationData(req.body, { createdBy });
    const notification = await Notification.create(notificationData);
    const result = await fetchNotificationById(notification._id);

    res.status(201).json({
      success: true,
      message: notificationData.status === "Scheduled"
        ? "Notification scheduled successfully"
        : "Notification created successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all notifications
export let getAllNotifications = async (req, res) => {
  try {
    const { status, targetAudience } = req.query;
    const query = {};

    if (status) query.status = status;
    if (targetAudience) query.targetAudience = targetAudience;

    const result = await Notification.find(query)
      .populate("classes")
      .populate("createdBy", "phoneNumber email role")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Notifications fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get notification by ID
export let getNotificationById = async (req, res) => {
  try {
    const result = await fetchNotificationById(req.params.id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Notification fetched successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update notification
export let updateNotification = async (req, res) => {
  try {
    const existing = await Notification.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (existing.status === "Sent" || existing.status === "Processing") {
      return res.status(409).json({
        success: false,
        message: `Cannot update a ${existing.status.toLowerCase()} notification`,
      });
    }

    const updateData = await buildNotificationData(req.body, {
      createdBy: existing.createdBy || getRequestUserId(req),
    });

    const result = await Notification.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate("classes")
      .populate("createdBy", "phoneNumber email role");

    res.status(200).json({
      success: true,
      message: updateData.status === "Scheduled"
        ? "Notification rescheduled successfully"
        : "Notification updated successfully",
      data: result,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Delete notification
export let deleteNotification = async (req, res) => {
  try {
    const existing = await Notification.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (existing.status === "Sent" || existing.status === "Processing") {
      return res.status(409).json({
        success: false,
        message: `Cannot delete a ${existing.status.toLowerCase()} notification`,
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Send notification
export let sendNotification = async (req, res) => {
  try {
    const { summary } = await dispatchNotificationById(req.params.id, {
      allowedStatuses: ["Draft", "Scheduled", "Failed"],
    });

    res.status(200).json({
      success: true,
      message: summary.failureCount > 0
        ? "Notification sent with some delivery failures"
        : "Notification sent successfully",
      data: summary,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Send fee reminder
export let sendFeeReminder = async (req, res) => {
  try {
    const { classId, minDueAmount } = req.body;
    const threshold = Number(minDueAmount) || 0;
    const createdBy = getRequestUserId(req);

    let familyQuery = {
      status: "Active",
      "familyFeeBalance.totalDue": { $gt: threshold },
    };

    if (classId) {
      const studentsInClass = await Student.find({
        currentClass: classId,
        status: "Active",
      }).select("family");

      const familyIds = [...new Set(
        studentsInClass.map((student) => student.family?.toString()).filter(Boolean)
      )];

      familyQuery = {
        ...familyQuery,
        _id: { $in: familyIds },
      };
    }

    const familiesWithDues = await Family.find(familyQuery).select("_id");

    if (familiesWithDues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No families found with pending dues",
      });
    }

    const students = await Student.find({
      family: { $in: familiesWithDues.map((family) => family._id) },
      status: "Active",
    }).select("_id");

    const notification = await createAlertNotification({
      createdBy,
      payload: {
        message: "Dear Parent, this is a reminder that your ward has pending school fees. Please clear the dues at the earliest. Thank you.",
        targetAudience: "Custom Group",
        recipients: students.map((student) => student._id),
        sendSMS: true,
        sendEmail: false,
        sendPushNotification: false,
      },
    });

    res.status(200).json({
      success: true,
      message: `Fee reminder sent to ${notification.successCount} parent${notification.successCount === 1 ? "" : "s"}`,
      data: notification,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Send absence alert
export let sendAbsenceAlert = async (req, res) => {
  try {
    const { studentIds, date } = req.body;
    const createdBy = getRequestUserId(req);

    const notification = await createAlertNotification({
      createdBy,
      payload: {
        message: `Dear Parent, your ward was absent from school on ${formatBSDate(date)} (BS). If this is unexpected, please contact the school.`,
        targetAudience: "Custom Group",
        recipients: studentIds,
        sendSMS: true,
        sendEmail: false,
        sendPushNotification: false,
      },
    });

    res.status(201).json({
      success: true,
      message: `Absence alert sent to ${notification.successCount} parent${notification.successCount === 1 ? "" : "s"}`,
      data: notification,
    });
  } catch (error) {
    handleError(res, error);
  }
};
