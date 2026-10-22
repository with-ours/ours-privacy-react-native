import fetchMock from 'jest-fetch-mock';

jest.unmock('../javascript/oursprivacy-storage');
fetchMock.enableMocks();

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const tickUntil = async (predicate) => {
  for (let i = 0; i < 1000 && !predicate(); i += 1) await Promise.resolve();
  expect(predicate()).toBe(true);
};

const memoryStorage = (values = new Map()) => ({
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => values.set(key, value),
  removeItem: async (key) => values.delete(key),
});

beforeEach(() => {
  jest.resetModules();
  jest.useFakeTimers();
  jest.clearAllMocks();
  fetchMock.resetMocks();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('SDK compatibility', () => {
  it('does not upload a restored queue before stored opt-out is read', async () => {
    const {
      getQueueKey,
      getOptedOutKey,
    } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const token = 'pending-consent';
    const consentRead = deferred();
    const values = new Map([
      [
        getQueueKey(token, '/ingest'),
        JSON.stringify([{ event: 'stored', distinct_id: 'stored-event' }]),
      ],
      [getOptedOutKey(token), 'true'],
    ]);
    const storage = memoryStorage(values);
    storage.getItem = jest.fn(async (key) =>
      key === getOptedOutKey(token)
        ? consentRead.promise
        : (values.get(key) ?? null),
    );
    fetchMock.mockResponse(
      JSON.stringify({ success: true, accepted: 1, rejected: [] }),
    );

    const client = new OursPrivacy();
    const initializing = client.init(token, { storage });
    await tickUntil(() =>
      storage.getItem.mock.calls.some(([key]) => key === getOptedOutKey(token)),
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).not.toHaveBeenCalled();

    consentRead.resolve('true');
    await initializing;
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not upload a restored queue if consent loading fails', async () => {
    const {
      getQueueKey,
      getOptedOutKey,
    } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const token = 'failed-consent';
    const values = new Map([
      [
        getQueueKey(token, '/ingest'),
        JSON.stringify([{ event: 'stored', distinct_id: 'stored-event' }]),
      ],
    ]);
    const storage = memoryStorage(values);
    storage.getItem = jest.fn(async (key) => {
      if (key === getOptedOutKey(token)) throw new Error('consent unavailable');
      return values.get(key) ?? null;
    });
    fetchMock.mockResponse(
      JSON.stringify({ success: true, accepted: 1, rejected: [] }),
    );

    const client = new OursPrivacy();
    await expect(client.init(token, { storage })).rejects.toThrow(
      'consent unavailable',
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
    await client.flush();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps an opt-out made during consent loading from being overwritten by the older read', async () => {
    const {
      getQueueKey,
      getOptedOutKey,
    } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const token = 'opt-out-during-init';
    const consentRead = deferred();
    const values = new Map();
    const queueWrites = [];
    const storage = memoryStorage(values);
    storage.getItem = jest.fn(async (key) =>
      key === getOptedOutKey(token)
        ? consentRead.promise
        : (values.get(key) ?? null),
    );
    storage.setItem = jest.fn(async (key, value) => {
      if (key === getQueueKey(token, '/ingest')) queueWrites.push(value);
      values.set(key, value);
    });

    const client = new OursPrivacy();
    const initializing = client.init(token, {
      storage,
      trackAutomaticEvents: true,
    });
    await tickUntil(() =>
      storage.getItem.mock.calls.some(([key]) => key === getOptedOutKey(token)),
    );
    const optingOut = client.optOutTracking();
    consentRead.resolve(null);
    await initializing;
    await optingOut;
    expect(client.hasOptedOutTracking()).toBe(true);
    expect(
      queueWrites.some((value) => value.includes('$mobile_app_open')),
    ).toBe(false);
  });

  it('fails closed when a stored tracking decision is malformed', async () => {
    const {
      getQueueKey,
      getOptedOutKey,
    } = require('../javascript/oursprivacy-constants');
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const token = 'malformed-consent';
    const storage = memoryStorage(
      new Map([
        [
          getQueueKey(token, '/ingest'),
          JSON.stringify([{ event: 'stored', distinct_id: 'stored-event' }]),
        ],
        [getOptedOutKey(token), 'invalid'],
      ]),
    );
    fetchMock.mockResponse(
      JSON.stringify({ success: true, accepted: 1, rejected: [] }),
    );
    const client = new OursPrivacy();
    await expect(client.init(token, { storage })).rejects.toThrow(
      'Invalid stored tracking decision',
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cancels a retry of a captured batch after opt-out, including a later opt-in', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const client = new OursPrivacy();
    await client.init('retry-consent', { storage: memoryStorage() });
    client.track('queued');
    await client.oursprivacyImpl._pendingOperation;
    fetchMock.mockRejectOnce(new Error('offline'));
    fetchMock.mockResponse(
      JSON.stringify({ success: true, accepted: 1, rejected: [] }),
    );

    const flushing = client.flush();
    await tickUntil(() => fetchMock.mock.calls.length === 1);
    const optingOut = client.optOutTracking();
    await jest.advanceTimersByTimeAsync(2_000);
    await flushing;
    await optingOut;
    await client.optInTracking();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts an active upload when tracking is opted out', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const client = new OursPrivacy();
    await client.init('active-consent', { storage: memoryStorage() });
    client.track('queued');
    await client.oursprivacyImpl._pendingOperation;
    let signal;
    fetchMock.mockImplementation((_url, options) => {
      signal = options.signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      });
    });

    const flushing = client.flush();
    await tickUntil(() => fetchMock.mock.calls.length === 1);
    const optingOut = client.optOutTracking();
    expect(signal?.aborted).toBe(true);
    await flushing;
    await optingOut;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves an explicit stored opt-in despite opt-out by default on restart', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const storage = memoryStorage();
    const first = new OursPrivacy();
    await first.init('remembered-choice', {
      storage,
      optOutTrackingByDefault: true,
    });
    await first.optInTracking();
    jest.resetModules();
    const { OursPrivacy: Reloaded } = require('@oursprivacy/react-native');
    const second = new Reloaded();
    await second.init('remembered-choice', {
      storage,
      optOutTrackingByDefault: true,
    });
    expect(second.hasOptedOutTracking()).toBe(false);
    second.track('after-restart');
    await second.oursprivacyImpl._pendingOperation;
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    expect(
      OursPrivacyQueueManager.getQueue('remembered-choice', '/ingest').some(
        (event) => event.event === 'after-restart',
      ),
    ).toBe(true);
  });

  it('starts periodic queue processing after a fresh opt-in', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const client = new OursPrivacy();
    await client.init('opt-in-timer', {
      storage: memoryStorage(),
      optOutTrackingByDefault: true,
    });
    await client.optInTracking();
    client.track('after-opt-in');
    await client.oursprivacyImpl._pendingOperation;
    fetchMock.mockResponse(
      JSON.stringify({ success: true, accepted: 2, rejected: [] }),
    );
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reconciles a background AppState transition while initialization is pending', async () => {
    const { AppState } = require('react-native');
    AppState.currentState = 'active';
    let onChange;
    AppState.addEventListener = jest.fn((_type, handler) => {
      onChange = handler;
      return { remove: jest.fn() };
    });
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const storage = memoryStorage();
    const releaseSession = deferred();
    const getItem = storage.getItem;
    storage.getItem = jest.fn(async (key) =>
      key.includes('_MOBILE_SESSION_V1')
        ? releaseSession.promise
        : getItem(key),
    );
    const client = new OursPrivacy();
    const initializing = client.init('background-init', {
      storage,
      trackAutomaticEvents: true,
    });
    await tickUntil(() =>
      storage.getItem.mock.calls.some(([key]) =>
        key.includes('_MOBILE_SESSION_V1'),
      ),
    );
    expect(onChange).toEqual(expect.any(Function));
    AppState.currentState = 'background';
    onChange('background');
    releaseSession.resolve(null);
    await initializing;
    await client.oursprivacyImpl._pendingOperation;
    expect(
      OursPrivacyQueueManager.getQueue('background-init', '/ingest').some(
        (event) => event.event === '$mobile_app_open',
      ),
    ).toBe(false);
  });

  it('omits empty per-call consent from event and identify payloads', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const client = new OursPrivacy();
    await client.init('empty-consent', { storage: memoryStorage() });
    client.track(
      'empty-event',
      {},
      { email: 'example@test.invalid', consent: {} },
    );
    await client.identify({ consent: {} });
    await client.oursprivacyImpl._pendingOperation;
    const events = OursPrivacyQueueManager.getQueue('empty-consent', '/ingest');
    expect(
      events.find((event) => event.event === 'empty-event').userProperties,
    ).toEqual({ email: 'example@test.invalid' });
    expect(
      events.find((event) => event.event === '$identify').userProperties,
    ).toBeNull();
  });
});

