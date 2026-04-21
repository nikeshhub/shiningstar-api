import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Family, Teacher, User } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { isEmailConfigured, sendEmail } from "./emailService.js";
import { isSmsConfigured, sendSms } from "./smsService.js";

const LOGIN_URL = process.env.APP_LOGIN_URL || "http://localhost:3000/login";
const SCHOOL_NAME = "Shining Star English School";
const TARGET_TYPES = {
  TEACHER: "Teacher",
  PARENT: "Parent",
};

const createHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const parseOptionalBoolean = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return undefined;
};

const buildSearchRegex = (value) => new RegExp(String(value || "").trim(), "i");

const sanitizeEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  return email || undefined;
};

const createTemporaryPassword = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%";
  return Array.from(crypto.randomBytes(12)).map((byte) => alphabet[byte % alphabet.length]).join("");
};

const formatLoginIdentifiers = ({ phoneNumber, email }) => {
  const parts = [];

  if (email) {
    parts.push(`email ${email}`);
  }

  if (phoneNumber) {
    parts.push(`phone ${phoneNumber}`);
  }

  return parts.join(" or ");
};

const buildCredentialContent = ({ role, recipientName, phoneNumber, email, temporaryPassword }) => {
  const loginIdentifiers = formatLoginIdentifiers({ phoneNumber, email });
  const text = [
    `Namaste ${recipientName || "User"},`,
    "",
    `Your ${SCHOOL_NAME} ${role} account is ready.`,
    `Login: ${LOGIN_URL}`,
    `Use: ${loginIdentifiers || "your assigned school account"}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    "Please sign in and change your password after first login.",
  ].join("\n");

  const html = `
    <p>Namaste ${recipientName || "User"},</p>
    <p>Your <strong>${SCHOOL_NAME}</strong> ${role} account is ready.</p>
    <p><strong>Login:</strong> <a href="${LOGIN_URL}">${LOGIN_URL}</a></p>
    <p><strong>Use:</strong> ${loginIdentifiers || "your assigned school account"}</p>
    <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
    <p>Please sign in and change your password after first login.</p>
  `;

  const smsText = `${SCHOOL_NAME}: ${role} login ready. Use ${loginIdentifiers || "your school account"} at ${LOGIN_URL}. Temporary password: ${temporaryPassword}`;

  return {
    subject: `${SCHOOL_NAME} account credentials`,
    text,
    html,
    smsText,
  };
};

const buildTeacherTargetResponse = (teacher, linkedUser) => ({
  targetId: teacher._id,
  targetType: TARGET_TYPES.TEACHER,
  profileModel: "Teacher",
  role: "Teacher",
  code: teacher.teacherId,
  name: teacher.name,
  phoneNumber: teacher.phone,
  email: sanitizeEmail(teacher.email),
  status: teacher.status,
  hasAccount: Boolean(linkedUser),
  linkedUser: linkedUser
    ? {
        userId: linkedUser._id,
        isActive: linkedUser.isActive,
        lastLogin: linkedUser.lastLogin,
        email: linkedUser.email,
        phoneNumber: linkedUser.phoneNumber,
      }
    : null,
});

const buildParentTargetResponse = (family, linkedUser) => ({
  targetId: family._id,
  targetType: TARGET_TYPES.PARENT,
  profileModel: "Family",
  role: "Parent",
  code: family.familyId,
  name: family.primaryContact?.name || family.secondaryContact?.name || "Parent",
  relation: family.primaryContact?.relation || family.secondaryContact?.relation || "",
  phoneNumber: family.primaryContact?.mobile || family.secondaryContact?.mobile || "",
  email: sanitizeEmail(family.primaryContact?.email || family.secondaryContact?.email),
  status: family.status,
  hasAccount: Boolean(linkedUser),
  linkedUser: linkedUser
    ? {
        userId: linkedUser._id,
        isActive: linkedUser.isActive,
        lastLogin: linkedUser.lastLogin,
        email: linkedUser.email,
        phoneNumber: linkedUser.phoneNumber,
      }
    : null,
});

const mapUsersByProfile = (users = []) =>
  new Map(users.map((user) => [`${user.profileModel}:${String(user.profile)}`, user]));

const findReusableUser = async ({ role, profileId, profileModel, phoneNumber, email }) => {
  const linkedUser = await User.findOne({
    role,
    profile: profileId,
    profileModel,
  });

  if (linkedUser) {
    return linkedUser;
  }

  const contactClauses = [{ phoneNumber }];
  if (email) {
    contactClauses.push({ email });
  }

  const candidates = await User.find({ $or: contactClauses });
  if (candidates.length === 0) {
    return null;
  }

  const safeCandidate = candidates.find((candidate) => {
    const sameRole = candidate.role === role;
    const hasNoProfile = !candidate.profile && !candidate.profileModel;
    const sameProfile =
      candidate.profileModel === profileModel
      && String(candidate.profile) === String(profileId);

    return sameRole && (hasNoProfile || sameProfile);
  });

  if (!safeCandidate) {
    throw createHttpError(
      409,
      "An existing user already uses the same phone number or email. Resolve that conflict before provisioning this account."
    );
  }

  return safeCandidate;
};

const assertCredentialAvailability = async ({ currentUserId, phoneNumber, email }) => {
  const query = [{ phoneNumber }];
  if (email) {
    query.push({ email });
  }

  const conflicts = await User.find({
    _id: currentUserId ? { $ne: currentUserId } : { $exists: true },
    $or: query,
  }).select("_id role profile profileModel");

  if (conflicts.length > 0) {
    throw createHttpError(
      409,
      "Phone number or email is already assigned to another user account."
    );
  }
};

const loadProvisionTarget = async ({ targetType, targetId }) => {
  if (targetType === TARGET_TYPES.TEACHER) {
    const teacher = await Teacher.findById(targetId);
    if (!teacher) {
      throw createHttpError(404, "Teacher not found");
    }

    return {
      targetType,
      role: "Teacher",
      profileModel: "Teacher",
      profileId: teacher._id,
      name: teacher.name,
      phoneNumber: teacher.phone,
      email: sanitizeEmail(teacher.email),
      document: teacher,
    };
  }

  if (targetType === TARGET_TYPES.PARENT) {
    const family = await Family.findById(targetId);
    if (!family) {
      throw createHttpError(404, "Family not found");
    }

    return {
      targetType,
      role: "Parent",
      profileModel: "Family",
      profileId: family._id,
      name: family.primaryContact?.name || family.secondaryContact?.name || "Parent",
      phoneNumber: family.primaryContact?.mobile || family.secondaryContact?.mobile || "",
      email: sanitizeEmail(family.primaryContact?.email || family.secondaryContact?.email),
      document: family,
    };
  }

  throw createHttpError(400, "Unsupported provisioning target type");
};

const deliverProvisionedCredentials = async ({
  sendSMS: shouldSendSMS,
  sendEmail: shouldSendEmail,
  target,
  temporaryPassword,
}) => {
  const content = buildCredentialContent({
    role: target.role,
    recipientName: target.name,
    phoneNumber: target.phoneNumber,
    email: target.email,
    temporaryPassword,
  });

  const channels = [];

  if (shouldSendSMS) {
    if (!target.phoneNumber) {
      channels.push({
        channel: "SMS",
        status: "failed",
        recipient: "",
        message: "No phone number is available for this record.",
      });
    } else {
      try {
        await sendSms({ to: target.phoneNumber, text: content.smsText });
        channels.push({
          channel: "SMS",
          status: "sent",
          recipient: target.phoneNumber,
          message: "Credentials sent by SMS.",
        });
      } catch (error) {
        channels.push({
          channel: "SMS",
          status: "failed",
          recipient: target.phoneNumber,
          message: error.message || "SMS delivery failed",
        });
      }
    }
  }

  if (shouldSendEmail) {
    if (!target.email) {
      channels.push({
        channel: "Email",
        status: "failed",
        recipient: "",
        message: "No email address is available for this record.",
      });
    } else {
      try {
        await sendEmail({
          to: target.email,
          subject: content.subject,
          text: content.text,
          html: content.html,
        });
        channels.push({
          channel: "Email",
          status: "sent",
          recipient: target.email,
          message: "Credentials sent by email.",
        });
      } catch (error) {
        channels.push({
          channel: "Email",
          status: "failed",
          recipient: target.email,
          message: error.message || "Email delivery failed",
        });
      }
    }
  }

  return {
    smsConfigured: isSmsConfigured,
    emailConfigured: isEmailConfigured,
    channels,
  };
};

export const getSystemOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      roleBreakdown,
      activeTeachers,
      activeFamilies,
      teacherAccounts,
      parentAccounts,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.aggregate([
        { $group: { _id: "$role", count: { $sum: 1 } } },
      ]),
      Teacher.countDocuments({ status: "Active" }),
      Family.countDocuments({ status: "Active" }),
      User.countDocuments({ role: "Teacher", profileModel: "Teacher" }),
      User.countDocuments({ role: "Parent", profileModel: "Family" }),
      User.find()
        .select("-password")
        .sort({ createdAt: -1 })
        .limit(6),
    ]);

    const roleCounts = roleBreakdown.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          byRole: {
            SuperAdmin: roleCounts.SuperAdmin || 0,
            Admin: roleCounts.Admin || 0,
            Teacher: roleCounts.Teacher || 0,
            Parent: roleCounts.Parent || 0,
          },
        },
        provisioning: {
          activeTeachers,
          activeFamilies,
          teacherAccounts,
          parentAccounts,
          teachersPending: Math.max(activeTeachers - teacherAccounts, 0),
          parentsPending: Math.max(activeFamilies - parentAccounts, 0),
          smsConfigured: isSmsConfigured,
          emailConfigured: isEmailConfigured,
        },
        recentUsers,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getProvisionTargets = async (req, res) => {
  try {
    const { targetType = TARGET_TYPES.TEACHER, search = "", status = "Active" } = req.query;
    const hasAccount = parseOptionalBoolean(req.query.hasAccount);
    const normalizedTargetType = targetType === TARGET_TYPES.PARENT ? TARGET_TYPES.PARENT : TARGET_TYPES.TEACHER;
    const query = {};
    const trimmedSearch = String(search || "").trim();

    if (status) {
      query.status = status;
    }

    if (trimmedSearch) {
      const regex = buildSearchRegex(trimmedSearch);

      if (normalizedTargetType === TARGET_TYPES.TEACHER) {
        query.$or = [
          { teacherId: regex },
          { name: regex },
          { email: regex },
          { phone: regex },
        ];
      } else {
        query.$or = [
          { familyId: regex },
          { "primaryContact.name": regex },
          { "primaryContact.email": regex },
          { "primaryContact.mobile": regex },
          { "secondaryContact.name": regex },
          { "secondaryContact.email": regex },
          { "secondaryContact.mobile": regex },
        ];
      }
    }

    if (normalizedTargetType === TARGET_TYPES.TEACHER) {
      const teachers = await Teacher.find(query).sort({ name: 1 });
      const users = await User.find({
        role: "Teacher",
        profileModel: "Teacher",
        profile: { $in: teachers.map((teacher) => teacher._id) },
      }).select("-password");
      const usersByProfile = mapUsersByProfile(users);
      let data = teachers.map((teacher) =>
        buildTeacherTargetResponse(teacher, usersByProfile.get(`Teacher:${String(teacher._id)}`))
      );

      if (hasAccount !== undefined) {
        data = data.filter((item) => item.hasAccount === hasAccount);
      }

      return res.status(200).json({
        success: true,
        data,
      });
    }

    const families = await Family.find(query).sort({ familyId: 1 });
    const users = await User.find({
      role: "Parent",
      profileModel: "Family",
      profile: { $in: families.map((family) => family._id) },
    }).select("-password");
    const usersByProfile = mapUsersByProfile(users);
    let data = families.map((family) =>
      buildParentTargetResponse(family, usersByProfile.get(`Family:${String(family._id)}`))
    );

    if (hasAccount !== undefined) {
      data = data.filter((item) => item.hasAccount === hasAccount);
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const provisionUserAccount = async (req, res) => {
  try {
    const normalizedTargetType = req.body.targetType === TARGET_TYPES.PARENT
      ? TARGET_TYPES.PARENT
      : TARGET_TYPES.TEACHER;
    const { targetId } = req.body;
    const sendSMS = req.body.sendSMS !== false;
    const sendEmail = req.body.sendEmail === true;

    if (!targetId) {
      throw createHttpError(400, "Target ID is required");
    }

    const target = await loadProvisionTarget({
      targetType: normalizedTargetType,
      targetId,
    });

    if (!target.phoneNumber) {
      throw createHttpError(400, "A phone number is required before this account can be provisioned.");
    }

    const temporaryPassword = createTemporaryPassword();
    const existingUser = await findReusableUser(target);

    await assertCredentialAvailability({
      currentUserId: existingUser?._id,
      phoneNumber: target.phoneNumber,
      email: target.email,
    });

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);
    const user = existingUser || new User();
    const action = existingUser ? "updated" : "created";

    user.phoneNumber = target.phoneNumber;
    user.email = target.email;
    user.password = hashedPassword;
    user.role = target.role;
    user.profile = target.profileId;
    user.profileModel = target.profileModel;
    user.isActive = true;
    if (!Array.isArray(user.permissions)) {
      user.permissions = [];
    }
    await user.save();

    if (normalizedTargetType === TARGET_TYPES.PARENT) {
      target.document.user = user._id;
      await target.document.save();
    }

    const delivery = await deliverProvisionedCredentials({
      sendSMS,
      sendEmail,
      target,
      temporaryPassword,
    });

    res.status(200).json({
      success: true,
      message: `${target.role} account ${action} successfully`,
      data: {
        action,
        temporaryPassword,
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profile: user.profile,
          profileModel: user.profileModel,
        },
        target: {
          id: target.profileId,
          targetType: normalizedTargetType,
          name: target.name,
          phoneNumber: target.phoneNumber,
          email: target.email,
        },
        delivery,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};
