import fetchMock from 'jest-fetch-mock';

jest.unmock('../javascript/oursprivacy-storage');

fetchMock.enableMocks();

const flushAsyncWork = async (turns = 5) => {
  for (let index = 0; index < turns; index += 1) {
    await Promise.resolve();
  }
};

const waitForFetchCalls = async (count, attempts = 2000) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (fetchMock.mock.calls.length >= count) {
      // Native Response bodies finish asynchronously. Let the response parsing
      // and queue cleanup settle before the next phase resets the fetch mock.
      await jest.advanceTimersByTimeAsync(0);
      return;
    }
    await flushAsyncWork(1);
  }
  expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(count);
};

// Captures the AppState 'change' handler the SDK registers so the test
// can simulate the app moving to background.
const installAppStateCapture = () => {
  const RN = require('react-native');
  const captured = { handler: null, removed: false };
  RN.AppState.addEventListener = jest.fn((event, handler) => {
    if (event === 'change') captured.handler = handler;
    return {
      remove: jest.fn(() => {
        captured.removed = true;
      }),
    };
  });
  return captured;
};

const suspendPeriodicNetworkFlush = () => {
  const { OursPrivacyConfig } = require('../javascript/oursprivacy-config');
  jest
    .spyOn(OursPrivacyConfig.prototype, 'getFlushInterval')
    .mockReturnValue(60 * 60 * 1000);
};

const persistedQueueItems = (value) => {
  const parsed = JSON.parse(value);
  return Array.isArray(parsed) ? parsed : parsed.items;
};

