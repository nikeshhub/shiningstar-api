import express, { json } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./src/swagger/index.js";
import connectToMongoDb from "./connectMongoDB.js";
import { PORT } from "./src/config/env.js";
import authRouter from "./src/Routes/auth.js";
import studentRouter from "./src/Routes/students.js";
import feeRouter from "./src/Routes/fee.js";
import familyRouter from "./src/Routes/family.js";
import classRouter from "./src/Routes/class.js";
import attendanceRouter from "./src/Routes/attendance.js";
import examRouter from "./src/Routes/exam.js";
import inventoryRouter from "./src/Routes/inventory.js";
import notificationRouter from "./src/Routes/notification.js";
import teacherRouter from "./src/Routes/teachers.js";
import subjectRouter from "./src/Routes/subject.js";
import timetableRouter from "./src/Routes/timetable.js";
import teacherAttendanceRouter from "./src/Routes/teacherAttendance.js";
import progressReportRouter from "./src/Routes/progressReport.js";
import { authenticate } from "./src/Middleware/auth.js";
import { startNotificationScheduler } from "./src/services/notificationScheduler.js";

const app = express();

// Middleware
app.use(json());

// Enable CORS for frontend
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Public routes
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Shining Star School Management System API is running",
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
app.use("/api/exams", authenticate, examRouter);
app.use("/api/inventory", authenticate, inventoryRouter);
app.use("/api/notifications", authenticate, notificationRouter);
app.use("/api/teachers", authenticate, teacherRouter);
app.use("/api/subjects", authenticate, subjectRouter);
app.use("/api/timetable", authenticate, timetableRouter);
app.use("/api/teacher-attendance", authenticate, teacherAttendanceRouter);
app.use("/api/progress-reports", authenticate, progressReportRouter);

const startServer = async () => {
  await connectToMongoDb();
  startNotificationScheduler();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}`);
    console.log(`\nSwagger Docs: http://localhost:${PORT}/api-docs`);
    console.log("Authentication enabled on all routes except /api/auth");
    console.log("Login endpoint: POST /api/auth/login");
    console.log("Register endpoint: POST /api/auth/register");
  });
};

startServer();
