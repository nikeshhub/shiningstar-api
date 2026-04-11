import jwt from 'jsonwebtoken';
import { User } from '../Model/model.js';

const JWT_SECRET = process.env.JWT_SECRET || 'shining-star-secret-key-2081';

// Verify JWT token
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated.'
      });
    }

    // Add user to request
    req.user = {
      id: user._id,
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      profileModel: user.profileModel
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Authentication failed.'
    });
  }
};

// Check if user has required role
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Check if user has specific permission for a module
export const checkPermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    // Admin has all permissions
    if (req.user.role === 'Admin') {
      return next();
    }

    // Check user permissions
    const userPermissions = req.user.permissions || [];
    const modulePermission = userPermissions.find(p => p.module === module);

    if (!modulePermission || !modulePermission.actions.includes(action)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You don't have permission to ${action} ${module}.`
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');

      if (user && user.isActive) {
        req.user = {
          id: user._id,
          phoneNumber: user.phoneNumber,
          email: user.email,
          role: user.role,
          permissions: user.permissions,
          profileModel: user.profileModel
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};
