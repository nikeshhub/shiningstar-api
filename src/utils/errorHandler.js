// Centralized error classification for consistent HTTP status codes across all controllers
export const handleError = (res, error) => {
  // Mongoose validation error (e.g. required fields missing, invalid enum)
  if (error.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: error.message });
  }

  // Invalid ObjectId format
  if (error.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid ID format' });
  }

  // MongoDB duplicate key (unique constraint violation)
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || 'field';
    return res.status(409).json({ success: false, message: `Duplicate ${field} value` });
  }

  // Anything else is a genuine server error
  console.error('Unhandled error:', error);
  return res.status(500).json({ success: false, message: 'Internal server error' });
};
