#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);

const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
};

const hasFlag = (flag) => args.includes(flag);
const getRepeatedValues = (flag) =>
  args.flatMap((arg, index) => (arg === flag && index < args.length - 1 ? [args[index + 1]] : []));

const captureDir = path.resolve(getArgValue("--dir", "tmp/captures"));
const latestOnly = hasFlag("--latest");
const requiredEvents = getRepeatedValues("--require-event");

const validateWrapper = (capture, issues) => {
  if (!capture || typeof capture !== "object") {
    issues.push("capture file does not contain an object");
    return [];
  }

  const payload = capture.jsonBody;
  if (!payload || typeof payload !== "object") {
    issues.push(`${capture.id || "unknown"}: request body is not valid JSON`);
    return [];
  }

  if (typeof payload.token !== "string" || payload.token.length === 0) {
    issues.push(`${capture.id}: missing token`);
  }

  if (!Array.isArray(payload.data)) {
    issues.push(`${capture.id}: payload.data is not an array`);
    return [];
  }

  return payload.data;
};

const validateEvent = (captureId, event, issues) => {
  if (!event || typeof event !== "object") {
    issues.push(`${captureId}: event entry is not an object`);
    return null;
  }

  if (typeof event.event !== "string" || event.event.length === 0) {
    issues.push(`${captureId}: missing event name`);
  }
  if (typeof event.visitor_id !== "string" || event.visitor_id.length === 0) {
    issues.push(`${captureId}: missing visitor_id`);
  }
  if (typeof event.distinct_id !== "string" || event.distinct_id.length === 0) {
    issues.push(`${captureId}: missing distinct_id`);
  }
  if (!event.defaultProperties || typeof event.defaultProperties !== "object") {
    issues.push(`${captureId}: missing defaultProperties`);
  }
  if (
    event.eventProperties !== null &&
    event.eventProperties !== undefined &&
    typeof event.eventProperties !== "object"
  ) {
    issues.push(`${captureId}: eventProperties is not an object or null`);
  }
  if (
    event.userProperties !== null &&
    event.userProperties !== undefined &&
    typeof event.userProperties !== "object"
  ) {
    issues.push(`${captureId}: userProperties is not an object or null`);
  }

  return event.event || null;
};

let entries;
try {
  entries = await fs.readdir(captureDir);
} catch (error) {
  console.error(`Capture directory not found: ${captureDir}`);
  process.exit(1);
}

const jsonFiles = entries.filter((entry) => entry.endsWith(".json")).sort();
if (jsonFiles.length === 0) {
  console.error(`No capture files found in ${captureDir}`);
  process.exit(1);
}

const filesToRead = latestOnly ? [jsonFiles.at(-1)] : jsonFiles;
const captures = await Promise.all(
  filesToRead.map(async (fileName) => {
    const filePath = path.join(captureDir, fileName);
    const contents = await fs.readFile(filePath, "utf8");
    return JSON.parse(contents);
  })
);

const issues = [];
const eventNames = [];

for (const capture of captures) {
  const captureId = capture.id || "unknown";
  const events = validateWrapper(capture, issues);
  for (const event of events) {
    const eventName = validateEvent(captureId, event, issues);
    if (eventName) {
      eventNames.push(eventName);
    }
  }
}

for (const requiredEvent of requiredEvents) {
  if (!eventNames.includes(requiredEvent)) {
    issues.push(`missing required event: ${requiredEvent}`);
  }
}

if (issues.length > 0) {
  console.error("Capture validation failed:");
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `Validated ${captures.length} capture file(s) from ${path.relative(process.cwd(), captureDir) || "."}.`
);
console.log(`Events: ${eventNames.join(", ")}`);