it('keeps the last opt-out when an earlier opt-in waits behind initialization', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const { getOptedOutKey } = require('../javascript/oursprivacy-constants');
  const values = new Map();
  const storage = memoryStorage(values);
  const consentRead = deferred();
  const getItem = storage.getItem;
  storage.getItem = jest.fn(async (key) =>
    key === getOptedOutKey('last-choice') ? consentRead.promise : getItem(key),
  );
  const client = new OursPrivacy();
  const initializing = client.init('last-choice', { storage });
  await tickUntil(() =>
    storage.getItem.mock.calls.some(
      ([key]) => key === getOptedOutKey('last-choice'),
    ),
  );
  const optingIn = client.optInTracking();
  const optingOut = client.optOutTracking();
  consentRead.resolve(null);
  await Promise.all([initializing, optingIn, optingOut]);
  expect(client.hasOptedOutTracking()).toBe(true);
  expect(values.get(getOptedOutKey('last-choice'))).toBe('true');
  await client.oursprivacyImpl.track('last-choice', 'must-stay-private');
  expect(
    require('../javascript/oursprivacy-queue').OursPrivacyQueueManager.getQueue(
      'last-choice',
      '/ingest',
    ),
  ).toEqual([]);
});

it('ignores an unmarked legacy opt-in when an app now defaults to opt-out', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const { getOptedOutKey } = require('../javascript/oursprivacy-constants');
  const storage = memoryStorage(
    new Map([[getOptedOutKey('legacy-default'), 'false']]),
  );
  const client = new OursPrivacy();
  await client.init('legacy-default', {
    storage,
    optOutTrackingByDefault: true,
  });
  expect(client.hasOptedOutTracking()).toBe(true);
});

