import fetchMock from 'jest-fetch-mock';

jest.unmock('../javascript/oursprivacy-storage');
fetchMock.enableMocks();

const START = 1791201600000;
const ISO = '2026-10-05T12:00:00.000Z';
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

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers({ now: START });
  fetchMock.resetMocks();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

it.each(['ios', 'android'])(
  'owns metadata in event properties on every %s event without automatic PHI',
  async (platform) => {
    require('react-native').Platform.OS = platform;
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const client = new OursPrivacy();
    await client.init('wire', {
      storage: storageFor(),
      trackAutomaticEvents: true,
      appVersion: '2.0',
      appBuild: '42',
      defaultEventProperties: {
        mobile_contract_version: 9,
        app_build: 'bad',
        patient: 'excluded',
      },
      defaultUserCustomProperties: { patient: 'excluded' },
      initialURL: 'example://open?utm_source=campaign&email=excluded',
    });
    client.trackScreen('Schedule');
    client.track(
      'appointment_booked',
      {
        mobile_contract_version: 9,
        mobile_occurred_at: 'bad',
        mobile_session_started_at: 'bad',
        mobile_platform: 'bad',
        app_version: 'bad',
      },
      {
        externalId: 'synthetic-patient',
        customProperties: { healthcare: 'caller-supplied' },
      },
    );
    await client.identify({ externalId: 'synthetic-patient' });
    await client.oursprivacyImpl._pendingOperation;
    fetchMock.mockResponse(
      JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
    );
    await client.flush();
    const events = requests().flatMap((body) => body.data);
    expect(events.length).toBeGreaterThanOrEqual(7);
    for (const event of events) {
      expect(event.defaultProperties.sid).toBe(String(START));
      expect(event.defaultProperties).toMatchObject({
        os_name: platform === 'ios' ? 'iOS' : 'Android',
        version: 'react-native@4.1.0',
        device_type: 'mobile',
      });
      expect(event.eventProperties).toMatchObject({
        mobile_contract_version: 1,
        mobile_occurred_at: ISO,
        app_version: '2.0',
        app_build: '42',
      });
      for (const key of [
        'mobile_session_started_at',
        'mobile_platform',
        'mobile_contract_version',
        'mobile_occurred_at',
        'app_version',
        'app_build',
      ]) {
        expect(event.defaultProperties).not.toHaveProperty(key);
      }
      expect(event.eventProperties).not.toHaveProperty(
        'mobile_session_started_at',
      );
      expect(event.eventProperties).not.toHaveProperty('mobile_platform');
      expect(event).not.toHaveProperty('isManuallySetId');
      if (event.event.startsWith('$mobile_')) {
        expect(event.userProperties).toBeNull();
        expect(event.eventProperties).not.toHaveProperty('patient');
        expect(event.defaultProperties).not.toHaveProperty('utm_source');
      }
    }
    expect(
      events.find((event) => event.event === 'appointment_booked')
        .userProperties,
    ).toEqual({
      external_id: 'synthetic-patient',
      custom_properties: { patient: 'excluded', healthcare: 'caller-supplied' },
    });
  },
);

it('does not let caller properties invent absent host metadata', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('no-host', { storage: storageFor() });
  client.track('manual', {
    app_version: 'fake',
    app_build: 'fake',
    mobile_contract_version: 9,
  });
  await client.oursprivacyImpl._pendingOperation;
  expect(queued('no-host')[0].eventProperties).toEqual({
    mobile_contract_version: 1,
    mobile_occurred_at: ISO,
  });
});

