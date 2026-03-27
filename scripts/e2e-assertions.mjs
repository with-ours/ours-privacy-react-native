#!/usr/bin/env node

/**
 * E2E payload assertion suite for the Ours Privacy React Native SDK.
 *
 * Reads captured HTTP payloads from the local ingest server and runs
 * assertions that map to the manual QA checklists:
 *   - Core event pipeline
 *   - Privacy / opt-in / opt-out
 *   - Deep link attribution
 *   - Identity (setVisitorId, reset)
 *
 * Exit code 0 = all pass, 1 = failures found.
 *
 * Usage:
 *   node scripts/e2e-assertions.mjs [--dir tmp/captures]
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const getArgValue = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 || index === args.length - 1 ? fallback : args[index + 1];
};
const captureDir = path.resolve(getArgValue("--dir", "tmp/captures"));

// ---------------------------------------------------------------------------
// Load captures
// ---------------------------------------------------------------------------
let entries;
try {
  entries = await fs.readdir(captureDir);
} catch {
  console.error(`Capture directory not found: ${captureDir}`);
  process.exit(1);
}

const jsonFiles = entries.filter((e) => e.endsWith(".json")).sort();
if (jsonFiles.length === 0) {
  console.error(`No capture files found in ${captureDir}`);
  process.exit(1);
}

const captures = await Promise.all(
  jsonFiles.map(async (f) => {
    const contents = await fs.readFile(path.join(captureDir, f), "utf8");
    return JSON.parse(contents);
  })
);

// Flatten all events in order with their wrapper metadata
const allEvents = [];
for (const capture of captures) {
  const payload = capture.jsonBody;
  if (!payload || !Array.isArray(payload.data)) continue;
  for (const event of payload.data) {
    allEvents.push({
      ...event,
      _token: payload.token,
      _is_manually_set_id: payload.is_manually_set_id,
      _captureId: capture.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------
const results = [];

function assert(name, condition, detail = "") {
  results.push({name, passed: !!condition, detail});
}

function findEvent(name) {
  return allEvents.find((e) => e.event === name);
}

function findAllEvents(name) {
  return allEvents.filter((e) => e.event === name);
}

function findEventAfter(name, afterIndex) {
  return allEvents.find((e, i) => i > afterIndex && e.event === name);
}

function eventIndex(name) {
  return allEvents.findIndex((e) => e.event === name);
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

// === CORE EVENT PIPELINE ===

// 1. $deep_link_opened fires on init (cold-start via initialURL)
const coldDeepLink = findEvent("$deep_link_opened");
assert(
  "Init fires $deep_link_opened",
  coldDeepLink != null,
  coldDeepLink ? `visitor_id=${coldDeepLink.visitor_id}` : "event not found"
);

// 2. $deep_link_opened has UTM params in defaultProperties
if (coldDeepLink) {
  const dp = coldDeepLink.defaultProperties || {};
  assert(
    "$deep_link_opened has utm_source in defaultProperties",
    dp.utm_source === "google",
    `got: ${dp.utm_source}`
  );
  assert(
    "$deep_link_opened has utm_medium in defaultProperties",
    dp.utm_medium === "cpc",
    `got: ${dp.utm_medium}`
  );
  assert(
    "$deep_link_opened has utm_campaign in defaultProperties",
    dp.utm_campaign === "spring_2026",
    `got: ${dp.utm_campaign}`
  );
  assert(
    "$deep_link_opened has gclid in defaultProperties",
    dp.gclid === "test_gclid_123",
    `got: ${dp.gclid}`
  );
  assert(
    "$deep_link_opened has aleid in defaultProperties",
    dp.aleid === "test_aleid_456",
    `got: ${dp.aleid}`
  );
  assert(
    "$deep_link_opened has url in eventProperties",
    coldDeepLink.eventProperties && typeof coldDeepLink.eventProperties.url === "string",
    `got: ${coldDeepLink.eventProperties?.url}`
  );
}

// 3. track() sends button_pressed with correct shape
const buttonEvent = findEvent("button_pressed");
assert(
  "track() sends button_pressed",
  buttonEvent != null,
  buttonEvent ? `visitor_id=${buttonEvent.visitor_id}` : "event not found"
);

if (buttonEvent) {
  assert(
    "button_pressed has visitor_id",
    typeof buttonEvent.visitor_id === "string" && buttonEvent.visitor_id.length > 0
  );
  assert(
    "button_pressed has distinct_id",
    typeof buttonEvent.distinct_id === "string" && buttonEvent.distinct_id.length > 0
  );
  assert(
    "button_pressed has defaultProperties",
    buttonEvent.defaultProperties != null && typeof buttonEvent.defaultProperties === "object"
  );
  assert(
    "button_pressed has eventProperties",
    buttonEvent.eventProperties != null && buttonEvent.eventProperties.button === "e2e_auto"
  );
  assert(
    "button_pressed has token",
    buttonEvent._token === "demo-token",
    `got: ${buttonEvent._token}`
  );

  // defaultProperties has device info
  const dp = buttonEvent.defaultProperties;
  assert(
    "button_pressed defaultProperties has os_name",
    typeof dp.os_name === "string" && dp.os_name.length > 0,
    `got: ${dp.os_name}`
  );
  assert(
    "button_pressed defaultProperties has device_type",
    dp.device_type === "mobile",
    `got: ${dp.device_type}`
  );
  assert(
    "button_pressed defaultProperties has version",
    typeof dp.version === "string" && dp.version.length > 0,
    `got: ${dp.version}`
  );

  // Cold-start attribution persists to subsequent events
  assert(
    "Attribution persists to track event (utm_source)",
    dp.utm_source === "google",
    `got: ${dp.utm_source}`
  );
}

// 4. identify() sends $identify with userProperties
const identifyEvent = findEvent("$identify");
assert(
  "identify() sends $identify",
  identifyEvent != null
);

if (identifyEvent) {
  const up = identifyEvent.userProperties || {};
  assert(
    "$identify has email in userProperties",
    up.email === "e2e-user@example.com",
    `got: ${up.email}`
  );
  assert(
    "$identify has external_id in userProperties",
    up.external_id === "e2e-user-123",
    `got: ${up.external_id}`
  );
  assert(
    "$identify has custom_properties",
    up.custom_properties && up.custom_properties.plan === "e2e",
    `got: ${JSON.stringify(up.custom_properties)}`
  );
  assert(
    "$identify has same visitor_id as track events",
    buttonEvent && identifyEvent.visitor_id === buttonEvent.visitor_id,
    `identify=${identifyEvent.visitor_id}, track=${buttonEvent?.visitor_id}`
  );
  assert(
    "$identify has different distinct_id from track",
    buttonEvent && identifyEvent.distinct_id !== buttonEvent.distinct_id
  );
}

// 5. updateDefaultEventProperties merges into next event
const defaultsEvent = findEvent("defaults_updated");
assert(
  "defaults_updated event exists",
  defaultsEvent != null
);

if (defaultsEvent) {
  assert(
    "defaults_updated has merged eventProperties.last_action",
    defaultsEvent.eventProperties && defaultsEvent.eventProperties.last_action === "update_defaults",
    `got: ${defaultsEvent.eventProperties?.last_action}`
  );
  // updateDefaultUserConsentProperties merges into userProperties.consent
  const up = defaultsEvent.userProperties || {};
  assert(
    "defaults_updated has consent.marketing=true in userProperties",
    up.consent && up.consent.marketing === true,
    `got: ${JSON.stringify(up.consent)}`
  );
}

// === PRIVACY / OPT-IN / OPT-OUT ===

// 6. should_not_appear must NOT exist (opted-out event suppressed)
const leaked = findEvent("should_not_appear");
assert(
  "Opted-out events are suppressed (should_not_appear absent)",
  leaked == null,
  leaked ? `LEAKED: found should_not_appear event` : "correctly absent"
);

// 7. $opt_in fires after opt-in
const optInEvent = findEvent("$opt_in");
assert(
  "$opt_in event fires after optInTracking()",
  optInEvent != null
);

if (optInEvent) {
  // Opt-out should preserve visitor_id so opt-in resumes as the same visitor.
  assert(
    "$opt_in has same visitor_id as pre-opt-out events",
    buttonEvent && optInEvent.visitor_id === buttonEvent.visitor_id,
    `opt_in=${optInEvent.visitor_id}, track=${buttonEvent?.visitor_id}`
  );
  assert(
    "$opt_in has defaultProperties",
    optInEvent.defaultProperties != null && typeof optInEvent.defaultProperties === "object"
  );
}

// 8. after_opt_in event exists (tracking resumes)
const afterOptIn = findEvent("after_opt_in");
assert(
  "Tracking resumes after opt-in (after_opt_in exists)",
  afterOptIn != null
);

// === DEEP LINK ATTRIBUTION (warm start) ===

const deepLinkEvents = findAllEvents("$deep_link_opened");
const warmDeepLink = deepLinkEvents.length > 1 ? deepLinkEvents[deepLinkEvents.length - 1] : null;

assert(
  "Warm-start trackDeepLink fires $deep_link_opened",
  warmDeepLink != null
);

if (warmDeepLink) {
  const dp = warmDeepLink.defaultProperties || {};
  assert(
    "Warm deep link has new utm_source=applovin",
    dp.utm_source === "applovin",
    `got: ${dp.utm_source}`
  );
  assert(
    "Warm deep link has utm_medium=display",
    dp.utm_medium === "display",
    `got: ${dp.utm_medium}`
  );
  assert(
    "Warm deep link has aleid",
    dp.aleid === "warm_aleid_789",
    `got: ${dp.aleid}`
  );
  assert(
    "Warm deep link has alart",
    dp.alart === "warm_alart_abc",
    `got: ${dp.alart}`
  );

  // ours_visitor_id in URL updates the SDK visitor_id
  assert(
    "ours_visitor_id in deep link updates visitor_id",
    warmDeepLink.visitor_id === "e2e-web-visitor-id",
    `got: ${warmDeepLink.visitor_id}`
  );
  assert(
    "is_manually_set_id=true after ours_visitor_id deep link",
    warmDeepLink._is_manually_set_id === true,
    `got: ${warmDeepLink._is_manually_set_id}`
  );
}

// 9. post_deep_link event has updated attribution
const postDeepLink = findEvent("post_deep_link");
assert(
  "post_deep_link event exists",
  postDeepLink != null
);

if (postDeepLink) {
  const dp = postDeepLink.defaultProperties || {};
  assert(
    "post_deep_link has warm attribution (utm_source=applovin)",
    dp.utm_source === "applovin",
    `got: ${dp.utm_source}`
  );
  assert(
    "post_deep_link uses deep link visitor_id",
    postDeepLink.visitor_id === "e2e-web-visitor-id",
    `got: ${postDeepLink.visitor_id}`
  );
}

// === SET VISITOR ID ===

const afterSetVisitor = findEvent("after_set_visitor_id");
assert(
  "after_set_visitor_id event exists",
  afterSetVisitor != null
);

if (afterSetVisitor) {
  assert(
    "setVisitorId updates visitor_id",
    afterSetVisitor.visitor_id === "e2e-manual-visitor-id",
    `got: ${afterSetVisitor.visitor_id}`
  );
  assert(
    "is_manually_set_id=true after setVisitorId",
    afterSetVisitor._is_manually_set_id === true,
    `got: ${afterSetVisitor._is_manually_set_id}`
  );
}

// === RESET ===

const afterReset = findEvent("after_reset");
assert(
  "after_reset event exists",
  afterReset != null
);

if (afterReset) {
  assert(
    "reset() changes visitor_id",
    afterSetVisitor && afterReset.visitor_id !== afterSetVisitor.visitor_id,
    `reset=${afterReset.visitor_id}, before=${afterSetVisitor?.visitor_id}`
  );
  assert(
    "is_manually_set_id=false after reset",
    afterReset._is_manually_set_id === false,
    `got: ${afterReset._is_manually_set_id}`
  );
}

// === VISITOR_ID STABILITY ===
// All events before opt-out should share the same visitor_id

if (coldDeepLink && buttonEvent && identifyEvent) {
  const initialVisitorId = coldDeepLink.visitor_id;
  assert(
    "visitor_id stable: $deep_link_opened == button_pressed",
    buttonEvent.visitor_id === initialVisitorId
  );
  assert(
    "visitor_id stable: $deep_link_opened == $identify",
    identifyEvent.visitor_id === initialVisitorId
  );
  if (defaultsEvent) {
    assert(
      "visitor_id stable: $deep_link_opened == defaults_updated",
      defaultsEvent.visitor_id === initialVisitorId
    );
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const passed = results.filter((r) => r.passed);
const failed = results.filter((r) => !r.passed);

console.log(`\nE2E Assertions: ${passed.length} passed, ${failed.length} failed, ${results.length} total\n`);

for (const r of results) {
  const icon = r.passed ? "  PASS" : "  FAIL";
  const detail = r.detail ? ` (${r.detail})` : "";
  console.log(`${icon}  ${r.name}${detail}`);
}

if (failed.length > 0) {
  console.log(`\n${failed.length} assertion(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll assertions passed.");
  process.exit(0);
}
