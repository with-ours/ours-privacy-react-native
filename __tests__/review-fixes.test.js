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

describe('SDK review regressions', () => {
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