it('queues a track at call time while a flush awaits the network', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const client = new OursPrivacy();
  await client.init('slow-network', { storage: memoryStorage() });
  await client.oursprivacyImpl.track('slow-network', 'first');
  const response = deferred();
  fetchMock.mockImplementation(() => response.promise);
  const flushing = client.flush();
  await tickUntil(() => fetchMock.mock.calls.length === 1);
  const calledAt = new Date(Date.now()).toISOString();
  const tracking = client.oursprivacyImpl.track(
    'slow-network',
    'during-upload',
  );
  jest.setSystemTime(Date.now() + 5000);
  for (let i = 0; i < 1000; i += 1) await Promise.resolve();
  const queuedWhileUploading = OursPrivacyQueueManager.getQueue(
    'slow-network',
    '/ingest',
  ).find((item) => item.event === 'during-upload');
  fetchMock.mockResponse(JSON.stringify({ success: true, visitor_id: 'ack' }));
  response.resolve(
    new Response(JSON.stringify({ success: true, visitor_id: 'ack' })),
  );
  await Promise.all([flushing, tracking]);
  expect(queuedWhileUploading?.eventProperties.mobile_occurred_at).toBe(
    calledAt,
  );
});

it('seeds first-open from an identity present before the SDK creates one', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const { getVisitorIdKey } = require('../javascript/oursprivacy-constants');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const values = new Map([
    [getVisitorIdKey('existing-install'), 'existing-visitor'],
  ]);
  const client = new OursPrivacy();
  await client.init('existing-install', {
    storage: memoryStorage(values),
    trackAutomaticEvents: true,
    appVersion: '2.0',
    appBuild: '20',
  });
  expect(
    OursPrivacyQueueManager.getQueue('existing-install', '/ingest').map(
      (item) => item.event,
    ),
  ).toEqual(['$mobile_app_open', '$mobile_session_start']);
  const stored = JSON.parse(
    values.get('OURSPRIVACY_existing-install_MOBILE_SESSION_V1'),
  );
  expect(stored).toMatchObject({
    firstOpenSent: true,
    observedAppVersion: '2.0',
    observedAppBuild: '20',
  });
});

