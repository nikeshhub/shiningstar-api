import { getRequiredEnv } from "./env.js";

export const JWT_SECRET = getRequiredEnv("JWT_SECRET");
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
