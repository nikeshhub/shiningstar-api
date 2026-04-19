import { isValidObjectId } from "mongoose";
import { Class, Notification, Student } from "../Model/model.js";
import { sendSms } from "./smsService.js";
import {
  dedupeStudentsByFamily,
  deriveNotificationStatus,
  normalizeIdArray,
  selectedNotificationChannels,
} from "../utils/notification.js";

const RECIPIENT_POPULATE = {
  path: "recipients",
  select: "name studentId family currentClass",
  populate: {
    path: "family",
    select: "familyId primaryContact secondaryContact address",
  },
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeBoolean = (value, fallback = false) => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }

    if (value.toLowerCase() === "false") {
      return false;
    }
  }

  return Boolean(value);
};

const parseScheduledDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, "Scheduled date is invalid");
  }

  return parsed;
};

const assertValidObjectIds = (ids, label) => {
  const invalidId = ids.find((id) => !isValidObjectId(id));
  if (invalidId) {
    throw createHttpError(400, `${label} contains an invalid ID`);
  }
};

const resolveStudentsForAudience = async ({ targetAudience, classIds, recipientIds }) => {
  const studentQuery = Student.find({ status: "Active" })
    .select("name studentId family currentClass")
    .populate("family", "familyId primaryContact secondaryContact address");

  if (targetAudience === "All Parents") {
    return studentQuery.sort({ name: 1 });
  }

  if (targetAudience === "Class-wise") {
    if (classIds.length === 0) {
      throw createHttpError(400, "At least one class is required for class-wise notifications");
    }

    assertValidObjectIds(classIds, "Classes");
    const classCount = await Class.countDocuments({ _id: { $in: classIds } });
    if (classCount !== classIds.length) {
      throw createHttpError(404, "One or more selected classes were not found");
    }

    return studentQuery
      .where("currentClass").in(classIds)
      .sort({ currentClass: 1, name: 1 });
  }

  if (targetAudience === "Custom Group" || targetAudience === "Individual") {
    if (recipientIds.length === 0) {
      throw createHttpError(400, "At least one recipient is required");
    }

    if (targetAudience === "Individual" && recipientIds.length !== 1) {
      throw createHttpError(400, "Individual notifications require exactly one student recipient");
    }

    assertValidObjectIds(recipientIds, "Recipients");

    const students = await studentQuery
      .where("_id").in(recipientIds)
      .sort({ name: 1 });

    if (students.length !== recipientIds.length) {
      throw createHttpError(404, "One or more selected recipients were not found");
    }

    return students;
  }

  throw createHttpError(400, "Target audience is invalid");
};

const resolveNotificationRecipients = async ({ targetAudience, classes, recipients }) => {
  const classIds = normalizeIdArray(classes);
  const recipientIds = normalizeIdArray(recipients);
  const students = await resolveStudentsForAudience({ targetAudience, classIds, recipientIds });
  const uniqueStudents = dedupeStudentsByFamily(students);

  if (uniqueStudents.length === 0) {
    throw createHttpError(404, "No active recipients found for the selected audience");
  }

  return {
    classIds,
    recipientIds: uniqueStudents.map((student) => student._id.toString()),
    totalRecipients: uniqueStudents.length,
  };
};

const ensureChannelSelection = ({ sendSMS, sendEmail, sendPushNotification }) => {
  if (!sendSMS && !sendEmail && !sendPushNotification) {
    throw createHttpError(400, "At least one delivery channel must be selected");
  }
};

const buildLastError = (errors = []) => {
  if (errors.length === 0) {
    return null;
  }

  return errors.slice(0, 5).join(" | ");
};

const deliverToRecipient = async (notification, recipient) => {
  const deliveryErrors = [];
  let delivered = false;

  const primaryContact = recipient.family?.primaryContact;
  const secondaryContact = recipient.family?.secondaryContact;
  const recipientPhone = primaryContact?.mobile || secondaryContact?.mobile || "";

  if (notification.sendSMS) {
    try {
      await sendSms({
        to: recipientPhone,
        text: notification.message,
      });
      delivered = true;
    } catch (error) {
      deliveryErrors.push(`SMS: ${error.message}`);
    }
  }

  if (notification.sendEmail) {
    deliveryErrors.push("Email delivery is not configured");
  }

  if (notification.sendPushNotification) {
    deliveryErrors.push("App notification delivery is not configured");
  }

  if (!notification.sendSMS && !notification.sendEmail && !notification.sendPushNotification) {
    deliveryErrors.push("No delivery channel selected");
  }

  return {
    delivered,
    errors: deliveryErrors,
  };
};