it('persists the queue as an array readable by a rolled-back SDK', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const { getQueueKey } = require('../javascript/oursprivacy-constants');
  const values = new Map();
  const client = new OursPrivacy();
  await client.init('rollback-storage', {
    storage: memoryStorage(values),
    trackAutomaticEvents: true,
  });
  await client.oursprivacyImpl.track('rollback-storage', 'manual');
  const stored = JSON.parse(
    values.get(getQueueKey('rollback-storage', '/ingest')),
  );
  expect(Array.isArray(stored)).toBe(true);
  expect(stored.some((item) => item.event === 'manual')).toBe(true);
  jest.resetModules();
  const { OursPrivacy: Reloaded } = require('@oursprivacy/react-native');
  const next = new Reloaded();
  await next.init('rollback-storage', {
    storage: memoryStorage(values),
    trackAutomaticEvents: true,
  });
  expect(
    require('../javascript/oursprivacy-queue').OursPrivacyQueueManager.hasAcceptedFirstOpen(
      'rollback-storage',
      '/ingest',
    ),
  ).toBe(true);
});

it('disposes the previous app-state subscription and pending timer on re-init', async () => {
  const { AppState } = require('react-native');
  const listeners = new Set();
  AppState.addEventListener = jest.fn((_type, handler) => {
    listeners.add(handler);
    return { remove: () => listeners.delete(handler) };
  });
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  const storage = memoryStorage();
  await client.init('reinitialize', { storage, trackAutomaticEvents: true });
  await client.init('reinitialize', { storage, trackAutomaticEvents: true });
  expect(listeners.size).toBe(1);
  expect(jest.getTimerCount()).toBe(2);
});

it('returns tracking, screen, and reset completion promises', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('completion-promises', { storage: memoryStorage() });
  const tracking = client.track('manual');
  const screen = client.trackScreen('Home');
  const reset = client.reset();
  expect(tracking).toBeInstanceOf(Promise);
  expect(screen).toBeInstanceOf(Promise);
  expect(reset).toBeInstanceOf(Promise);
  await Promise.all([tracking, screen, reset]);
});

it('ignores reserved manual mobile event names', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const client = new OursPrivacy();
  await client.init('reserved-events', { storage: memoryStorage() });
  await expect(client.track('$mobile_app_open')).resolves.toBeUndefined();
  expect(
    require('../javascript/oursprivacy-queue').OursPrivacyQueueManager.getQueue(
      'reserved-events',
      '/ingest',
    ),
  ).toEqual([]);
});

it.each([
  ['empty', '', 200],
  ['no content', '', 204],
  [
    'no visitor ID',
    JSON.stringify({ success: true, request_id: 'extra' }),
    200,
  ],
])(
  'acknowledges a successful non-indexed %s response',
  async (_name, body, status) => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const client = new OursPrivacy();
    await client.init('compatible-ack', { storage: memoryStorage() });
    await client.oursprivacyImpl.track('compatible-ack', 'accepted');
    if (status === 204)
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response(null, { status })),
      );
    else fetchMock.mockResponse(body, { status });
    await client.flush();
    expect(
      require('../javascript/oursprivacy-queue').OursPrivacyQueueManager.getQueue(
        'compatible-ack',
        '/ingest',
      ),
    ).toEqual([]);
  },
);

