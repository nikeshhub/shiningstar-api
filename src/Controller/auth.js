import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Teacher } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || "shining-star-secret-key-2081";
const JWT_EXPIRES_IN = "7d";

// Register new user
export const register = async (req, res) => {
  try {
    const { phoneNumber, email, password, role, profile, profileModel } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { phoneNumber },
        ...(email ? [{ email }] : [])
      ]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this phone number or email already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      phoneNumber,
      email,
      password: hashedPassword,
      role,
      profile,
      profileModel,
      isActive: true,
    });

    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Login (accepts email OR phone number)
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or phone

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password",
      });
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@');
    const query = isEmail ? { email: identifier } : { phoneNumber: identifier };

    // Find user
    const user = await User.findOne(query).populate("profile");
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been deactivated. Please contact administrator.",
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = jwt.sign(
      {
        id: user._id,
        phoneNumber: user.phoneNumber,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
          profile: user.profile,
          profileModel: user.profileModel,
          permissions: user.permissions,
        },
        token,
      },
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-password")
      .populate("profile");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const { phoneNumber, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { phoneNumber, email },
      { new: true, runValidators: true }
    ).select("-password");

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Change password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Get all users (Admin only)
export const getAllUsers = async (req, res) => {
  try {
    const { role, isActive } = req.query;
    let query = {};

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const users = await User.find(query)
      .select("-password")
      .populate("profile")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Update user permissions (Admin only)
export const updateUserPermissions = async (req, res) => {
  try {
    const { userId, permissions } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { permissions },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Permissions updated successfully",
      data: user,
    });
  } catch (error) {
    handleError(res, error);
  }
};

// Deactivate/Activate user (Admin only)
export const toggleUserStatus = async (req, res) => {
  try {
    const { userId, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: user,
    });
  } catch (error) {
    handleError(res, error);
  }
};
