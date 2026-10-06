import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./e2e-assertions.mjs', import.meta.url));
const token = 'e2e-fixture-token';
const visitor = 'e2e-cold-web-visitor-id';
const sid = 'fixture-session';
const started = '2026-10-06T12:00:00.000Z';
const at = (seconds) =>
  new Date(Date.parse(started) + seconds * 1000).toISOString();

function event(name, seconds, properties = null, extra = {}) {
  return {
    event: name,
    distinct_id: `${name}-${seconds}`,
    visitor_id: visitor,
    eventProperties: properties,
    userProperties: null,
    defaultProperties: {
      sid,
      mobile_session_started_at: started,
      mobile_occurred_at: at(seconds),
      mobile_platform: 'android',
      mobile_contract_version: 1,
      app_version: '1.2.3',
      app_build: '42',
      os_name: 'Android',
      device_type: 'mobile',
      version: 'react-native@4.0.0',
      ...extra,
    },
  };
}

function fixture() {
  const coldAttribution = {
    utm_source: 'google',
    utm_medium: 'cpc',
    utm_campaign: 'spring_2026',
    gclid: 'test_gclid_123',
    aleid: 'test_aleid_456',
  };
  const cold = event('$deep_link_opened', 0, null, coldAttribution);
  const first = event('$mobile_first_open', 0.1);
  const open = event('$mobile_app_open', 0.2);
  const start = event('$mobile_session_start', 0.3);
  const button = event(
    'button_pressed',
    1,
    { button: 'e2e_auto' },
    coldAttribution,
  );
  const screen = event('$mobile_screen_view', 2, { screen_name: 'Schedule' });
  const booking = event('appointment_booked', 2.2, {
    appointment_id: 'e2e-appointment',
  });
  const engagement = [
    event('$mobile_session_engagement', 2, { engagement_duration_ms: 2000 }),
    event('$mobile_session_engagement', 12, {
      engagement_duration_ms: 10000,
      screen_name: 'Schedule',
    }),
  ];
  const identify = event('$identify', 13, null);
  identify.userProperties = {
    email: 'e2e-user@example.com',
    external_id: 'e2e-user-123',
    custom_properties: { plan: 'e2e' },
  };
  identify.distinct_id = 'identify-distinct';
  const defaults = event('defaults_updated', 14, {
    last_action: 'update_defaults',
  });
  defaults.userProperties = { consent: { marketing: true } };
  const optIn = event('$opt_in', 15);
  const afterOptIn = event('after_opt_in', 16);
  const warm = event('$deep_link_opened', 17, null, {
    utm_source: 'applovin',
    utm_medium: 'display',
    aleid: 'warm_aleid_789',
    alart: 'warm_alart_abc',
  });
  warm.visitor_id = 'e2e-web-visitor-id';
  const post = event('post_deep_link', 18, null, {
    utm_source: 'applovin',
  });
  post.visitor_id = warm.visitor_id;
  const manual = event('after_set_visitor_id', 19);
  manual.visitor_id = 'e2e-manual-visitor-id';
  const reset = event('after_reset', 20);
  reset.visitor_id = 'new-reset-visitor';
  return [
    {
      jsonBody: {
        token,
        is_manually_set_id: true,
        data: [
          cold,
          first,
          open,
          start,
          button,
          screen,
          booking,
          ...engagement,
          identify,
          defaults,
        ],
      },
    },
    {
      jsonBody: { token, is_manually_set_id: false, data: [optIn, afterOptIn] },
    },
    {
      jsonBody: { token, is_manually_set_id: true, data: [warm, post, manual] },
    },
    { jsonBody: { token, is_manually_set_id: false, data: [reset] } },
  ];
}

