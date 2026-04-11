import { Notification, Student, Class } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Create notification
export let createNotification = async (req, res) => {
  try {
    const { title, message, notificationType, targetAudience, classes, recipients, sendSMS, sendPushNotification, sendEmail, scheduledDate, createdBy } = req.body;

    // Determine recipients based on targetAudience
    let finalRecipients = [];
    let totalRecipients = 0;

    if (targetAudience === 'All Parents') {
      const allStudents = await Student.find({ status: 'Active' });
      finalRecipients = allStudents.map(s => s._id);
      totalRecipients = allStudents.length;
    } else if (targetAudience === 'Class-wise') {
      const classStudents = await Student.find({
        currentClass: { $in: classes },
        status: 'Active'
      });
      finalRecipients = classStudents.map(s => s._id);
      totalRecipients = classStudents.length;
    } else if (targetAudience === 'Custom Group' || targetAudience === 'Individual') {
      finalRecipients = recipients;
      totalRecipients = recipients.length;
    }

    // Create notification
    const notification = await Notification.create({
      title,
      message,
      notificationType,
      targetAudience,
      classes: targetAudience === 'Class-wise' ? classes : [],
      recipients: finalRecipients,
      sendSMS: sendSMS || false,
      sendPushNotification: sendPushNotification !== undefined ? sendPushNotification : true,
      sendEmail: sendEmail || false,
      status: scheduledDate ? 'Scheduled' : 'Draft',
      scheduledDate,
      totalRecipients,
      createdBy
    });

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all notifications
export let getAllNotifications = async (req, res) => {
  try {
    const { notificationType, status, targetAudience } = req.query;
    let query = {};

    if (notificationType) query.notificationType = notificationType;
    if (status) query.status = status;
    if (targetAudience) query.targetAudience = targetAudience;

    const result = await Notification.find(query)
      .populate('classes')
      .populate('createdBy', 'username email')
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
    const result = await Notification.findById(req.params.id)
      .populate('classes')
      .populate('recipients', 'name studentId parentContact')
      .populate('createdBy', 'username email');

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
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
        message: "Notification not found"
      });
    }

    if (existing.status === 'Sent') {
      return res.status(409).json({
        success: false,
        message: "Cannot update a sent notification"
      });
    }

    const result = await Notification.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('classes recipients createdBy');

    res.status(200).json({
      success: true,
      message: "Notification updated successfully",
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
        message: "Notification not found"
      });
    }

    if (existing.status === 'Sent') {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a sent notification"
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
    const notification = await Notification.findById(req.params.id)
      .populate('recipients', 'name parentContact parentEmail');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    if (notification.status === 'Sent') {
      return res.status(409).json({
        success: false,
        message: "Notification already sent"
      });
    }

    // TODO: Implement actual SMS/Email/Push notification sending logic here
    // For now, we'll simulate it

    let successCount = 0;
    let failureCount = 0;

    // Simulate sending
    for (const recipient of notification.recipients) {
      try {
        // In production, you would call SMS API, Email service, Push notification service here

        if (notification.sendSMS && recipient.parentContact) {
          // Send SMS
          console.log(`Sending SMS to ${recipient.parentContact}: ${notification.message}`);
        }

        if (notification.sendEmail && recipient.parentEmail) {
          // Send Email
          console.log(`Sending Email to ${recipient.parentEmail}: ${notification.message}`);
        }

        if (notification.sendPushNotification) {
          // Send Push Notification
          console.log(`Sending Push to ${recipient.name}: ${notification.message}`);
        }

        successCount++;
      } catch (err) {
        failureCount++;
        console.error(`Failed to send to ${recipient.name}:`, err);
      }
    }

    // Update notification status
    notification.status = 'Sent';
    notification.sentDate = new Date();
    notification.successCount = successCount;
    notification.failureCount = failureCount;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification sent successfully",
      data: {
        totalRecipients: notification.totalRecipients,
        successCount,
        failureCount
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Send fee reminder
export let sendFeeReminder = async (req, res) => {
  try {
    const { classId, minDueAmount } = req.body;

    // Get students with dues
    let query = {
      status: 'Active',
      'feeBalance.totalDue': { $gt: minDueAmount || 0 }
    };
    if (classId) query.currentClass = classId;

    const studentsWithDues = await Student.find(query)
      .populate('currentClass');

    if (studentsWithDues.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found with pending dues"
      });
    }

    // Create notification for each student or batch notification
    const recipientIds = studentsWithDues.map(s => s._id);

    const notification = await Notification.create({
      title: 'Fee Reminder',
      message: 'Dear Parent, This is a reminder that your ward has pending school fees. Please clear the dues at the earliest. Thank you.',
      notificationType: 'Fee Reminder',
      targetAudience: 'Custom Group',
      recipients: recipientIds,
      sendSMS: true,
      sendPushNotification: true,
      status: 'Sent',
      sentDate: new Date(),
      totalRecipients: recipientIds.length,
      successCount: recipientIds.length,
      failureCount: 0
    });

    res.status(200).json({
      success: true,
      message: `Fee reminder sent to ${recipientIds.length} parents`,
      data: notification
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Send absence alert
export let sendAbsenceAlert = async (req, res) => {
  try {
    const { studentIds, date } = req.body;

    const notification = await Notification.create({
      title: 'Absence Alert',
      message: `Dear Parent, Your ward was absent from school on ${new Date(date).toLocaleDateString()}. If this is unexpected, please contact the school.`,
      notificationType: 'Attendance Alert',
      targetAudience: 'Custom Group',
      recipients: studentIds,
      sendSMS: true,
      sendPushNotification: true,
      status: 'Sent',
      sentDate: new Date(),
      totalRecipients: studentIds.length,
      successCount: studentIds.length,
      failureCount: 0
    });

    res.status(201).json({
      success: true,
      message: `Absence alert sent to ${studentIds.length} parents`,
      data: notification
    });
  } catch (error) {
    handleError(res, error);
  }
};
