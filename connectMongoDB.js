import mongoose from "mongoose";
import { MONGODB_URI } from "./src/config/env.js";

// Connect to MongoDB
const connectToMongoDb = async () => {
  try {
    // Mongoose connection options for better stability
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    await mongoose.connect(MONGODB_URI, options);

    console.log(`✓ Application connected to MongoDB successfully`);
    console.log(`  Database: ${mongoose.connection.name}`);
    console.log(
      `  Host: ${mongoose.connection.host}:${mongoose.connection.port}`,
    );
  } catch (error) {
    console.error("✗ MongoDB Connection Error:");
    console.error(`  ${error.message}`);
    console.error("\nTroubleshooting steps:");
    console.error(
      "  1. Ensure MongoDB is running (brew services start mongodb-community)",
    );
    console.error("  2. Check your MONGODB_URI in .env file");
    console.error("  3. Verify MongoDB is listening on the correct port");
    process.exit(1); // Exit process with failure
  }
};

// Handle connection events
mongoose.connection.on("disconnected", () => {
  console.warn("⚠ MongoDB disconnected. Attempting to reconnect...");
});

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error.message);
});

export default connectToMongoDb;