async function run(
  captures,
  flags = ['--token', token, '--platform', 'android'],
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ours-rn-captures-'));
  try {
    await Promise.all(
      captures.map((capture, index) =>
        fs.writeFile(
          path.join(dir, `${String(index).padStart(3, '0')}.json`),
          JSON.stringify({ id: index + 1, ...capture }),
        ),
      ),
    );
    return spawnSync(process.execPath, [script, '--dir', dir, ...flags], {
      encoding: 'utf8',
      cwd: dir,
    });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('accepts a stitched Android capture with measured Schedule engagement', async () => {
  const result = await run(fixture());
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects an initial booking before a visitor stitch', async () => {
  const captures = fixture();
  for (const capture of captures) {
    for (const item of capture.jsonBody.data) {
      if (item.visitor_id === visitor)
        item.visitor_id = 'anonymous-before-stitch';
    }
  }
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /initial booking uses stitched visitor/);
});

test('rejects missing session and visitor IDs shared across initial facts', async () => {
  const captures = fixture();
  for (const item of captures[0].jsonBody.data) {
    item.visitor_id = undefined;
    item.defaultProperties.sid = undefined;
  }
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(
    result.stdout,
    /initial mobile events share nonempty visitor and session/,
  );
});

test('rejects duplicate engagement IDs', async () => {
  const captures = fixture();
  const data = captures[0].jsonBody.data;
  data[8].distinct_id = data[7].distinct_id;
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(
    result.stdout,
    /initial engagement deltas are valid and nonoverlapping/,
  );
});

test('accepts an identical recorder retry of an engagement delta', async () => {
  const captures = fixture();
  captures.push({
    jsonBody: {
      token,
      is_manually_set_id: true,
      data: [structuredClone(captures[0].jsonBody.data[8])],
    },
  });
  const result = await run(captures);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects a conflicting recorder retry of an engagement ID', async () => {
  const captures = fixture();
  const repeated = structuredClone(captures[0].jsonBody.data[8]);
  repeated.eventProperties.engagement_duration_ms = 9999;
  captures.push({
    jsonBody: { token, is_manually_set_id: true, data: [repeated] },
  });
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /conflicting captured event IDs/);
});

test('rejects an engagement ID reused by a different event', async () => {
  const captures = fixture();
  const other = event('custom_event', 21);
  other.distinct_id = captures[0].jsonBody.data[8].distinct_id;
  captures[3].jsonBody.data.push(other);
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /conflicting captured event IDs/);
});

test('does not collapse duplicate lifecycle emissions', async () => {
  const captures = fixture();
  captures[0].jsonBody.data.push(structuredClone(captures[0].jsonBody.data[1]));
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /one first tracked open/);
});

test('rejects repeated lifecycle IDs outside the first session', async () => {
  const captures = fixture();
  const laterOpen = event('$mobile_app_open', 21);
  laterOpen.defaultProperties.sid = 'later-session';
  captures[3].jsonBody.data.push(laterOpen, structuredClone(laterOpen));
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /non-engagement capture IDs are unique/);
});

test('rejects duplicate first-session event IDs', async () => {
  const captures = fixture();
  const data = captures[0].jsonBody.data;
  data[6].distinct_id = data[5].distinct_id;
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /initial event IDs are unique/);
});

test('rejects overlapping or invalid engagement durations', async () => {
  for (const duration of [10100, 11000, 1.5, -1]) {
    const captures = fixture();
    captures[0].jsonBody.data[8].eventProperties.engagement_duration_ms =
      duration;
    const result = await run(captures);
    assert.equal(result.status, 1, result.stdout);
    assert.match(
      result.stdout,
      /initial engagement deltas are valid and nonoverlapping/,
    );
  }
});

test('rejects engagement mostly attributed outside Schedule', async () => {
  const captures = fixture();
  const data = captures[0].jsonBody.data;
  data[7].eventProperties = {
    engagement_duration_ms: 9000,
    screen_name: 'Other',
  };
  data[7].defaultProperties.mobile_occurred_at = at(9);
  data[8].eventProperties.engagement_duration_ms = 3000;
  const result = await run(captures);
  assert.equal(result.status, 1, result.stdout);
  assert.match(result.stdout, /meaningful Schedule engagement/);
});

test('rejects captures when no token is selected', async () => {
  const result = await run(fixture(), ['--platform', 'android']);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /token/i);
});