const populateNotificationForDelivery = (query) =>
  query.populate(RECIPIENT_POPULATE);

export const buildNotificationData = async (payload, { createdBy } = {}) => {
  const message = String(payload.message || "").trim();
  const targetAudience = payload.targetAudience;
  const sendSMS = normalizeBoolean(payload.sendSMS, false);
  const sendEmail = normalizeBoolean(payload.sendEmail, false);
  const sendPushNotification = normalizeBoolean(payload.sendPushNotification, false);
  const scheduledDate = parseScheduledDate(payload.scheduledDate);

  if (!message) {
    throw createHttpError(400, "Notification message is required");
  }

  ensureChannelSelection({ sendSMS, sendEmail, sendPushNotification });

  if (scheduledDate && scheduledDate.getTime() <= Date.now()) {
    throw createHttpError(400, "Scheduled date must be in the future");
  }

  const { classIds, recipientIds, totalRecipients } = await resolveNotificationRecipients({
    targetAudience,
    classes: payload.classes,
    recipients: payload.recipients,
  });

  return {
    message,
    targetAudience,
    classes: targetAudience === "Class-wise" ? classIds : [],
    recipients: recipientIds,
    sendSMS,
    sendEmail,
    sendPushNotification,
    status: deriveNotificationStatus(scheduledDate),
    scheduledDate,
    sentDate: null,
    totalRecipients,
    successCount: 0,
    failureCount: 0,
    lastError: null,
    createdBy,
  };
};

export const dispatchNotificationById = async (
  notificationId,
  { allowedStatuses = ["Draft", "Scheduled", "Failed"] } = {}
) => {
  if (!isValidObjectId(notificationId)) {
    throw createHttpError(400, "Invalid notification ID");
  }

  const claimed = await populateNotificationForDelivery(
    Notification.findOneAndUpdate(
      {
        _id: notificationId,
        status: { $in: allowedStatuses },
      },
      {
        $set: {
          status: "Processing",
          lastError: null,
        },
      },
      {
        new: true,
      }
    )
  );

  if (!claimed) {
    const existing = await Notification.findById(notificationId).select("status");
    if (!existing) {
      throw createHttpError(404, "Notification not found");
    }

    if (existing.status === "Sent") {
      throw createHttpError(409, "Notification already sent");
    }

    if (existing.status === "Processing") {
      throw createHttpError(409, "Notification is already being processed");
    }

    throw createHttpError(409, `Notification cannot be sent from status "${existing.status}"`);
  }

  let successCount = 0;
  let failureCount = 0;
  const recipientErrors = [];

  for (const recipient of claimed.recipients) {
    const { delivered, errors } = await deliverToRecipient(claimed, recipient);

    if (delivered) {
      successCount += 1;
    } else {
      failureCount += 1;
      recipientErrors.push(
        `${recipient.name || recipient.studentId || recipient._id}: ${errors.join(", ")}`
      );
    }
  }

  const finalStatus = successCount > 0 ? "Sent" : "Failed";

  const updated = await Notification.findByIdAndUpdate(
    claimed._id,
    {
      $set: {
        status: finalStatus,
        sentDate: new Date(),
        successCount,
        failureCount,
        totalRecipients: claimed.recipients.length,
        lastError: buildLastError(recipientErrors),
      },
    },
    {
      new: true,
    }
  );

  return {
    notification: updated,
    summary: {
      totalRecipients: claimed.recipients.length,
      successCount,
      failureCount,
      channels: selectedNotificationChannels(claimed),
      lastError: buildLastError(recipientErrors),
    },
  };
};

export const createNotificationRecord = async (payload, { createdBy } = {}) => {
  const notificationData = await buildNotificationData(payload, { createdBy });
  const notification = await Notification.create(notificationData);

  return {
    notification,
    notificationData,
  };
};

export const createAndSendNotification = async (payload, { createdBy } = {}) => {
  const { notification } = await createNotificationRecord(payload, { createdBy });
  return dispatchNotificationById(notification._id, {
    allowedStatuses: ["Draft", "Scheduled", "Failed"],
  });
};
