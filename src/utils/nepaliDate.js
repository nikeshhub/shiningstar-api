import NepaliDateModule from "nepali-date-converter";

// The package ships a UMD bundle whose default export is wrapped when loaded
// via Node's ESM resolver — unwrap it so `NepaliDate.fromAD(...)` works.
const NepaliDate = NepaliDateModule?.default || NepaliDateModule;

const DATE_ONLY_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const DATE_TIME_RE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)$/;
const pad2 = (value) => String(value).padStart(2, "0");
const cloneDate = (value) => new Date(value.getTime());
const isLikelyBSYear = (year) => year >= 2000 && year <= 2099;
const buildDateString = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;

const parseBSDateOnly = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(DATE_ONLY_RE);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  if (!isLikelyBSYear(year)) {
    return null;
  }

  try {
    return new NepaliDate(buildDateString(year, Number(monthStr), Number(dayStr)));
  } catch (error) {
    return null;
  }
};

/**
 * Bikram Sambat (BS / Nepali) date formatting helpers.
 *
 * All helpers accept a JS Date, a date string, a timestamp (ms), or nullish
 * and return a safe string ("-") when the input cannot be converted.
 *
 * Every user-facing date in the system should go through one of these
 * helpers so we stay on a single calendar.
 */

const toJsDate = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : cloneDate(value);
  }
  if (typeof value === "string") {
    const bsDate = parseBSDateOnly(value);
    if (bsDate) {
      const date = bsDate.toJsDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNepali = (value) => {
  const jsDate = toJsDate(value);
  if (!jsDate) return null;
  try {
    return NepaliDate.fromAD(jsDate);
  } catch (err) {
    return null;
  }
};

/**
 * Long-form BS date. Example: "24 Baisakh 2081"
 */
export const formatBSDate = (value, { language = "en" } = {}) => {
  const np = toNepali(value);
  if (!np) return "-";
  return np.format("DD MMMM YYYY", language);
};

/**
 * Numeric short BS date. Example: "2081/01/24"
 */
export const formatBSDateShort = (value, { language = "en" } = {}) => {
  const np = toNepali(value);
  if (!np) return "-";
  return np.format("YYYY/MM/DD", language);
};

/**
 * Day-of-week long form. Example: "Monday, 24 Baisakh 2081"
 */
export const formatBSDateWithDay = (value, { language = "en" } = {}) => {
  const np = toNepali(value);
  if (!np) return "-";
  return np.format("ddd, DD MMMM YYYY", language);
};

/**
 * BS date with AD reference in parentheses.
 * Example: "24 Baisakh 2081 (06 May 2024)"
 */
export const formatBSWithAD = (value) => {
  const jsDate = toJsDate(value);
  if (!jsDate) return "-";
  const bs = formatBSDate(jsDate);
  const ad = jsDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${bs} (${ad})`;
};

/**
 * Returns BS year/month/date fields or null.
 */
export const toBS = (value) => {
  const np = toNepali(value);
  if (!np) return null;
  return np.getBS();
};

/**
 * Normalize a BS date string (`YYYY-MM-DD` or `YYYY/MM/DD`) into `YYYY-MM-DD`.
 */
export const normalizeBSDate = (value) => {
  const bsDate = parseBSDateOnly(value);
  if (!bsDate) return "";
  return bsDate.format("YYYY-MM-DD");
};

/**
 * Convert a BS date or local BS date-time string to an AD JS Date.
 */
export const parseDateInput = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : cloneDate(value);
  }

  if (typeof value !== "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateTimeMatch = trimmed.match(DATE_TIME_RE);
  if (dateTimeMatch && isLikelyBSYear(Number(dateTimeMatch[1]))) {
    try {
      const [, yearStr, monthStr, dayStr, hourStr = "0", minuteStr = "0", secondStr = "0"] = dateTimeMatch;
      const date = new NepaliDate(
        buildDateString(Number(yearStr), Number(monthStr), Number(dayStr))
      ).toJsDate();
      date.setHours(Number(hourStr), Number(minuteStr), Number(secondStr), 0);
      return date;
    } catch (error) {
      return null;
    }
  }

  const normalizedBS = normalizeBSDate(trimmed);
  if (normalizedBS) {
    try {
      return new NepaliDate(normalizedBS).toJsDate();
    } catch (error) {
      return null;
    }
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Parse user-supplied date input and clamp it to start/end of day as needed.
 */
export const parseDateInputForBoundary = (value, { boundary = "start" } = {}) => {
  const date = parseDateInput(value);
  if (!date) return null;

  if (boundary === "start") {
    date.setHours(0, 0, 0, 0);
  } else if (boundary === "end") {
    date.setHours(23, 59, 59, 999);
  }

  return date;
};

/**
 * Convert a user-supplied date into an inclusive day range in AD.
 */
export const getDayRangeFromInput = (value) => {
  const start = parseDateInputForBoundary(value, { boundary: "start" });
  if (!start) {
    return null;
  }

  const end = cloneDate(start);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

/**
 * Convert a BS month/year pair into the corresponding inclusive AD range.
 */
export const getBSMonthRange = (year, month) => {
  const numericYear = Number(year);
  const numericMonth = Number(month);

  if (!Number.isInteger(numericYear) || !Number.isInteger(numericMonth)) {
    return null;
  }

  if (numericMonth < 1 || numericMonth > 12) {
    return null;
  }

  try {
    const start = new NepaliDate(numericYear, numericMonth - 1, 1).toJsDate();
    start.setHours(0, 0, 0, 0);

    const nextMonthStart = numericMonth === 12
      ? new NepaliDate(numericYear + 1, 0, 1).toJsDate()
      : new NepaliDate(numericYear, numericMonth, 1).toJsDate();
    const end = new Date(nextMonthStart.getTime() - 1);

    return { start, end };
  } catch (error) {
    return null;
  }
};

/**
 * Normalize known date fields in a payload to AD JS Dates.
 */
export const normalizeDateFields = (payload = {}, fields = []) => {
  const nextPayload = { ...payload };

  fields.forEach((field) => {
    if (nextPayload[field] === undefined || nextPayload[field] === null || nextPayload[field] === "") {
      return;
    }

    const parsed = parseDateInput(nextPayload[field]);
    if (parsed) {
      nextPayload[field] = parsed;
    }
  });

  return nextPayload;
};

export default {
  formatBSDate,
  formatBSDateShort,
  formatBSDateWithDay,
  formatBSWithAD,
  getBSMonthRange,
  getDayRangeFromInput,
  normalizeBSDate,
  normalizeDateFields,
  parseDateInput,
  parseDateInputForBoundary,
  toBS,
};
