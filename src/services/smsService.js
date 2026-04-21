import "../config/env.js";

const AAKASH_SMS_ENDPOINT = "https://sms.aakashsms.com/sms/v3/send";
const AAKASH_SMS_TOKEN = process.env.AAKASH_SMS_TOKEN || "";

const sanitizePhoneNumber = (value) => {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  return raw.replace(/[^\d+]/g, "");
};

const parseProviderBody = async (response) => {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

const readProviderErrorMessage = (body) => {
  if (!body) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  return body.message || body.error || body.detail || body.status || null;
};

export const isSmsConfigured = Boolean(AAKASH_SMS_TOKEN);

export const sendSms = async ({ to, text }) => {
  const recipient = sanitizePhoneNumber(to);
  const message = String(text || "").trim();

  if (!recipient) {
    throw new Error("SMS recipient phone number is missing");
  }

  if (!message) {
    throw new Error("SMS text is required");
  }

  if (!isSmsConfigured) {
    throw new Error("Aakash SMS is not configured. Set AAKASH_SMS_TOKEN on the backend server.");
  }

  const body = new URLSearchParams({
    auth_token: AAKASH_SMS_TOKEN,
    to: recipient,
    text: message,
  });

  const response = await fetch(AAKASH_SMS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const parsedBody = await parseProviderBody(response);

  if (!response.ok) {
    const providerMessage = readProviderErrorMessage(parsedBody);
    if (response.status === 403) {
      throw new Error(
        providerMessage
        || "Aakash SMS rejected the request. The deployed backend server IP likely needs to be whitelisted."
      );
    }

    throw new Error(
      providerMessage || `Aakash SMS request failed with status ${response.status}`
    );
  }

  return {
    to: recipient,
    provider: "Aakash SMS",
    response: parsedBody,
  };
};
