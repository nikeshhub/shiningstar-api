import express, { json } from "express";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/swagger/index.js";
import connectToMongoDb from "./connectMongoDB.js";
import {
  ALLOWED_ORIGINS,
  ENABLE_API_DOCS,
  JSON_BODY_LIMIT,
  NODE_ENV,
  PORT,
  isProduction,
} from "./src/config/env.js";
import authRouter from "./src/Routes/auth.js";
import studentRouter from "./src/Routes/students.js";
import feeRouter from "./src/Routes/fee.js";
import familyRouter from "./src/Routes/family.js";
import classRouter from "./src/Routes/class.js";
import attendanceRouter from "./src/Routes/attendance.js";
import inventoryRouter from "./src/Routes/inventory.js";
import notificationRouter from "./src/Routes/notification.js";
import teacherRouter from "./src/Routes/teachers.js";
import subjectRouter from "./src/Routes/subject.js";
import timetableRouter from "./src/Routes/timetable.js";
import teacherAttendanceRouter from "./src/Routes/teacherAttendance.js";
import settingsRouter from "./src/Routes/settings.js";
import { authenticate } from "./src/Middleware/auth.js";
import { startNotificationScheduler } from "./src/services/notificationScheduler.js";

const app = express();

// Middleware
app.use(json({ limit: JSON_BODY_LIMIT }));

// Enable CORS for configured frontend origins.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowAnyOrigin = !isProduction && ALLOWED_ORIGINS.length === 0;

  if (allowAnyOrigin) {
    res.header("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
  } else if (origin && req.method === "OPTIONS") {
    return res.status(403).json({
      success: false,
      message: "CORS origin is not allowed",
    });
  }

  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization",
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

// Swagger API Documentation
if (ENABLE_API_DOCS) {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Public routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Shining Star School Management System API is running",
  });
});

app.get("/health", (req, res) => {
  const mongoState = mongoose.connection.readyState;
  const databaseConnected = mongoState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    status: databaseConnected ? "ok" : "degraded",
    environment: NODE_ENV,
    uptime: process.uptime(),
    database: {
      connected: databaseConnected,
      state: mongoState,
      name: mongoose.connection.name || null,
    },
  });
});

// Authentication routes (public)
app.use("/api/auth", authRouter);

// Protected routes - require authentication
// Note: For development, you can comment out 'authenticate' middleware to test without login
app.use("/api/students", authenticate, studentRouter);
app.use("/api/fee", authenticate, feeRouter);
app.use("/api/families", authenticate, familyRouter);
app.use("/api/classes", authenticate, classRouter);
app.use("/api/attendance", authenticate, attendanceRouter);
app.use("/api/inventory", authenticate, inventoryRouter);
app.use("/api/notifications", authenticate, notificationRouter);
app.use("/api/teachers", authenticate, teacherRouter);
app.use("/api/subjects", authenticate, subjectRouter);
app.use("/api/timetable", authenticate, timetableRouter);
app.use("/api/teacher-attendance", authenticate, teacherAttendanceRouter);
app.use("/api/settings", authenticate, settingsRouter);

const startServer = async () => {
  await connectToMongoDb();
  startNotificationScheduler();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}`);
    if (ENABLE_API_DOCS) {
      console.log(`\nSwagger Docs: http://localhost:${PORT}/api-docs`);
    }
    console.log("Authentication enabled on all routes except /api/auth");
    console.log("Login endpoint: POST /api/auth/login");
    console.log("Register endpoint: POST /api/auth/register");
  });
};

startServer();
