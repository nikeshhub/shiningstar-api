import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { MONGODB_URI } from "../src/config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "..", "migrations");
const migrationFilePattern = /^\d{14}-.+\.js$/;
const collectionName = "schema_migrations";

const getMigrationFiles = async () => {
  await fs.mkdir(migrationsDir, { recursive: true });
  const files = await fs.readdir(migrationsDir);

  return files
    .filter((file) => migrationFilePattern.test(file))
    .sort();
};

const run = async () => {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    autoIndex: false,
  });

  const db = mongoose.connection.db;
  const collection = db.collection(collectionName);
  await collection.createIndex({ name: 1 }, { unique: true });

  const applied = await collection
    .find({}, { projection: { name: 1 } })
    .toArray();
  const appliedNames = new Set(applied.map((migration) => migration.name));
  const files = await getMigrationFiles();
  let pendingCount = 0;

  for (const file of files) {
    if (appliedNames.has(file)) {
      continue;
    }

    pendingCount += 1;
    const filePath = path.join(migrationsDir, file);
    const migration = await import(pathToFileURL(filePath).href);

    if (typeof migration.up !== "function") {
      throw new Error(`Migration ${file} must export an async up({ mongoose, db }) function`);
    }

    console.log(`Applying migration ${file}`);
    await migration.up({ mongoose, db });
    await collection.insertOne({
      name: file,
      appliedAt: new Date(),
    });
    console.log(`Applied migration ${file}`);
  }

  if (pendingCount === 0) {
    console.log("No pending migrations.");
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