it('starts a fresh session after a saved UUID without repeating first-open or changing pending facts', async () => {
  const { MobileSession } = require('../javascript/oursprivacy-mobile-session');
  const pending = {
    id: 'captured-fact',
    visitorId: 'captured-visitor',
    isManuallySetId: false,
    appVersion: '1.0',
    appBuild: '20',
    fact: {
      event: '$mobile_screen_view',
      eventProperties: { screen_name: 'Schedule' },
      defaultProperties: {
        sid: 'old-uuid',
        mobile_session_started_at: '2026-10-05T11:59:55.000Z',
        mobile_occurred_at: '2026-10-05T11:59:59.000Z',
      },
    },
  };
  const values = new Map([
    [
      'OURSPRIVACY_migrate_MOBILE_SESSION_V1',
      JSON.stringify({
        sid: 'old-uuid',
        startedAtMs: START - 5000,
        lastActiveAtMs: START - 1000,
        firstOpenSent: true,
        sessionStartSent: true,
        foregroundDurationMs: 9000,
        pendingEvents: [pending],
      }),
    ],
  ]);
  const session = new MobileSession({
    token: 'migrate',
    storage: storageFor(values),
    wallNow: () => START,
    monotonicNow: () => 0,
  });
  await session.load();
  expect(await session.pendingQueueFacts()).toEqual([pending]);
  const facts = await session.foreground(true);
  expect(facts.map((fact) => fact.event)).toEqual([
    '$mobile_app_open',
    '$mobile_session_start',
  ]);
  for (const fact of facts) {
    expect(fact.defaultProperties).toEqual({
      sid: String(START),
      mobile_occurred_at: ISO,
    });
  }
  expect(session.remainingCheckpointMs()).toBe(10_000);
  expect(
    JSON.parse(values.get('OURSPRIVACY_migrate_MOBILE_SESSION_V1')),
  ).toMatchObject({
    sid: String(START),
    startedAtMs: START,
    lastActiveAtMs: START,
    firstOpenSent: true,
    sessionStartSent: true,
    foregroundDurationMs: 0,
  });
  expect((await session.pendingQueueFacts())[0]).toEqual(pending);
});

it.each(['iOS', 'Android'])(
  'leaves an unversioned persisted %s event unchanged',
  async (osName) => {
    const { getQueueKey } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const item = {
      event: 'appointment_booked',
      distinct_id: 'precontract-event',
      visitor_id: 'captured-visitor',
      userProperties: { external_id: 'synthetic-patient' },
      eventProperties: { appointment_id: 'synthetic-appointment' },
      defaultProperties: {
        sid: 'old-uuid',
        os_name: osName,
        version: 'react-native@4.0.0',
      },
    };
    const client = new OursPrivacy();
    await client.init('precontract', {
      storage: storageFor(
        new Map([
          [getQueueKey('precontract', '/ingest'), JSON.stringify([item])],
        ]),
      ),
    });
    expect(queued('precontract')).toEqual([item]);
    fetchMock.mockResponse(
      JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
    );
    await client.flush();
    expect(requests()[0].data).toEqual([item]);
  },
);

it.each([null, '2026-10-05T11:59:55.000Z'])(
  'preserves a missing legacy occurrence when the captured start is %s',
  async (started) => {
    const { getQueueKey } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const item = {
      event: 'appointment_booked',
      distinct_id: 'missing-occurrence',
      visitor_id: 'captured-visitor',
      eventProperties: { appointment_id: 'synthetic-appointment' },
      defaultProperties: {
        sid: 'old-uuid',
        os_name: 'iOS',
        mobile_contract_version: 1,
        ...(started ? { mobile_session_started_at: started } : {}),
      },
    };
    const client = new OursPrivacy();
    await client.init('missing-occurrence', {
      storage: storageFor(
        new Map([
          [
            getQueueKey('missing-occurrence', '/ingest'),
            JSON.stringify([item]),
          ],
        ]),
      ),
    });
    fetchMock.mockResponse(
      JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
    );
    await client.flush();
    expect(requests()[0].data[0]).toEqual({
      ...item,
      defaultProperties: {
        os_name: 'iOS',
        ...(started ? { sid: '1791201595000' } : {}),
      },
      eventProperties: {
        appointment_id: 'synthetic-appointment',
        mobile_contract_version: 1,
      },
    });
  },
);