it.each([
  [400, '{}', 'http_400'],
  [401, '{}', 'http_401'],
  [422, '{}', 'http_422'],
  [200, JSON.stringify({ success: false }), 'ingest_rejected'],
])(
  'durably drops permanent rejection %s and reports only its ID and code',
  async (status, body, code) => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const rejected = [];
    const client = new OursPrivacy();
    await client.init('permanent-rejection', {
      storage: memoryStorage(),
      onIngestRejected: (item) => {
        expect(
          OursPrivacyQueueManager.getQueue('permanent-rejection', '/ingest'),
        ).toEqual([]);
        rejected.push(item);
      },
    });
    await client.oursprivacyImpl.track('permanent-rejection', 'bad-event');
    const distinctId = OursPrivacyQueueManager.getQueue(
      'permanent-rejection',
      '/ingest',
    )[0].distinct_id;
    fetchMock.mockResponse(body, { status });
    const flushing = client.flush();
    await jest.advanceTimersByTimeAsync(62000);
    await flushing;
    expect(
      OursPrivacyQueueManager.getQueue('permanent-rejection', '/ingest'),
    ).toEqual([]);
    expect(rejected).toEqual([{ distinctId, code }]);
  },
);

it('discards a repeatedly malformed indexed acknowledgement on the fifth flush and allows the next batch', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const rejected = [];
  const client = new OursPrivacy();
  await client.init('invalid-ack-limit', {
    storage: memoryStorage(),
    onIngestRejected: (item) => rejected.push(item),
  });
  client.setFlushBatchSize(1);
  await client.oursprivacyImpl.track('invalid-ack-limit', 'bad-event');
  await client.oursprivacyImpl.track('invalid-ack-limit', 'next-event');
  const distinctId = OursPrivacyQueueManager.getQueue(
    'invalid-ack-limit',
    '/ingest',
  )[0].distinct_id;
  fetchMock.mockResponse(
    JSON.stringify({ success: true, accepted: 0, rejected: [] }),
  );
  for (let i = 0; i < 4; i += 1) await client.flush();
  expect(
    OursPrivacyQueueManager.getQueue('invalid-ack-limit', '/ingest'),
  ).toHaveLength(2);
  fetchMock.mockResponseOnce(
    JSON.stringify({ success: true, accepted: 0, rejected: [] }),
  );
  fetchMock.mockResponse(JSON.stringify({ success: true }));
  await client.flush();
  expect(
    OursPrivacyQueueManager.getQueue('invalid-ack-limit', '/ingest'),
  ).toEqual([]);
  expect(rejected).toEqual([{ distinctId, code: 'invalid_acknowledgment' }]);
});

it('limits malformed acknowledgments for the same head when new events join the batch', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const rejected = [];
  const token = 'growing-invalid-batch';
  const client = new OursPrivacy();
  await client.init(token, {
    storage: memoryStorage(),
    onIngestRejected: (item) => rejected.push(item),
  });
  await client.track('head-event');
  const headId = OursPrivacyQueueManager.getQueue(token, '/ingest')[0]
    .distinct_id;
  fetchMock.mockResponse(
    JSON.stringify({ success: true, accepted: 0, rejected: [] }),
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await client.track(`tail-event-${attempt}`);
    await client.flush();
  }

  expect(OursPrivacyQueueManager.getQueue(token, '/ingest')).toEqual([]);
  expect(rejected).toContainEqual({
    distinctId: headId,
    code: 'invalid_acknowledgment',
  });
});

