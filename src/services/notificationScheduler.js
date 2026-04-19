import { Notification } from "../Model/model.js";
import { dispatchNotificationById } from "./notificationEngine.js";

const POLL_INTERVAL_MS = Number(process.env.NOTIFICATION_SCHEDULE_POLL_MS || 60_000);

let schedulerHandle = null;

const processDueNotifications = async () => {
  const dueNotifications = await Notification.find({
    status: "Scheduled",
    scheduledDate: { $lte: new Date() },
  })
    .select("_id")
    .sort({ scheduledDate: 1 })
    .limit(25);

  for (const notification of dueNotifications) {
    try {
      await dispatchNotificationById(notification._id, {
        allowedStatuses: ["Scheduled"],
      });
    } catch (error) {
      console.error(`Scheduled notification ${notification._id} failed:`, error.message);
    }
  }
};

export const startNotificationScheduler = () => {
  if (schedulerHandle) {
    return schedulerHandle;
  }

  schedulerHandle = setInterval(() => {
    processDueNotifications().catch((error) => {
      console.error("Notification scheduler tick failed:", error);
    });
  }, POLL_INTERVAL_MS);

  if (typeof schedulerHandle.unref === "function") {
    schedulerHandle.unref();
  }

  processDueNotifications().catch((error) => {
    console.error("Notification scheduler initial run failed:", error);
  });

  return schedulerHandle;
};
