import dotenv from "dotenv";

dotenv.config();

const allowedNodeEnvs = new Set(["development", "test", "production"]);

const getOptionalEnv = (name, fallback = "") => {
  const value = process.env[name]?.trim();
  return value || fallback;
};

export const getRequiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const parsePortEnv = (name, fallback) => {
  const value = getOptionalEnv(name, String(fallback));
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return port;
};

const parseBooleanEnv = (name, fallback) => {
  const value = getOptionalEnv(name, fallback).toLowerCase();

  if (value !== "true" && value !== "false") {
    throw new Error(`${name} must be either "true" or "false"`);
  }

  return value === "true";
};

const parseCsvEnv = (name) =>
  getOptionalEnv(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const validateOrigins = (origins) => {
  for (const origin of origins) {
    try {
      const parsedOrigin = new URL(origin);

      if (!["http:", "https:"].includes(parsedOrigin.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error(`${origin} in ALLOWED_ORIGINS must be a valid http(s) origin`);
    }
  }
};

export const NODE_ENV = getOptionalEnv("NODE_ENV", "development");

if (!allowedNodeEnvs.has(NODE_ENV)) {
  throw new Error("NODE_ENV must be one of development, test, production");
}

export const isProduction = NODE_ENV === "production";
export const PORT = parsePortEnv("PORT", 8000);

const validateProductionEnv = () => {
  if (!isProduction) return;

  getRequiredEnv("MONGODB_URI");
  getRequiredEnv("JWT_SECRET");
  getRequiredEnv("ALLOWED_ORIGINS");
};

validateProductionEnv();

export const MONGODB_URI = isProduction
  ? getRequiredEnv("MONGODB_URI")
  : getOptionalEnv("MONGODB_URI", "mongodb://localhost:27017/shining_star");

export const ALLOWED_ORIGINS = parseCsvEnv("ALLOWED_ORIGINS");
validateOrigins(ALLOWED_ORIGINS);

export const JSON_BODY_LIMIT = getOptionalEnv("JSON_BODY_LIMIT", "1mb");
export const ENABLE_API_DOCS = parseBooleanEnv(
  "ENABLE_API_DOCS",
  isProduction ? "false" : "true"
);