it('stops rejection callbacks when the first callback opts out', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const rejected = [];
  const client = new OursPrivacy();
  let optingOut;
  await client.init('callback-opt-out', {
    storage: memoryStorage(),
    onIngestRejected: (item) => {
      rejected.push(item);
      optingOut = client.optOutTracking();
    },
  });
  await client.track('first-event');
  await client.track('second-event');
  fetchMock.mockResponse(
    JSON.stringify({
      success: true,
      accepted: 0,
      rejected: [
        { index: 0, code: 'invalid_event' },
        { index: 1, code: 'invalid_event' },
      ],
    }),
  );

  await client.flush();
  await optingOut;

  expect(rejected).toHaveLength(1);
  expect(client.hasOptedOutTracking()).toBe(true);
});

it('retains a saved explicit opt-out even if a rolled-back SDK rewrites the legacy flag', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const { getOptedOutKey } = require('../javascript/oursprivacy-constants');
  const values = new Map();
  const storage = memoryStorage(values);
  const client = new OursPrivacy();
  await client.init('rollback-consent', { storage });
  await client.optOutTracking();
  values.set(getOptedOutKey('rollback-consent'), 'false');
  jest.resetModules();
  const { OursPrivacy: Reloaded } = require('@oursprivacy/react-native');
  const next = new Reloaded();
  await next.init('rollback-consent', { storage });
  expect(next.hasOptedOutTracking()).toBe(true);
});

it.each(['reset', 'setVisitorId'])(
  'queues an announced session end under its previous identity before background %s',
  async (method) => {
    const { AppState } = require('react-native');
    let onChange;
    AppState.addEventListener = jest.fn((_type, handler) => {
      onChange = handler;
      return { remove() {} };
    });
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const client = new OursPrivacy();
    await client.init('background-identity', {
      storage: memoryStorage(),
      trackAutomaticEvents: true,
    });
    client.setFlushOnBackground(false);
    const originalVisitor = client.getVisitorId();
    await onChange('background');
    if (method === 'reset') await client.reset();
    else await client.setVisitorId('replacement-visitor');
    const ends = OursPrivacyQueueManager.getQueue(
      'background-identity',
      '/ingest',
    ).filter((item) => item.event === '$mobile_session_end');
    expect(ends).toHaveLength(1);
    expect(ends[0].visitor_id).toBe(originalVisitor);
  },
);

it('captures a screen call time before an earlier storage write completes', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const values = new Map();
  const storage = memoryStorage(values);
  const client = new OursPrivacy();
  await client.init('screen-call-time', { storage });
  const write = deferred();
  const setItem = storage.setItem;
  let blocked = false;
  storage.setItem = async (key, value) => {
    if (key.endsWith('_QUEUE') && !blocked) {
      blocked = true;
      await write.promise;
    }
    return setItem(key, value);
  };
  const tracking = client.track('earlier');
  await tickUntil(() => blocked);
  const calledAt = new Date(Date.now()).toISOString();
  const screen = client.trackScreen('Home');
  jest.setSystemTime(Date.now() + 5000);
  write.resolve();
  await Promise.all([tracking, screen]);
  expect(
    OursPrivacyQueueManager.getQueue('screen-call-time', '/ingest').find(
      (item) => item.event === '$mobile_screen_view',
    ).eventProperties.mobile_occurred_at,
  ).toBe(calledAt);
});

it('rejects explicit success false even when indexed fields are present', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const rejected = [];
  const client = new OursPrivacy();
  await client.init('false-indexed', {
    storage: memoryStorage(),
    onIngestRejected: (item) => rejected.push(item),
  });
  await client.track('bad-event');
  fetchMock.mockResponse(
    JSON.stringify({ success: false, accepted: 1, rejected: [] }),
  );
  await client.flush();
  expect(
    require('../javascript/oursprivacy-queue').OursPrivacyQueueManager.getQueue(
      'false-indexed',
      '/ingest',
    ),
  ).toEqual([]);
  expect(rejected).toEqual([
    { distinctId: expect.any(String), code: 'ingest_rejected' },
  ]);
});