it.each(['raw', 'indexed-envelope'])(
  'normalizes a persisted %s queue and accepts a legacy ACK',
  async (shape) => {
    const { getQueueKey } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const item = {
      event: 'appointment_booked',
      distinct_id: 'stable-event',
      visitor_id: 'captured-visitor',
      userProperties: {
        external_id: 'synthetic-patient',
        custom_properties: { healthcare: 'preserved' },
      },
      eventProperties: { appointment_id: 'synthetic-appointment' },
      defaultProperties: {
        sid: 'old-uuid',
        os_name: 'iOS',
        version: 'react-native@4.0.0',
        mobile_session_started_at: ISO,
        mobile_occurred_at: '2026-10-05T12:00:02.000Z',
        mobile_platform: 'ios',
        mobile_contract_version: 1,
        app_version: '1.2',
        app_build: '30',
      },
    };
    const stored =
      shape === 'raw' ? [item] : { items: [item], responseMode: 'indexed' };
    const client = new OursPrivacy();
    await client.init('old-queue', {
      storage: storageFor(
        new Map([
          [getQueueKey('old-queue', '/ingest'), JSON.stringify(stored)],
        ]),
      ),
      appVersion: '2.0',
      appBuild: '42',
    });
    fetchMock.mockResponse(
      JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
    );
    await client.flush();
    expect(queued('old-queue')).toEqual([]);
    expect(requests()[0].data[0]).toEqual({
      ...item,
      defaultProperties: {
        sid: String(START),
        os_name: 'iOS',
        version: 'react-native@4.0.0',
      },
      eventProperties: {
        appointment_id: 'synthetic-appointment',
        mobile_contract_version: 1,
        mobile_occurred_at: '2026-10-05T12:00:02.000Z',
        app_version: '1.2',
        app_build: '30',
      },
    });
    expect(client.getVisitorId()).not.toBe('server-visitor');
  },
);

it.each([
  'bad',
  '2026-02-30T12:00:00.000Z',
  '1970-01-01T00:00:00.000Z',
  '2026-10-05',
])('does not derive a session ID from invalid start %s', async (started) => {
  const { getQueueKey } = require('../javascript/oursprivacy-constants');
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const item = {
    event: 'stored',
    distinct_id: 'invalid-start',
    visitor_id: 'old-visitor',
    eventProperties: { appointment_id: 'synthetic-appointment' },
    userProperties: { external_id: 'synthetic-patient' },
    defaultProperties: {
      os_name: 'Android',
      sid: 'old-uuid',
      mobile_session_started_at: started,
      mobile_occurred_at: ISO,
    },
  };
  const client = new OursPrivacy();
  await client.init('invalid-start', {
    storage: storageFor(
      new Map([
        [getQueueKey('invalid-start', '/ingest'), JSON.stringify([item])],
      ]),
    ),
  });
  fetchMock.mockResponse(
    JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
  );
  await client.flush();
  expect(requests()[0].data[0].defaultProperties).toEqual({
    os_name: 'Android',
  });
  expect(requests()[0].data[0]).toMatchObject({
    distinct_id: 'invalid-start',
    visitor_id: 'old-visitor',
    userProperties: { external_id: 'synthetic-patient' },
    eventProperties: {
      appointment_id: 'synthetic-appointment',
      mobile_occurred_at: ISO,
      mobile_contract_version: 1,
    },
  });
  expect(queued('invalid-start')).toEqual([]);
});

it('normalizes pending facts with their captured version, occurrence and identity mode', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const pending = {
    id: 'pending-fact',
    visitorId: 'pending-visitor',
    isManuallySetId: false,
    appVersion: '1.0',
    appBuild: '20',
    fact: {
      event: '$mobile_screen_view',
      eventProperties: { screen_name: 'Schedule' },
      defaultProperties: {
        sid: 'old-uuid',
        mobile_session_started_at: ISO,
        mobile_occurred_at: '2026-10-05T12:00:01.000Z',
      },
    },
  };
  const client = new OursPrivacy();
  await client.init('pending', {
    storage: storageFor(
      new Map([
        [
          'OURSPRIVACY_pending_MOBILE_SESSION_V1',
          JSON.stringify({ firstOpenSent: true, pendingEvents: [pending] }),
        ],
      ]),
    ),
    appVersion: '2.0',
    visitorId: 'new-visitor',
  });
  fetchMock.mockResponse(
    JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
  );
  await client.flush();
  expect(requests()[0].is_manually_set_id).toBe(false);
  expect(requests()[0].data[0]).toMatchObject({
    distinct_id: 'pending-fact',
    visitor_id: 'pending-visitor',
    defaultProperties: { sid: String(START) },
    eventProperties: {
      screen_name: 'Schedule',
      mobile_contract_version: 1,
      mobile_occurred_at: '2026-10-05T12:00:01.000Z',
      app_version: '1.0',
      app_build: '20',
    },
    userProperties: null,
  });
  expect(requests()[0].data[0].defaultProperties).not.toHaveProperty(
    'mobile_session_started_at',
  );
});

