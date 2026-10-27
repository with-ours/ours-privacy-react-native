import fetchMock from 'jest-fetch-mock';
import packageJson from '../package.json';

jest.unmock('../javascript/oursprivacy-storage');
fetchMock.enableMocks();

const START = 1791201600000;
const ISO = '2026-10-05T12:00:00.000Z';
const propertiesFor = (count) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `property_${index}`,
      `value-${index}`,
    ]),
  );
const storageFor = (values = new Map()) => ({
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => values.set(key, value),
  removeItem: async (key) => values.delete(key),
});
const queued = (token) =>
  require('../javascript/oursprivacy-queue').OursPrivacyQueueManager.getQueue(
    token,
    '/ingest',
  );
const requests = () =>
  fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body));
const acceptWithinPropertyLimit = () =>
  fetchMock.mockImplementation(async (_, options) => {
    const { data } = JSON.parse(options.body);
    const valid = data.every(
      (item) =>
        Object.keys(item.eventProperties || {}).length <= 200 &&
        JSON.stringify(item.eventProperties || {}).length < 1_048_576,
    );
    return new Response(
      JSON.stringify({
        success: valid,
        visitor_id: 'server-visitor',
      }),
      { status: valid ? 200 : 400 },
    );
  });

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers({ now: START });
  fetchMock.resetMocks();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it.each([
  [196, { appVersion: '2.0', appBuild: '42' }, 200, true],
  [197, { appVersion: '2.0', appBuild: '42' }, 197, false],
  [197, { appVersion: '2.0' }, 197, false],
  [198, { appVersion: '2.0' }, 198, false],
  [198, {}, 198, false],
  [199, {}, 199, false],
])(
  'preserves %i ordinary properties with host metadata %j as %i properties',
  async (count, host, expectedCount, includesMetadata) => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const client = new OursPrivacy();
    await client.init('boundary', { storage: storageFor(), ...host });
    const properties = propertiesFor(count);
    client.track('manual', {
      ...properties,
      mobile_contract_version: 9,
      mobile_occurred_at: 'caller-time',
      app_version: 'caller-release',
      app_build: 'caller-build',
    });
    await client.oursprivacyImpl._pendingOperation;
    const event = queued('boundary')[0];
    expect(event.eventProperties).toEqual(
      includesMetadata
        ? {
            ...properties,
            mobile_contract_version: 1,
            mobile_occurred_at: ISO,
            ...(host.appVersion ? { app_version: host.appVersion } : {}),
            ...(host.appBuild ? { app_build: host.appBuild } : {}),
          }
        : properties,
    );
    expect(Object.keys(event.eventProperties)).toHaveLength(expectedCount);
    expect(event.defaultProperties).toMatchObject({
      sid: String(START),
      os_name: 'iOS',
      version: `react-native@${packageJson.version}`,
    });
  },
);

it('uploads a 200-property event and its following event with a legacy ACK', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('full-bag', {
    storage: storageFor(),
    appVersion: '2.0',
    appBuild: '42',
  });
  const properties = propertiesFor(200);
  client.track('full', properties, { externalId: 'synthetic-patient' });
  client.track('following', { action: 'submitted' });
  await client.oursprivacyImpl._pendingOperation;
  acceptWithinPropertyLimit();
  await client.flush();

  expect(queued('full-bag')).toEqual([]);
  const events = requests().flatMap((body) => body.data);
  expect(events.map((event) => event.event)).toEqual(['full', 'following']);
  expect(events[0].eventProperties).toEqual(properties);
  expect(events[0].userProperties).toEqual({
    external_id: 'synthetic-patient',
  });
  expect(events[0].defaultProperties.sid).toBe(String(START));
  expect(events[1].eventProperties).toEqual({
    action: 'submitted',
    mobile_contract_version: 1,
    mobile_occurred_at: ISO,
    app_version: '2.0',
    app_build: '42',
  });
});

it('preserves a caller bag just below 1 MiB and uploads its following event', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('size-boundary', {
    storage: storageFor(),
    appVersion: '2.0',
    appBuild: '42',
  });
  const properties = { text: 'a'.repeat(1_048_564) };
  expect(JSON.stringify(properties)).toHaveLength(1_048_575);
  expect(
    JSON.stringify({
      ...properties,
      mobile_contract_version: 1,
      mobile_occurred_at: ISO,
      app_version: '2.0',
      app_build: '42',
    }).length,
  ).toBeGreaterThanOrEqual(1_048_576);
  client.track('near-size-limit', properties);
  client.track('following', { action: 'submitted' });
  await client.oursprivacyImpl._pendingOperation;
  acceptWithinPropertyLimit();
  await client.flush();

  expect(queued('size-boundary').length).toBe(0);
  const events = requests().flatMap((body) => body.data);
  expect(events.map((event) => event.event)).toEqual([
    'near-size-limit',
    'following',
  ]);
  expect(Object.keys(events[0].eventProperties)).toEqual(['text']);
  expect(JSON.stringify(events[0].eventProperties)).toHaveLength(1_048_575);
  expect(events[0].eventProperties.text === properties.text).toBe(true);
  expect(events[0].defaultProperties).toMatchObject({
    sid: String(START),
    os_name: 'iOS',
  });
  expect(events[1].eventProperties).toEqual({
    action: 'submitted',
    mobile_contract_version: 1,
    mobile_occurred_at: ISO,
    app_version: '2.0',
    app_build: '42',
  });
});

