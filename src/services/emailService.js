import "../config/env.js";
import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || process.env.EMAIL_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || process.env.EMAIL_SECURE || "false").toLowerCase() === "true";
const SMTP_USER = process.env.SMTP_USER || process.env.EMAIL_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || process.env.EMAIL_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || process.env.EMAIL_FROM || "";

let transporter;

const buildTransporter = () => {
  if (!transporter) {
    const transportConfig = {
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    };

    if (SMTP_USER) {
      transportConfig.auth = {
        user: SMTP_USER,
        pass: SMTP_PASS,
      };
    }

    transporter = nodemailer.createTransport(transportConfig);
  }

  return transporter;
};

export const isEmailConfigured = Boolean(SMTP_HOST && SMTP_PORT && SMTP_FROM);

export const sendEmail = async ({ to, subject, text, html }) => {
  const recipient = String(to || "").trim();

  if (!recipient) {
    throw new Error("Email recipient is missing");
  }

  if (!subject?.trim()) {
    throw new Error("Email subject is required");
  }

  if (!text?.trim() && !html?.trim()) {
    throw new Error("Email content is required");
  }

  if (!isEmailConfigured) {
    throw new Error("Email delivery is not configured. Set SMTP_HOST/EMAIL_HOST, SMTP_PORT/EMAIL_PORT, and SMTP_FROM/EMAIL_FROM on the backend server.");
  }

  const mailer = buildTransporter();
  const response = await mailer.sendMail({
    from: SMTP_FROM,
    to: recipient,
    subject,
    text,
    html,
  });

  return {
    to: recipient,
    provider: "SMTP",
    response,
  };
};