it.each(['invalid JSON', 'unreadable row'])(
  'recovers initialization after a saved event queue has %s',
  async (kind) => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const { getQueueKey } = require('../javascript/oursprivacy-constants');
    const values = new Map([
      [getQueueKey('unusable-queue', '/ingest'), '{broken'],
    ]);
    const storage = memoryStorage(values);
    const getItem = storage.getItem;
    storage.getItem = async (key) => {
      if (
        kind === 'unreadable row' &&
        key === getQueueKey('unusable-queue', '/ingest')
      )
        throw new Error('row too large');
      return getItem(key);
    };
    const client = new OursPrivacy();
    await client.init('unusable-queue', { storage });
    await client.track('next-event');
    expect(
      JSON.parse(values.get(getQueueKey('unusable-queue', '/ingest'))).map(
        (item) => item.event,
      ),
    ).toEqual(['next-event']);
  },
);

it('cancels an old upload when reinitializing and leaves its captured event available for retry', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const values = new Map();
  const storage = memoryStorage(values);
  const client = new OursPrivacy();
  await client.init('reinit-upload', { storage });
  await client.track('captured-event');
  let signal;
  fetchMock.mockImplementation((_url, options) => {
    signal = options.signal;
    return new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('aborted'))),
    );
  });
  const flushing = client.flush();
  await tickUntil(() => fetchMock.mock.calls.length === 1);
  const reinitializing = client.init('reinit-upload', { storage });
  const aborted = signal.aborted;
  expect(aborted).toBe(true);
  await Promise.all([flushing, reinitializing]);
  expect(
    require('../javascript/oursprivacy-queue')
      .OursPrivacyQueueManager.getQueue('reinit-upload', '/ingest')
      .map((item) => item.event),
  ).toEqual(['captured-event']);
});

it('discards both old pending flushes on re-init while preserving their captured event', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const storage = memoryStorage();
  const token = 'pending-flush-reinit';
  const client = new OursPrivacy();
  await client.init(token, { storage });
  await client.track('captured-event');
  const response = deferred();
  fetchMock.mockImplementationOnce(() => response.promise);
  fetchMock.mockResponse(JSON.stringify({ success: true }));
  const first = client.flush();
  await tickUntil(() => fetchMock.mock.calls.length === 1);
  const second = client.flush();
  await client.oursprivacyImpl._pendingOperation;
  await client.init(token, { storage });
  response.resolve(new Response(JSON.stringify({ success: true })));
  await Promise.all([first, second]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(
    OursPrivacyQueueManager.getQueue(token, '/ingest').map(
      (item) => item.event,
    ),
  ).toEqual(['captured-event']);
});

it.each(['invalid JSON', 'unreadable row'])(
  'preserves the offline event array when auxiliary queue metadata has %s',
  async (kind) => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      getQueueKey,
      getQueueMetadataKey,
    } = require('../javascript/oursprivacy-constants');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const token = 'offline-queue-metadata';
    const pending = [
      {
        event: '$mobile_first_open',
        distinct_id: 'offline-first-open',
        visitor_id: 'offline-visitor',
        defaultProperties: { sid: '1791201600000' },
        eventProperties: {
          mobile_contract_version: 1,
          mobile_occurred_at: '2026-10-05T12:00:00.000Z',
        },
      },
      {
        event: 'offline-event',
        distinct_id: 'offline-event-id',
        visitor_id: 'offline-visitor',
      },
    ];
    const values = new Map([
      [getQueueKey(token, '/ingest'), JSON.stringify(pending)],
      [getQueueMetadataKey(token, '/ingest'), '{broken'],
    ]);
    const storage = memoryStorage(values);
    const getItem = storage.getItem;
    storage.getItem = async (key) => {
      if (
        kind === 'unreadable row' &&
        key === getQueueMetadataKey(token, '/ingest')
      )
        throw new Error('metadata unavailable');
      return getItem(key);
    };
    const client = new OursPrivacy();
    await client.init(token, { storage });
    expect(OursPrivacyQueueManager.getQueue(token, '/ingest')).toEqual(pending);
    expect(OursPrivacyQueueManager.hasAcceptedFirstOpen(token, '/ingest')).toBe(
      true,
    );
    await client.track('following-event');
    const stored = JSON.parse(values.get(getQueueKey(token, '/ingest')));
    expect(stored.slice(0, 2)).toEqual(pending);
    expect(stored.map((item) => item.event)).toEqual([
      '$mobile_first_open',
      'offline-event',
      'following-event',
    ]);
  },
);

