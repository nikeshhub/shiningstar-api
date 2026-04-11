import dotenv from "dotenv";
dotenv.config();

import express, { json } from "express";
import connectToMongoDb from "./connectMongoDB.js";

const app = express();

app.use(json());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

const port = process.env.PORT || 8000;

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Shining Star API setup is running",
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`API available at http://localhost:${port}`);
});

connectToMongoDb();
