export const toPlainId = (value) => {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value._id || value.id || null;
  }

  return value;
};

export const normalizeIdArray = (values) => {
  const list = Array.isArray(values) ? values : values ? [values] : [];

  return [...new Set(
    list
      .map(toPlainId)
      .map((id) => id?.toString?.() || null)
      .filter(Boolean)
  )];
};

export const dedupeStudentsByFamily = (students = []) => {
  const seen = new Set();
  const uniqueStudents = [];

  for (const student of students) {
    const familyId =
      student?.family?._id?.toString?.()
      || student?.family?.toString?.()
      || `student:${student?._id?.toString?.() || student?._id || student?.studentId || Math.random()}`;

    if (seen.has(familyId)) {
      continue;
    }

    seen.add(familyId);
    uniqueStudents.push(student);
  }

  return uniqueStudents;
};

export const deriveNotificationStatus = (scheduledDate) =>
  scheduledDate ? "Scheduled" : "Draft";

export const selectedNotificationChannels = ({
  sendSMS,
  sendEmail,
  sendPushNotification,
}) => {
  const channels = [];

  if (sendSMS) {
    channels.push("SMS");
  }

  if (sendEmail) {
    channels.push("Email");
  }

  if (sendPushNotification) {
    channels.push("App");
  }

  return channels;
};