it('keeps a durably queued event when its auxiliary metadata write fails', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    getQueueKey,
    getQueueMetadataKey,
  } = require('../javascript/oursprivacy-constants');
  const token = 'queue-metadata-write';
  const values = new Map();
  const storage = memoryStorage(values);
  const setItem = storage.setItem;
  let failedMetadata = false;
  storage.setItem = async (key, value) => {
    if (key === getQueueMetadataKey(token, '/ingest') && !failedMetadata) {
      failedMetadata = true;
      throw new Error('metadata write unavailable');
    }
    return setItem(key, value);
  };
  const client = new OursPrivacy();
  await client.init(token, { storage });
  await expect(client.track('first-event')).resolves.toBeUndefined();
  await client.track('second-event');
  expect(
    JSON.parse(values.get(getQueueKey(token, '/ingest'))).map(
      (item) => item.event,
    ),
  ).toEqual(['first-event', 'second-event']);
});

it('reports a durably removed rejection when auxiliary metadata cannot be saved', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const {
    getQueueKey,
    getQueueMetadataKey,
  } = require('../javascript/oursprivacy-constants');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const token = 'rejection-metadata-write';
  const values = new Map();
  const storage = memoryStorage(values);
  const rejected = [];
  const client = new OursPrivacy();
  await client.init(token, {
    storage,
    onIngestRejected: (item) => {
      expect(JSON.parse(values.get(getQueueKey(token, '/ingest')))).toEqual([]);
      rejected.push(item);
    },
  });
  await client.track('rejected-event');
  const setItem = storage.setItem;
  storage.setItem = async (key, value) => {
    if (key === getQueueMetadataKey(token, '/ingest'))
      throw new Error('metadata write unavailable');
    return setItem(key, value);
  };
  fetchMock.mockResponse(JSON.stringify({ success: false }));
  await client.flush();
  expect(OursPrivacyQueueManager.getQueue(token, '/ingest')).toEqual([]);
  expect(rejected).toEqual([
    { distinctId: expect.any(String), code: 'ingest_rejected' },
  ]);
  await client.flush();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('keeps a newer opt-out while an older opt-in persistence failure is handled', async () => {
  const { OursPrivacy } = require('@oursprivacy/react-native');
  const { getOptedOutKey } = require('../javascript/oursprivacy-constants');
  const token = 'failed-older-opt-in';
  const values = new Map();
  const storage = memoryStorage(values);
  const client = new OursPrivacy();
  await client.init(token, { storage });
  const oldWrite = deferred();
  const newWrite = deferred();
  const setItem = storage.setItem;
  let oldWriteStarted = false;
  storage.setItem = async (key, value) => {
    if (key === getOptedOutKey(token)) {
      if (value === 'false') {
        oldWriteStarted = true;
        await oldWrite.promise;
      } else await newWrite.promise;
    }
    return setItem(key, value);
  };
  const optingIn = client.optInTracking();
  optingIn.catch(() => {});
  await tickUntil(() => oldWriteStarted);
  const optingOut = client.optOutTracking();
  expect(client.hasOptedOutTracking()).toBe(true);
  oldWrite.reject(new Error('older write failed'));
  await expect(optingIn).rejects.toThrow('older write failed');
  const optedOutWhileWritePending = client.hasOptedOutTracking();
  newWrite.resolve();
  await optingOut;
  expect(optedOutWhileWritePending).toBe(true);
  expect(values.get(getOptedOutKey(token))).toBe('true');
});