it('flushes captured visitors and identity modes separately while retaining patient identity', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('mixed', { storage: storageFor() });
  const original = client.getVisitorId();
  client.track('before', {}, { externalId: 'synthetic-patient' });
  await client.setVisitorId(original);
  client.track('same-visitor-manual', {}, { externalId: 'synthetic-patient' });
  await client.setVisitorId('second-visitor');
  client.track('after', {}, { externalId: 'synthetic-patient' });
  await client.oursprivacyImpl._pendingOperation;
  fetchMock.mockResponse(
    JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
  );
  await client.flush();
  expect(
    requests().map((body) => ({
      mode: body.is_manually_set_id,
      visitors: body.data.map((event) => event.visitor_id),
      patients: body.data.map((event) => event.userProperties.external_id),
    })),
  ).toEqual([
    { mode: false, visitors: [original], patients: ['synthetic-patient'] },
    { mode: true, visitors: [original], patients: ['synthetic-patient'] },
    {
      mode: true,
      visitors: ['second-visitor'],
      patients: ['synthetic-patient'],
    },
  ]);
  expect(client.getVisitorId()).toBe('second-visitor');
});

it('uses stored SDK defaults over caller metadata when migrating legacy events', async () => {
  const { getQueueKey } = require('../javascript/oursprivacy-constants');
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const item = {
    event: 'manual',
    distinct_id: 'legacy-collision',
    visitor_id: 'original',
    eventProperties: {
      mobile_occurred_at: 'caller-time',
      app_version: 'caller-version',
    },
    defaultProperties: {
      os_name: 'iOS',
      sid: '1791201599000',
      mobile_session_started_at: ISO,
      mobile_occurred_at: ISO,
      app_version: '1.0',
    },
  };
  const client = new OursPrivacy();
  await client.init('collision', {
    storage: storageFor(
      new Map([[getQueueKey('collision', '/ingest'), JSON.stringify([item])]]),
    ),
  });
  expect(queued('collision')[0]).toMatchObject({
    defaultProperties: { sid: '1791201599000' },
    eventProperties: { mobile_occurred_at: ISO, app_version: '1.0' },
  });
});

it.each([
  { mobile_contract_version: 1 },
  { mobile_platform: 'ios' },
  { mobile_session_started_at: ISO },
])(
  'omits absent SDK host metadata when migrating old wire markers %j',
  async (markers) => {
    const { getQueueKey } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const item = {
      event: 'manual',
      distinct_id: 'legacy-no-host',
      visitor_id: 'captured-visitor',
      eventProperties: {
        appointment_id: 'synthetic-appointment',
        mobile_contract_version: 9,
        mobile_occurred_at: 'caller-time',
        app_version: 'caller-release',
        app_build: 'caller-build',
      },
      defaultProperties: {
        os_name: 'iOS',
        sid: String(START),
        mobile_occurred_at: ISO,
        ...markers,
      },
    };
    const client = new OursPrivacy();
    await client.init('legacy-no-host', {
      storage: storageFor(
        new Map([
          [getQueueKey('legacy-no-host', '/ingest'), JSON.stringify([item])],
        ]),
      ),
      appVersion: 'current-release',
      appBuild: 'current-build',
    });
    fetchMock.mockResponse(
      JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
    );
    await client.flush();
    expect(requests()[0].data[0]).toEqual({
      ...item,
      defaultProperties: { os_name: 'iOS', sid: String(START) },
      eventProperties: {
        appointment_id: 'synthetic-appointment',
        mobile_contract_version: 1,
        mobile_occurred_at: ISO,
      },
    });
  },
);

it('preserves current event-properties metadata through queue hydration and upload', async () => {
  const { getQueueKey } = require('../javascript/oursprivacy-constants');
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const item = {
    event: 'manual',
    distinct_id: 'current-metadata',
    visitor_id: 'captured-visitor',
    eventProperties: {
      appointment_id: 'synthetic-appointment',
      mobile_contract_version: 1,
      mobile_occurred_at: '2026-10-05T11:59:59.000Z',
      app_version: 'captured-release',
      app_build: 'captured-build',
    },
    defaultProperties: {
      os_name: 'iOS',
      sid: '1791201595000',
      version: 'react-native@4.1.0',
    },
  };
  const client = new OursPrivacy();
  await client.init('current-metadata', {
    storage: storageFor(
      new Map([
        [getQueueKey('current-metadata', '/ingest'), JSON.stringify([item])],
      ]),
    ),
    appVersion: 'current-release',
    appBuild: 'current-build',
  });
  expect(queued('current-metadata')).toEqual([item]);
  fetchMock.mockResponse(
    JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
  );
  await client.flush();
  expect(requests()[0].data).toEqual([item]);
});