describe('OursPrivacy integration flows', () => {
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

  it('stitches the initial link before queuing the first mobile open and a manual event', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();

    await op.init('mobile-token', {
      initialURL: 'myapp://open?ours_visitor_id=web-123&utm_source=email',
      trackAutomaticEvents: true,
      appVersion: '2.0.0',
      appBuild: '42',
    });
    await op.oursprivacyImpl.track('mobile-token', 'appointment_booked', {
      appointment_id: 'appointment-1',
    });

    const queued = OursPrivacyQueueManager.getQueue(
      'mobile-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.map((event) => event.event)).toEqual([
      '$deep_link_opened',
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
      'appointment_booked',
    ]);
    const first = queued[1];
    const booked = queued[4];
    expect(first.visitor_id).toBe('web-123');
    expect(booked.defaultProperties).toEqual(
      expect.objectContaining({
        sid: first.defaultProperties.sid,
        mobile_session_started_at: expect.any(String),
        mobile_occurred_at: expect.any(String),
        mobile_platform: 'ios',
        mobile_contract_version: 1,
        app_version: '2.0.0',
        app_build: '42',
        version: 'react-native@4.0.0',
      }),
    );
    expect(booked).not.toHaveProperty('time');
    expect(new Set(queued.map((event) => event.distinct_id)).size).toBe(
      queued.length,
    );
  });

  it('adds the same mobile contract fields to Android manual events', async () => {
    require('react-native').Platform.OS = 'android';
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('android-token');
    await op.oursprivacyImpl.track('android-token', 'appointment_booked');

    const [booked] = OursPrivacyQueueManager.getQueue(
      'android-token',
      OursPrivacyType.EVENTS,
    );
    expect(booked.defaultProperties).toEqual(
      expect.objectContaining({
        sid: expect.any(String),
        mobile_session_started_at: expect.any(String),
        mobile_occurred_at: expect.any(String),
        mobile_platform: 'android',
        mobile_contract_version: 1,
        os_name: 'Android',
        version: 'react-native@4.0.0',
      }),
    );
    expect(booked.defaultProperties).not.toHaveProperty('app_version');
    expect(booked.defaultProperties).not.toHaveProperty('app_build');
    expect(booked).not.toHaveProperty('time');
  });

  it('adds Android metadata to automatic facts', async () => {
    require('react-native').Platform.OS = 'android';
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('android-auto-token', { trackAutomaticEvents: true });

    const facts = OursPrivacyQueueManager.getQueue(
      'android-auto-token',
      OursPrivacyType.EVENTS,
    );
    expect(facts.map((item) => item.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    for (const fact of facts) {
      expect(fact.defaultProperties).toEqual(
        expect.objectContaining({
          sid: expect.any(String),
          mobile_platform: 'android',
          mobile_contract_version: 1,
        }),
      );
      expect(fact).not.toHaveProperty('time');
    }
  });

  it('keeps web events outside the mobile contract', async () => {
    require('react-native').Platform.OS = 'web';
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('web-token', { trackAutomaticEvents: true });
    await op.oursprivacyImpl.track('web-token', 'appointment_booked');

    const queued = OursPrivacyQueueManager.getQueue(
      'web-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.map((item) => item.event)).toEqual(['appointment_booked']);
    expect(queued[0].defaultProperties).not.toHaveProperty('sid');
    expect(queued[0].defaultProperties).not.toHaveProperty(
      'mobile_contract_version',
    );
    expect(queued[0].defaultProperties).not.toHaveProperty('mobile_platform');
  });

  it('serializes overlapping flushes and acknowledges only the sent IDs', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('flush-token');
    op.setFlushBatchSize(1);
    await op.oursprivacyImpl.track('flush-token', 'first');
    await op.oursprivacyImpl.track('flush-token', 'second');

    let releaseFirst;
    const firstGate = new Promise((resolve) => {
      releaseFirst = resolve;
    });
    const sent = [];
    fetchMock.mockImplementation(async (_url, options) => {
      const body = JSON.parse(options.body);
      sent.push(body.data[0].event);
      if (body.data[0].event === 'first') await firstGate;
      return { ok: true, json: async () => ({ success: true }) };
    });

    const firstFlush = op.oursprivacyImpl.core.flush('flush-token');
    const secondFlush = op.oursprivacyImpl.core.flush('flush-token');
    await flushAsyncWork(20);
    const callsWhileFirstPending = fetchMock.mock.calls.length;
    releaseFirst();
    await Promise.all([firstFlush, secondFlush]);
    await flushAsyncWork(100);

    expect(callsWhileFirstPending).toBe(1);
    expect(sent).toEqual(['first', 'second']);
    expect(
      OursPrivacyQueueManager.getQueue('flush-token', OursPrivacyType.EVENTS),
    ).toEqual([]);
  });

  it('does not remove a replacement event when an earlier send is acknowledged', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('replacement-token');
    op.setFlushBatchSize(1);
    await op.oursprivacyImpl.track('replacement-token', 'original');

    let releaseOriginal;
    const originalGate = new Promise((resolve) => {
      releaseOriginal = resolve;
    });
    const sent = [];
    fetchMock.mockImplementation(async (_url, options) => {
      const event = JSON.parse(options.body).data[0].event;
      sent.push(event);
      if (event === 'original') await originalGate;
      return { ok: true, json: async () => ({ success: true }) };
    });
    const flushing = op.oursprivacyImpl.core.flush('replacement-token');
    await flushAsyncWork(20);
    await OursPrivacyQueueManager.clearQueue(
      'replacement-token',
      OursPrivacyType.EVENTS,
    );
    await op.oursprivacyImpl.track('replacement-token', 'replacement');
    releaseOriginal();
    await flushing;

    expect(sent).toEqual(['original', 'replacement']);
    expect(
      OursPrivacyQueueManager.getQueue(
        'replacement-token',
        OursPrivacyType.EVENTS,
      ),
    ).toEqual([]);
  });

  it('removes only the rejected event after HTTP 400 and sends the next event', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('bad-batch-token');
    op.setFlushBatchSize(1);
    await op.oursprivacyImpl.track('bad-batch-token', 'invalid');
    await op.oursprivacyImpl.track('bad-batch-token', 'valid');

    const sent = [];
    fetchMock.mockImplementation(async (_url, options) => {
      const event = JSON.parse(options.body).data[0].event;
      sent.push(event);
      return {
        ok: event !== 'invalid',
        status: event === 'invalid' ? 400 : 200,
        json: async () => ({ success: event !== 'invalid' }),
      };
    });
    await op.oursprivacyImpl.core.flush('bad-batch-token');

    expect(sent).toEqual(['invalid', 'valid']);
    expect(
      OursPrivacyQueueManager.getQueue(
        'bad-batch-token',
        OursPrivacyType.EVENTS,
      ),
    ).toEqual([]);
  });

  it('handles AppState engagement and warm opens when background flushing is disabled', async () => {
    const appState = installAppStateCapture();
    suspendPeriodicNetworkFlush();
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('mobile-token', { trackAutomaticEvents: true });
    op.setFlushOnBackground(false);

    await jest.advanceTimersByTimeAsync(10_000);
    await appState.handler('background');
    await jest.advanceTimersByTimeAsync(5_000);
    await appState.handler('active');

    const queued = OursPrivacyQueueManager.getQueue(
      'mobile-token',
      OursPrivacyType.EVENTS,
    );
    expect(
      queued.filter((event) => event.event === '$mobile_app_open'),
    ).toHaveLength(2);
    expect(
      queued.filter((event) => event.event === '$mobile_session_start'),
    ).toHaveLength(1);
    expect(
      queued
        .filter((event) => event.event === '$mobile_session_engagement')
        .reduce(
          (total, event) =>
            total + event.eventProperties.engagement_duration_ms,
          0,
        ),
    ).toBe(10_000);
    expect(fetchMock.mock.calls).toHaveLength(0);
  });

  it('keeps automatic facts off while manual events get sessions, then starts fresh after opt-in', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('mobile-token', { trackAutomaticEvents: false });
    await op.oursprivacyImpl.track('mobile-token', 'appointment_booked');
    const before = OursPrivacyQueueManager.getQueue(
      'mobile-token',
      OursPrivacyType.EVENTS,
    );
    expect(before.map((event) => event.event)).toEqual(['appointment_booked']);
    expect(before[0].defaultProperties.sid).toEqual(expect.any(String));
    const oldSid = before[0].defaultProperties.sid;

    await op.oursprivacyImpl.optOutTracking('mobile-token');
    await op.oursprivacyImpl.track('mobile-token', 'while_opted_out');
    expect(
      OursPrivacyQueueManager.getQueue('mobile-token', OursPrivacyType.EVENTS),
    ).toEqual([]);

    await op.oursprivacyImpl.optInTracking('mobile-token');
    await op.oursprivacyImpl.track('mobile-token', 'after_opt_in');
    const after = OursPrivacyQueueManager.getQueue(
      'mobile-token',
      OursPrivacyType.EVENTS,
    );
    expect(after.map((event) => event.event)).toEqual([
      '$opt_in',
      'after_opt_in',
    ]);
    expect(after[1].defaultProperties.sid).not.toBe(oldSid);
  });

  it('retries a first open with its original event ID when queue persistence fails', async () => {
    const values = new Map();
    let failedId;
    let failQueueWrite = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.includes('_QUEUE') && failQueueWrite) {
          failQueueWrite = false;
          failedId = persistedQueueItems(value)[0].distinct_id;
          throw new Error('queue write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => {
        values.delete(key);
      },
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    const options = { storage, trackAutomaticEvents: true };

    await expect(op.init('retry-token', options)).rejects.toThrow(
      'queue write failed',
    );
    expect(failedId).toEqual(expect.any(String));
    expect(
      OursPrivacyQueueManager.getQueue('retry-token', OursPrivacyType.EVENTS),
    ).toEqual([]);

    await op.oursprivacyImpl.initialize('retry-token', options);
    const queued = OursPrivacyQueueManager.getQueue(
      'retry-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.map((event) => event.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(queued[0].distinct_id).toBe(failedId);
    expect(new Set(queued.map((event) => event.distinct_id)).size).toBe(3);
  });

  it('keeps unqueued lifecycle facts for their original visitor across an identity change', async () => {
    const values = new Map();
    let failQueueWrite = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.includes('_QUEUE') && failQueueWrite) {
          failQueueWrite = false;
          throw new Error('queue write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    const options = {
      storage,
      visitorId: 'visitor-before',
      trackAutomaticEvents: true,
    };

    await expect(op.init('identity-token', options)).rejects.toThrow(
      'queue write failed',
    );
    await op.setVisitorId('visitor-after');
    await op.oursprivacyImpl.initialize('identity-token', {
      storage,
      trackAutomaticEvents: true,
    });

    const queued = OursPrivacyQueueManager.getQueue(
      'identity-token',
      OursPrivacyType.EVENTS,
    );
    const first = queued.find((event) => event.event === '$mobile_first_open');
    expect(first.visitor_id).toBe('visitor-before');
    expect(
      queued.filter((event) => event.event === '$mobile_first_open'),
    ).toHaveLength(1);
  });

  it('preserves full opt-out across a process restart', async () => {
    const values = new Map();
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => values.set(key, value),
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();
    await op.init('consent-token', { storage, trackAutomaticEvents: true });
    await op.oursprivacyImpl.optOutTracking('consent-token');

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init('consent-token', {
      storage,
      trackAutomaticEvents: true,
    });
    await reloaded.oursprivacyImpl.track('consent-token', 'appointment_booked');

    expect(reloaded.hasOptedOutTracking()).toBe(true);
    expect(
      OursPrivacyQueueManager.getQueue('consent-token', OursPrivacyType.EVENTS),
    ).toEqual([]);
  });

  it('holds first-open until automatic tracking is opted in', async () => {
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('first-opt-in-token', {
      optOutTrackingByDefault: true,
      trackAutomaticEvents: true,
    });
    await op.oursprivacyImpl.track('first-opt-in-token', 'while_opted_out');
    expect(
      OursPrivacyQueueManager.getQueue(
        'first-opt-in-token',
        OursPrivacyType.EVENTS,
      ),
    ).toEqual([]);

    await op.oursprivacyImpl.optInTracking('first-opt-in-token');
    const queued = OursPrivacyQueueManager.getQueue(
      'first-opt-in-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.map((event) => event.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
      '$opt_in',
    ]);
    expect(
      new Set(queued.map((event) => event.defaultProperties.sid)).size,
    ).toBe(1);
  });

  it('keeps first-open eligible after an unqueued attempt is cleared by opt-out', async () => {
    const values = new Map();
    let failQueueWrite = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.includes('_QUEUE') && failQueueWrite) {
          failQueueWrite = false;
          throw new Error('queue write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();

    await expect(
      op.init('failed-first-opt-token', {
        storage,
        trackAutomaticEvents: true,
      }),
    ).rejects.toThrow('queue write failed');
    await op.oursprivacyImpl.optOutTracking('failed-first-opt-token');
    await op.oursprivacyImpl.optInTracking('failed-first-opt-token');

    const queued = OursPrivacyQueueManager.getQueue(
      'failed-first-opt-token',
      OursPrivacyType.EVENTS,
    );
    expect(
      queued.filter((event) => event.event === '$mobile_first_open'),
    ).toHaveLength(1);
  });

  it('replays first-open after restart with its original ID and app version', async () => {
    const values = new Map();
    let failedId;
    let failQueueWrite = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.includes('_QUEUE') && failQueueWrite) {
          failQueueWrite = false;
          const [attempted] = persistedQueueItems(value);
          failedId = attempted.distinct_id;
          throw new Error('queue write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const first = new OursPrivacy();
    await expect(
      first.init('restart-token', {
        storage,
        trackAutomaticEvents: true,
        appVersion: '1.0',
      }),
    ).rejects.toThrow('queue write failed');

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init('restart-token', {
      storage,
      trackAutomaticEvents: true,
      appVersion: '2.0',
    });
    const queued = OursPrivacyQueueManager.getQueue(
      'restart-token',
      OursPrivacyType.EVENTS,
    );
    const firstOpen = queued.find(
      (event) => event.event === '$mobile_first_open',
    );
    const update = queued.find((event) => event.event === '$mobile_app_update');
    expect(firstOpen.distinct_id).toBe(failedId);
    expect(firstOpen.defaultProperties.app_version).toBe('1.0');
    expect(update.defaultProperties.app_version).toBe('2.0');
    expect(update.eventProperties.previous_app_version).toBe('1.0');
    expect(
      queued.filter((event) => event.event === '$mobile_first_open'),
    ).toHaveLength(1);
  });

  it('fails initialization when the saved queue cannot be read', async () => {
    const storage = {
      getItem: async (key) => {
        if (key.includes('_QUEUE')) throw new Error('queue read failed');
        return null;
      },
      setItem: async () => {},
      removeItem: async () => {},
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    await expect(op.init('queue-read-token', { storage })).rejects.toThrow(
      'queue read failed',
    );
  });

  it('does not duplicate a persisted first-open when its session acknowledgement fails', async () => {
    const values = new Map();
    let failAcknowledgement = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (
          key.includes('_MOBILE_SESSION_V1') &&
          JSON.parse(value).pendingEvents?.length === 2 &&
          failAcknowledgement
        ) {
          failAcknowledgement = false;
          throw new Error('ack write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    const options = { storage, trackAutomaticEvents: true };

    await expect(op.init('ack-token', options)).rejects.toThrow(
      'ack write failed',
    );
    const firstAttempt = OursPrivacyQueueManager.getQueue(
      'ack-token',
      OursPrivacyType.EVENTS,
    );
    expect(firstAttempt.map((event) => event.event)).toEqual([
      '$mobile_first_open',
    ]);

    await op.oursprivacyImpl.initialize('ack-token', options);
    const queued = OursPrivacyQueueManager.getQueue(
      'ack-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.map((event) => event.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
    expect(queued[0].distinct_id).toBe(firstAttempt[0].distinct_id);
  });

  it('does not repeat a sent first-open after its session acknowledgement fails and tracking is opted out', async () => {
    const values = new Map();
    let failAcknowledgement = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (
          key.includes('_MOBILE_SESSION_V1') &&
          JSON.parse(value).pendingEvents?.length === 2 &&
          failAcknowledgement
        ) {
          failAcknowledgement = false;
          throw new Error('ack write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await expect(
      op.init('sent-first-token', { storage, trackAutomaticEvents: true }),
    ).rejects.toThrow('ack write failed');
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    await op.oursprivacyImpl.core.flush('sent-first-token');
    await waitForFetchCalls(1);
    expect(
      OursPrivacyQueueManager.getQueue(
        'sent-first-token',
        OursPrivacyType.EVENTS,
      ),
    ).toEqual([]);

    await op.oursprivacyImpl.optOutTracking('sent-first-token');
    await op.oursprivacyImpl.optInTracking('sent-first-token');
    const queued = OursPrivacyQueueManager.getQueue(
      'sent-first-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.some((item) => item.event === '$mobile_first_open')).toBe(
      false,
    );
  });

  it('remembers queue acceptance across restart before opt-out', async () => {
    const values = new Map();
    let failAcknowledgement = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (
          key.includes('_MOBILE_SESSION_V1') &&
          JSON.parse(value).pendingEvents?.length === 2 &&
          failAcknowledgement
        ) {
          failAcknowledgement = false;
          throw new Error('ack write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const first = new OursPrivacy();
    await expect(
      first.init('restart-accepted-token', {
        storage,
        trackAutomaticEvents: true,
      }),
    ).rejects.toThrow('ack write failed');
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    await first.oursprivacyImpl.core.flush('restart-accepted-token');

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init('restart-accepted-token', {
      storage,
      trackAutomaticEvents: true,
      optOutTrackingByDefault: true,
    });
    await reloaded.optInTracking();

    const queued = OursPrivacyQueueManager.getQueue(
      'restart-accepted-token',
      OursPrivacyType.EVENTS,
    );
    expect(queued.some((item) => item.event === '$mobile_first_open')).toBe(
      false,
    );
  });

  it('keeps a sent first-open consumed across a failed marker write, crash, opt-out, and opt-in', async () => {
    const values = new Map();
    let failMarker = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (
          key.includes('_MOBILE_SESSION_V1') &&
          JSON.parse(value).pendingEvents?.some(
            (record) =>
              record.fact.event === '$mobile_first_open' &&
              record.queueAccepted === true,
          ) &&
          failMarker
        ) {
          failMarker = false;
          throw new Error('marker write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const token = 'crash-accepted-token';
    const first = new OursPrivacy();
    await expect(
      first.init(token, { storage, trackAutomaticEvents: true }),
    ).rejects.toThrow('marker write failed');
    const firstOpen = OursPrivacyQueueManager.getQueue(
      token,
      OursPrivacyType.EVENTS,
    )[0];
    expect(firstOpen.event).toBe('$mobile_first_open');
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    await first.oursprivacyImpl.core.flush(token);
    expect(
      OursPrivacyQueueManager.getQueue(token, OursPrivacyType.EVENTS),
    ).toEqual([]);

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager: ReloadedQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init(token, {
      storage,
      trackAutomaticEvents: true,
      optOutTrackingByDefault: true,
    });
    await reloaded.optInTracking();
    expect(
      ReloadedQueueManager.getQueue(token, OursPrivacyType.EVENTS).filter(
        (item) => item.event === '$mobile_first_open',
      ),
    ).toEqual([]);
  });

  it('restores first-open eligibility across a failed queue write, crash, opt-out, and opt-in', async () => {
    const values = new Map();
    let failedId;
    let failQueue = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.includes('_QUEUE') && failQueue) {
          failQueue = false;
          failedId = persistedQueueItems(value)[0].distinct_id;
          throw new Error('queue write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const token = 'crash-unaccepted-token';
    const first = new OursPrivacy();
    await expect(
      first.init(token, { storage, trackAutomaticEvents: true }),
    ).rejects.toThrow('queue write failed');

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init(token, {
      storage,
      trackAutomaticEvents: true,
      optOutTrackingByDefault: true,
    });
    await reloaded.optInTracking();
    const firstOpens = OursPrivacyQueueManager.getQueue(
      token,
      OursPrivacyType.EVENTS,
    ).filter((item) => item.event === '$mobile_first_open');
    expect(firstOpens).toHaveLength(1);
    expect(firstOpens[0].distinct_id).not.toBe(failedId);
  });

  it.each(['setVisitorId', 'reset'])(
    'counts time spent in slow session storage after %s rotation',
    async (action) => {
      const appState = installAppStateCapture();
      suspendPeriodicNetworkFlush();
      const values = new Map();
      let holdNextSessionWrite = false;
      let blocked = false;
      let releaseWrite;
      const held = new Promise((resolve) => {
        releaseWrite = resolve;
      });
      const storage = {
        getItem: async (key) => values.get(key) ?? null,
        setItem: async (key, value) => {
          if (key.includes('_MOBILE_SESSION_V1') && holdNextSessionWrite) {
            holdNextSessionWrite = false;
            blocked = true;
            await held;
          }
          values.set(key, value);
        },
        removeItem: async (key) => values.delete(key),
      };
      const { OursPrivacy } = require('@oursprivacy/react-native');
      const {
        OursPrivacyQueueManager,
      } = require('../javascript/oursprivacy-queue');
      const {
        OursPrivacyType,
      } = require('../javascript/oursprivacy-constants');
      const token = `slow-${action}-token`;
      const op = new OursPrivacy();
      await op.init(token, { storage, trackAutomaticEvents: true });
      op.setFlushOnBackground(false);
      holdNextSessionWrite = true;
      const rotationAtMs = Date.now();
      const rotation =
        action === 'setVisitorId'
          ? op.setVisitorId('new-visitor')
          : op.oursprivacyImpl.reset(token);
      await flushAsyncWork(100);
      expect(blocked).toBe(true);
      await jest.advanceTimersByTimeAsync(5_000);
      releaseWrite();
      await rotation;
      await jest.advanceTimersByTimeAsync(5_000);
      await appState.handler('background');

      const queued = OursPrivacyQueueManager.getQueue(
        token,
        OursPrivacyType.EVENTS,
      );
      const starts = queued.filter(
        (item) => item.event === '$mobile_session_start',
      );
      expect(starts).toHaveLength(2);
      expect(
        Date.parse(starts[1].defaultProperties.mobile_session_started_at),
      ).toBe(rotationAtMs);
      expect(Date.parse(starts[1].defaultProperties.mobile_occurred_at)).toBe(
        rotationAtMs,
      );
      const rotatedSid = starts[1].defaultProperties.sid;
      expect(
        queued
          .filter(
            (item) =>
              item.event === '$mobile_session_engagement' &&
              item.defaultProperties.sid === rotatedSid,
          )
          .reduce(
            (total, item) =>
              total + item.eventProperties.engagement_duration_ms,
            0,
          ),
      ).toBe(10_000);
    },
  );

  it('reports opt-out persistence failure and succeeds on retry across restart', async () => {
    const values = new Map();
    let failOptOut = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.endsWith('_OPT_OUT') && value === 'true' && failOptOut) {
          failOptOut = false;
          throw new Error('opt-out write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();
    await op.init('consent-failure-token', { storage });

    await expect(op.optOutTracking()).rejects.toThrow('opt-out write failed');
    expect(op.hasOptedOutTracking()).toBe(true);
    await op.optOutTracking();

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init('consent-failure-token', { storage });
    expect(reloaded.hasOptedOutTracking()).toBe(true);
  });

  it('keeps tracking opted out when an opt-in write fails', async () => {
    const values = new Map();
    let failOptIn = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (key.endsWith('_OPT_OUT') && value === 'false' && failOptIn) {
          failOptIn = false;
          throw new Error('opt-in write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('failed-opt-in-token', {
      storage,
      optOutTrackingByDefault: true,
    });

    await expect(op.optInTracking()).rejects.toThrow('opt-in write failed');
    expect(op.hasOptedOutTracking()).toBe(true);
    await op.oursprivacyImpl.track('failed-opt-in-token', 'appointment_booked');
    expect(
      OursPrivacyQueueManager.getQueue(
        'failed-opt-in-token',
        OursPrivacyType.EVENTS,
      ),
    ).toEqual([]);

    jest.resetModules();
    const {
      OursPrivacy: ReloadedOursPrivacy,
    } = require('@oursprivacy/react-native');
    const reloaded = new ReloadedOursPrivacy();
    await reloaded.init('failed-opt-in-token', { storage });
    expect(reloaded.hasOptedOutTracking()).toBe(true);
  });

  it('fails initialization when the saved opt-out flag cannot be read', async () => {
    const storage = {
      getItem: async (key) => {
        if (key.endsWith('_OPT_OUT')) throw new Error('opt-out read failed');
        return null;
      },
      setItem: async () => {},
      removeItem: async () => {},
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();
    await expect(op.init('consent-read-token', { storage })).rejects.toThrow(
      'opt-out read failed',
    );
  });

  it('keeps app-open tied to AppState while rotating identity and reset sessions', async () => {
    const appState = installAppStateCapture();
    suspendPeriodicNetworkFlush();
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('active-rotation-token', { trackAutomaticEvents: true });
    op.setFlushOnBackground(false);
    const initial = OursPrivacyQueueManager.getQueue(
      'active-rotation-token',
      OursPrivacyType.EVENTS,
    );
    const firstSid = initial[0].defaultProperties.sid;

    await op.setVisitorId('different-visitor');
    await op.oursprivacyImpl.reset('active-rotation-token');
    await op.oursprivacyImpl.track(
      'active-rotation-token',
      'appointment_booked',
    );
    await jest.advanceTimersByTimeAsync(10_000);

    const queued = OursPrivacyQueueManager.getQueue(
      'active-rotation-token',
      OursPrivacyType.EVENTS,
    );
    expect(
      queued.filter((item) => item.event === '$mobile_app_open'),
    ).toHaveLength(1);
    const booked = queued.find((item) => item.event === 'appointment_booked');
    expect(booked.defaultProperties.sid).not.toBe(firstSid);
    expect(
      queued.find(
        (item) =>
          item.event === '$mobile_session_engagement' &&
          item.defaultProperties.sid === booked.defaultProperties.sid,
      ),
    ).toEqual(
      expect.objectContaining({
        eventProperties: expect.objectContaining({
          engagement_duration_ms: 10_000,
        }),
      }),
    );

    await appState.handler('background');
    await appState.handler('active');
    expect(
      OursPrivacyQueueManager.getQueue(
        'active-rotation-token',
        OursPrivacyType.EVENTS,
      ).filter((item) => item.event === '$mobile_app_open'),
    ).toHaveLength(2);
  });

  it('does not attach changed attribution or user defaults to a replayed lifecycle fact', async () => {
    const values = new Map();
    let failFirstOpen = true;
    const storage = {
      getItem: async (key) => values.get(key) ?? null,
      setItem: async (key, value) => {
        if (
          key.includes('_QUEUE') &&
          persistedQueueItems(value).some(
            (item) => item.event === '$mobile_first_open',
          ) &&
          failFirstOpen
        ) {
          failFirstOpen = false;
          throw new Error('queue write failed');
        }
        values.set(key, value);
      },
      removeItem: async (key) => values.delete(key),
    };
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await expect(
      op.init('context-token', {
        storage,
        trackAutomaticEvents: true,
        initialURL: 'myapp://open?utm_source=before',
        defaultUserCustomProperties: { plan: 'before' },
      }),
    ).rejects.toThrow('queue write failed');
    const originalVisitor = op.getVisitorId();
    await op.setVisitorId('visitor-after');
    op.oursprivacyImpl.updateDefaultUserCustomProperties('context-token', {
      plan: 'after',
    });
    await op.trackDeepLink('myapp://open?utm_source=after');

    const queued = OursPrivacyQueueManager.getQueue(
      'context-token',
      OursPrivacyType.EVENTS,
    );
    const firstOpen = queued.find(
      (item) => item.event === '$mobile_first_open',
    );
    expect(firstOpen.defaultProperties).not.toHaveProperty('utm_source');
    expect(firstOpen.userProperties).toBeNull();
    expect(firstOpen.visitor_id).toBe(originalVisitor);
  });

  it('queues a snapshot-observed session end under the old session defaults', async () => {
    const appState = installAppStateCapture();
    suspendPeriodicNetworkFlush();
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('mobile-token', { trackAutomaticEvents: true });
    op.setFlushOnBackground(false);
    await appState.handler('background');
    await jest.advanceTimersByTimeAsync(30 * 60 * 1000);
    await op.oursprivacyImpl.track('mobile-token', 'appointment_booked');

    const queued = OursPrivacyQueueManager.getQueue(
      'mobile-token',
      OursPrivacyType.EVENTS,
    );
    const oldSid = queued.find(
      (event) => event.event === '$mobile_session_start',
    ).defaultProperties.sid;
    const end = queued.find((event) => event.event === '$mobile_session_end');
    const booked = queued.find((event) => event.event === 'appointment_booked');
    expect(end.defaultProperties.sid).toBe(oldSid);
    expect(booked.defaultProperties.sid).not.toBe(oldSid);
    expect(end.defaultProperties.mobile_session_started_at).toBe(
      queued[0].defaultProperties.mobile_session_started_at,
    );
  });

  it('continues foreground engagement after an identity change', async () => {
    suspendPeriodicNetworkFlush();
    const { OursPrivacy } = require('@oursprivacy/react-native');
    const {
      OursPrivacyQueueManager,
    } = require('../javascript/oursprivacy-queue');
    const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
    const op = new OursPrivacy();
    await op.init('identity-engagement-token', { trackAutomaticEvents: true });
    const queuedBefore = OursPrivacyQueueManager.getQueue(
      'identity-engagement-token',
      OursPrivacyType.EVENTS,
    );
    const oldSid = queuedBefore[0].defaultProperties.sid;

    await op.setVisitorId('visitor-after');
    await jest.advanceTimersByTimeAsync(10_000);
    const queuedAfter = OursPrivacyQueueManager.getQueue(
      'identity-engagement-token',
      OursPrivacyType.EVENTS,
    );
    const engagement = queuedAfter.find(
      (event) => event.event === '$mobile_session_engagement',
    );
    expect(engagement.defaultProperties.sid).not.toBe(oldSid);
    expect(engagement.eventProperties.engagement_duration_ms).toBe(10_000);
    expect(
      queuedAfter.filter((event) => event.event === '$mobile_first_open'),
    ).toHaveLength(1);
  });

  it('runs init -> track -> flush through the real JS stack', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), {
      status: 200,
    });

    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    await op.init('test-token', {
      serverURL: 'https://api.oursprivacy.com',
      visitorId: 'preset-visitor-123',
      defaultEventProperties: { platform: 'mobile' },
      defaultUserCustomProperties: { plan: 'pro' },
      defaultUserConsentProperties: { marketing: true },
    });

    op.track('Purchase', { price: 99 });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe('https://api.oursprivacy.com/ingest');
    expect(body.token).toBe('test-token');
    expect(body.is_manually_set_id).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toEqual(
      expect.objectContaining({
        event: 'Purchase',
        visitor_id: 'preset-visitor-123',
        distinct_id: expect.any(String),
        eventProperties: {
          platform: 'mobile',
          price: 99,
        },
        userProperties: {
          custom_properties: { plan: 'pro' },
          consent: { marketing: true },
        },
        defaultProperties: expect.objectContaining({
          device_type: 'mobile',
          os_name: 'iOS',
          version: expect.any(String),
        }),
      }),
    );
  });

  it('drops pre-opt-out queued events across optOut -> optIn -> track -> flush', async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ success: true }), {
      status: 200,
    });

    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    await op.init('test-token', {
      serverURL: 'https://api-eu.oursprivacy.com',
      visitorId: 'preset-visitor-123',
    });

    op.track('Before Opt Out', { step: 1 });
    await flushAsyncWork();

    op.optOutTracking();
    await flushAsyncWork();
    expect(op.hasOptedOutTracking()).toBe(true);

    op.optInTracking();
    await op.oursprivacyImpl._pendingOperation;
    expect(op.hasOptedOutTracking()).toBe(false);

    op.track('After Opt In', { step: 2 });
    await flushAsyncWork();

    op.flush();
    await waitForFetchCalls(1);

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    const eventNames = body.data.map((event) => event.event);

    expect(url).toBe('https://api-eu.oursprivacy.com/ingest');
    expect(eventNames).toEqual(['$opt_in', 'After Opt In']);
    expect(eventNames).not.toContain('Before Opt Out');
  });

  it('deep link attribution: initialURL → warm deep link → set visitor → opt cycle → reset', async () => {
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });

    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    // Step 1: Init with initialURL — should fire $deep_link_opened and set attribution
    await op.init('test-token', {
      serverURL: 'https://api.oursprivacy.com',
      initialURL:
        'myapp://open?utm_source=google&utm_medium=cpc&gclid=init_gclid&aleid=init_aleid',
    });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    let deepLinkEvent = body.data.find((e) => e.event === '$deep_link_opened');
    expect(deepLinkEvent).toBeTruthy();
    // Attribution in defaultProperties, not eventProperties
    expect(deepLinkEvent.defaultProperties.utm_source).toBe('google');
    expect(deepLinkEvent.defaultProperties.gclid).toBe('init_gclid');
    expect(deepLinkEvent.defaultProperties.aleid).toBe('init_aleid');
    // Only URL in eventProperties
    expect(deepLinkEvent.eventProperties.url).toContain('myapp://open');
    expect(deepLinkEvent.eventProperties.utm_source).toBeUndefined();

    // Step 2: Track after init — attribution should persist in defaultProperties
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    op.track('after_init', { step: 2 });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    let trackEvent = body.data.find((e) => e.event === 'after_init');
    expect(trackEvent.defaultProperties.utm_source).toBe('google');
    expect(trackEvent.defaultProperties.gclid).toBe('init_gclid');
    const visitorIdAfterInit = trackEvent.visitor_id;

    // Step 3: Warm deep link — replaces attribution, stitches visitor ID
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    await op.trackDeepLink(
      'myapp://products/123?utm_source=applovin&aleid=warm_aleid&ours_visitor_id=web-uuid-123',
    );
    op.track('after_warm_link', { step: 3 });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    deepLinkEvent = body.data.find((e) => e.event === '$deep_link_opened');
    trackEvent = body.data.find((e) => e.event === 'after_warm_link');
    // New attribution replaces old — gclid from init should be gone
    expect(deepLinkEvent.defaultProperties.utm_source).toBe('applovin');
    expect(deepLinkEvent.defaultProperties.aleid).toBe('warm_aleid');
    expect(deepLinkEvent.defaultProperties.gclid).toBeUndefined();
    // Visitor ID stitched from ours_visitor_id
    expect(trackEvent.visitor_id).toBe('web-uuid-123');
    expect(trackEvent.visitor_id).not.toBe(visitorIdAfterInit);
    // is_manually_set_id should be true
    expect(body.is_manually_set_id).toBe(true);

    // Step 4: setVisitorId manually
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    await op.setVisitorId('manual-visitor-id');
    op.track('after_set_visitor', { step: 4 });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    trackEvent = body.data.find((e) => e.event === 'after_set_visitor');
    expect(trackEvent.visitor_id).toBe('manual-visitor-id');

    // Step 5: Opt out → deep link (should be complete no-op) → opt in
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    await op.optOutTracking();
    await flushAsyncWork(10);
    await op.trackDeepLink(
      'myapp://open?utm_source=should_not_appear&gclid=nope',
    );
    await flushAsyncWork(10);
    await op.optInTracking();
    await flushAsyncWork(10);
    op.track('after_opt_cycle', { step: 5 });
    await flushAsyncWork(10);
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    trackEvent = body.data.find((e) => e.event === 'after_opt_cycle');
    // Attribution from opted-out deep link should NOT be present
    expect(trackEvent.defaultProperties.utm_source).toBeUndefined();
    expect(trackEvent.defaultProperties.gclid).toBeUndefined();
    // The $deep_link_opened from the opted-out call should not exist
    const allEvents = body.data.map((e) => e.event);
    expect(allEvents).toContain('$opt_in');
    expect(allEvents).not.toContain('$deep_link_opened');

    // Step 6: Reset — should clear everything
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    op.reset();
    await flushAsyncWork(10);
    op.track('after_reset', { step: 6 });
    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    body = JSON.parse(fetchMock.mock.calls[0][1].body);
    trackEvent = body.data.find((e) => e.event === 'after_reset');
    // No attribution after reset
    expect(trackEvent.defaultProperties.utm_source).toBeUndefined();
    expect(trackEvent.defaultProperties.aleid).toBeUndefined();
    // New visitor_id
    expect(trackEvent.visitor_id).not.toBe('manual-visitor-id');
    expect(trackEvent.visitor_id).not.toBe('web-uuid-123');
  });

  it('3-arg track: top-level user props, custom_properties + consent merge, null when empty', async () => {
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });

    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    await op.init('test-token', {
      serverURL: 'https://api.oursprivacy.com',
      visitorId: 'preset-visitor-123',
      defaultUserCustomProperties: { test_user: true },
    });

    // S1: 2-arg backwards compat — default custom only on the wire
    op.track('two_arg_compat', { scenario: 1 });
    // S2: 3-arg with top-level user props (email + externalId)
    op.track(
      'three_arg_top_level',
      { scenario: 2 },
      { email: 'qa@example.com', externalId: 'qa-1' },
    );
    // S3: 3-arg with per-call customProperties — merges on top of default {test_user:true}
    op.track(
      'three_arg_custom_merge',
      { scenario: 3 },
      { customProperties: { tier: 'gold' } },
    );
    // S4: 3-arg with per-call consent — no default consent, should appear verbatim
    op.track(
      'three_arg_consent',
      { scenario: 4 },
      { consent: { marketing: true } },
    );

    await flushAsyncWork();
    op.flush();
    await waitForFetchCalls(1);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const byName = Object.fromEntries(body.data.map((e) => [e.event, e]));

    // S1: backwards compat — default custom_properties only
    expect(byName.two_arg_compat.userProperties).toEqual({
      custom_properties: { test_user: true },
    });

    // S2: top-level keys spread, default custom_properties merged, no consent key
    expect(byName.three_arg_top_level.userProperties).toEqual({
      email: 'qa@example.com',
      external_id: 'qa-1',
      custom_properties: { test_user: true },
    });
    expect(byName.three_arg_top_level.userProperties.consent).toBeUndefined();

    // S3: custom_properties merged (default + per-call)
    expect(
      byName.three_arg_custom_merge.userProperties.custom_properties,
    ).toEqual({
      test_user: true,
      tier: 'gold',
    });

    // S4: consent appears, default custom_properties still merged
    expect(byName.three_arg_consent.userProperties.consent).toEqual({
      marketing: true,
    });
    expect(byName.three_arg_consent.userProperties.custom_properties).toEqual({
      test_user: true,
    });

    // S5: separate instance with no defaults and no per-call user props → null
    fetchMock.resetMocks();
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });
    const op2 = new OursPrivacy();
    await op2.init('test-token-2', {
      serverURL: 'https://api.oursprivacy.com',
      visitorId: 'preset-visitor-456',
    });
    op2.track('no_user_props_anywhere', { scenario: 5 });
    await flushAsyncWork();
    op2.flush();
    await waitForFetchCalls(1);
    const body2 = JSON.parse(fetchMock.mock.calls[0][1].body);
    const s5 = body2.data.find((e) => e.event === 'no_user_props_anywhere');
    expect(s5.userProperties).toBeNull();
  });

  it('flushes queued events when the app moves to background', async () => {
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });

    const appState = installAppStateCapture();

    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    await op.init('test-token', {
      serverURL: 'https://api.oursprivacy.com',
      visitorId: 'preset-visitor-bg',
    });

    op.track('Backgrounded Event', { step: 1 });
    await flushAsyncWork();

    expect(appState.handler).toEqual(expect.any(Function));
    expect(fetchMock.mock.calls).toHaveLength(0);

    // Simulate the OS pushing the app to background.
    appState.handler('background');

    await waitForFetchCalls(1);

    const [url, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(url).toBe('https://api.oursprivacy.com/ingest');
    expect(body.data).toHaveLength(1);
    expect(body.data[0].event).toBe('Backgrounded Event');
  });

  it('does not flush on transitions that are not background/inactive', async () => {
    fetchMock.mockResponse(JSON.stringify({ success: true }), { status: 200 });

    const appState = installAppStateCapture();

    const { OursPrivacy } = require('@oursprivacy/react-native');
    const op = new OursPrivacy();

    await op.init('test-token', {
      serverURL: 'https://api.oursprivacy.com',
      visitorId: 'preset-visitor-bg2',
    });

    op.track('Foreground Only', { step: 1 });
    await flushAsyncWork();

    appState.handler('active');
    await flushAsyncWork();

    expect(fetchMock.mock.calls).toHaveLength(0);
  });
});