it.each(['legacy-defaults', 'current-event-properties'])(
  'normalizes a full persisted %s event without blocking the following event',
  async (layout) => {
    const { getQueueKey } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const properties = propertiesFor(200);
    const commonMetadata = {
      mobile_contract_version: 1,
      mobile_occurred_at: '2026-10-05T11:59:59.000Z',
      app_version: 'captured-release',
      app_build: 'captured-build',
    };
    const defaults = {
      sid: '1791201595000',
      os_name: 'iOS',
      version: 'react-native@4.1.0',
    };
    const item = {
      event: 'stored',
      distinct_id: 'stable-event',
      visitor_id: 'captured-visitor',
      userProperties: {
        external_id: 'synthetic-patient',
        custom_properties: { healthcare: 'preserved' },
      },
      eventProperties:
        layout === 'legacy-defaults'
          ? properties
          : { ...properties, ...commonMetadata },
      defaultProperties:
        layout === 'legacy-defaults'
          ? {
              ...defaults,
              ...commonMetadata,
              sid: 'old-uuid',
              mobile_platform: 'ios',
              mobile_session_started_at: '2026-10-05T11:59:55.000Z',
            }
          : defaults,
    };
    const client = new OursPrivacy();
    await client.init('stored-full-bag', {
      storage: storageFor(
        new Map([
          [getQueueKey('stored-full-bag', '/ingest'), JSON.stringify([item])],
        ]),
      ),
      visitorId: 'captured-visitor',
      appVersion: '2.0',
      appBuild: '42',
    });
    expect(queued('stored-full-bag')).toEqual([
      { ...item, eventProperties: properties, defaultProperties: defaults },
    ]);
    client.track('following', { action: 'submitted' });
    await client.oursprivacyImpl._pendingOperation;
    acceptWithinPropertyLimit();
    await client.flush();

    expect(queued('stored-full-bag')).toEqual([]);
    const events = requests().flatMap((body) => body.data);
    expect(events.map((event) => event.event)).toEqual(['stored', 'following']);
    expect(events[0]).toEqual({
      ...item,
      eventProperties: properties,
      defaultProperties: defaults,
    });
    expect(events[1].eventProperties.mobile_contract_version).toBe(1);
    expect(client.getVisitorId()).toBe('captured-visitor');
  },
);

it('retains canonical and identify metadata with a full default property bag', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('canonical-capacity', {
    storage: storageFor(),
    appVersion: '2.0',
    appBuild: '42',
    defaultEventProperties: propertiesFor(200),
    trackAutomaticEvents: true,
  });
  client.trackScreen('Schedule');
  await client.identify({ externalId: 'synthetic-patient' });
  await client.oursprivacyImpl._pendingOperation;
  const events = queued('canonical-capacity');
  expect(events.map((event) => event.event)).toEqual([
    '$mobile_first_open',
    '$mobile_app_open',
    '$mobile_session_start',
    '$mobile_screen_view',
    '$identify',
  ]);
  for (const event of events) {
    expect(event.eventProperties).toMatchObject({
      mobile_contract_version: 1,
      mobile_occurred_at: ISO,
      app_version: '2.0',
      app_build: '42',
    });
    expect(event.eventProperties).not.toHaveProperty('property_0');
    expect(Object.keys(event.eventProperties).length).toBeLessThanOrEqual(5);
  }
});

it('warns about metadata omission without event names, IDs, or properties', async () => {
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('synthetic-token', {
    storage: storageFor(),
    visitorId: 'synthetic-visitor',
    appVersion: '2.0',
    appBuild: '42',
  });
  client.setLoggingEnabled(true);
  client.track('synthetic-event', propertiesFor(200));
  await client.oursprivacyImpl._pendingOperation;

  expect(queued('synthetic-token')[0].eventProperties).not.toHaveProperty(
    'mobile_contract_version',
  );
  expect(warn.mock.calls).toHaveLength(1);
  const message = warn.mock.calls[0].join(' ');
  expect(message).toMatch(/mobile.*metadata.*omitted/i);
  expect(message).not.toMatch(
    /synthetic-token|synthetic-visitor|synthetic-event|property_0|value-0/,
  );
});