it('preserves pending fact metadata stored inside the fact', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const pending = {
    id: 'stored-fact',
    visitorId: 'original',
    fact: {
      event: '$mobile_screen_view',
      eventProperties: { screen_name: 'Schedule' },
      defaultProperties: {
        sid: 'old-uuid',
        mobile_session_started_at: ISO,
        mobile_occurred_at: ISO,
        app_version: '1.0',
        app_build: '20',
      },
    },
  };
  const client = new OursPrivacy();
  await client.init('fact-metadata', {
    storage: storageFor(
      new Map([
        [
          'OURSPRIVACY_fact-metadata_MOBILE_SESSION_V1',
          JSON.stringify({ firstOpenSent: true, pendingEvents: [pending] }),
        ],
      ]),
    ),
    appVersion: '2.0',
  });
  expect(queued('fact-metadata')[0]).toMatchObject({
    eventProperties: {
      app_version: '1.0',
      app_build: '20',
      mobile_occurred_at: ISO,
    },
  });
});

it('retains captured identity modes across restart alongside older items with the baseline mode', async () => {
  const { getQueueKey } = require('../javascript/oursprivacy-constants');
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const values = new Map();
  const client = new OursPrivacy();
  await client.init('restart-mode', { storage: storageFor(values) });
  const visitor = client.getVisitorId();
  client.track('anonymous');
  await client.setVisitorId(visitor);
  client.track('manual');
  await client.oursprivacyImpl._pendingOperation;
  const stored = JSON.parse(values.get(getQueueKey('restart-mode', '/ingest')));
  stored.items.push({
    event: 'older',
    distinct_id: 'older-id',
    visitor_id: visitor,
    userProperties: { external_id: 'synthetic-patient' },
  });
  values.set(getQueueKey('restart-mode', '/ingest'), JSON.stringify(stored));
  jest.resetModules();
  const { OursPrivacy: Reloaded } = require('@oursprivacy/react-native');
  const reloaded = new Reloaded();
  await reloaded.init('restart-mode', {
    storage: storageFor(values),
    visitorId: visitor,
  });
  fetchMock.mockResponse(
    JSON.stringify({ success: true, visitor_id: 'server-visitor' }),
  );
  await reloaded.flush();
  expect(
    requests().map((body) => ({
      mode: body.is_manually_set_id,
      events: body.data.map((event) => event.event),
    })),
  ).toEqual([
    { mode: false, events: ['anonymous'] },
    { mode: true, events: ['manual', 'older'] },
  ]);
  expect(requests()[1].data[1].userProperties.external_id).toBe(
    'synthetic-patient',
  );
});

it('discards nonnumeric stored session times while preserving first-open history', async () => {
  const { MobileSession } = require('../javascript/oursprivacy-mobile-session');
  const session = new MobileSession({
    token: 'invalid-time',
    storage: storageFor(
      new Map([
        [
          'OURSPRIVACY_invalid-time_MOBILE_SESSION_V1',
          JSON.stringify({
            sid: 'old-uuid',
            startedAtMs: '1791201595000',
            lastActiveAtMs: START,
            firstOpenSent: true,
            sessionStartSent: true,
          }),
        ],
      ]),
    ),
    wallNow: () => START,
    monotonicNow: () => 0,
  });
  const facts = await session.foreground(true);
  expect(facts.map((fact) => fact.event)).toEqual([
    '$mobile_app_open',
    '$mobile_session_start',
  ]);
  expect(facts[0].defaultProperties.sid).toBe(String(START));
});

it('keeps the captured batch queued if opt-out occurs before its ACK is processed', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    OursPrivacyPersistent,
  } = require('../javascript/oursprivacy-persistent');
  const client = new OursPrivacy();
  await client.init('ack-consent', { storage: storageFor() });
  client.track('queued');
  await client.oursprivacyImpl._pendingOperation;
  const before = queued('ack-consent');
  fetchMock.mockImplementation(async () => {
    OursPrivacyPersistent.getInstance().updateOptedOut('ack-consent', true);
    return {
      ok: true,
      json: async () => ({ success: true, visitor_id: 'server-visitor' }),
    };
  });
  await client.flush();
  expect(queued('ack-consent')).toEqual(before);
  expect(client.hasOptedOutTracking()).toBe(true);
  expect(client.getVisitorId()).toBe(before[0].visitor_id);
});
