import test from "node:test";
import assert from "node:assert/strict";
import {
  getBSMonthRange,
  getDayRangeFromInput,
  normalizeBSDate,
  parseDateInput,
  parseDateInputForBoundary,
} from "./nepaliDate.js";

test("normalizeBSDate standardizes separators", () => {
  assert.equal(normalizeBSDate("2081/06/15"), "2081-06-15");
});

test("parseDateInput converts BS date to AD date", () => {
  const parsed = parseDateInput("2081-01-01");

  assert.ok(parsed instanceof Date);
  assert.equal(Number.isNaN(parsed.getTime()), false);
});

test("parseDateInput converts BS local datetime to AD date with time", () => {
  const parsed = parseDateInput("2081-06-15T09:45");

  assert.ok(parsed instanceof Date);
  assert.equal(parsed.getHours(), 9);
  assert.equal(parsed.getMinutes(), 45);
});

test("parseDateInputForBoundary clamps to day edges", () => {
  const start = parseDateInputForBoundary("2081-06-15", { boundary: "start" });
  const end = parseDateInputForBoundary("2081-06-15", { boundary: "end" });

  assert.equal(start.getHours(), 0);
  assert.equal(start.getMinutes(), 0);
  assert.equal(end.getHours(), 23);
  assert.equal(end.getMinutes(), 59);
});

test("getDayRangeFromInput returns inclusive range for a BS day", () => {
  const range = getDayRangeFromInput("2081-06-15");

  assert.ok(range);
  assert.equal(range.start.getHours(), 0);
  assert.equal(range.end.getHours(), 23);
  assert.equal(range.end.getMinutes(), 59);
});

test("getBSMonthRange returns the start of the month and the instant before next month", () => {
  const range = getBSMonthRange(2081, 6);

  assert.ok(range);
  assert.equal(range.start.getHours(), 0);
  assert.ok(range.end.getTime() > range.start.getTime());
});
