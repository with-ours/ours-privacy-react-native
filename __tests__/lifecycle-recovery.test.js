import fetchMock from 'jest-fetch-mock';

jest.unmock('../javascript/oursprivacy-storage');

fetchMock.enableMocks();

const storageFor = (values) => ({
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => values.set(key, value),
  removeItem: async (key) => values.delete(key),
});

function sdk() {
  const { OursPrivacy } = require('../index');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const { OursPrivacyType } = require('../javascript/oursprivacy-constants');
  const { OursPrivacyConfig } = require('../javascript/oursprivacy-config');
  jest
    .spyOn(OursPrivacyConfig.prototype, 'getFlushInterval')
    .mockReturnValue(3_600_000);
  return {
    OursPrivacy,
    queue: (token) =>
      OursPrivacyQueueManager.getQueue(token, OursPrivacyType.EVENTS),
  };
}

function appState(initial = 'active') {
  const { AppState } = require('react-native');
  AppState.currentState = initial;
  const listeners = new Set();
  AppState.addEventListener = (_name, handler) => {
    listeners.add(handler);
    return { remove: () => listeners.delete(handler) };
  };
  return async (state) => {
    AppState.currentState = state;
    await Promise.all([...listeners].map((handler) => handler(state)));
  };
}

describe('lifecycle recovery', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('follows a changed default after restart without overriding explicit opt-out', async () => {
    const values = new Map();
    const storage = storageFor(values);
    let { OursPrivacy } = sdk();
    const first = new OursPrivacy();
    await first.init('default-token', {
      storage,
      optOutTrackingByDefault: true,
    });
    expect(first.hasOptedOutTracking()).toBe(true);
    await first.oursprivacyImpl.dispose();

    jest.resetModules();
    ({ OursPrivacy } = sdk());
    const second = new OursPrivacy();
    await second.init('default-token', {
      storage,
      optOutTrackingByDefault: false,
    });
    expect(second.hasOptedOutTracking()).toBe(false);
    await second.optOutTracking();
    await second.oursprivacyImpl.dispose();

    jest.resetModules();
    ({ OursPrivacy } = sdk());
    const third = new OursPrivacy();
    await third.init('default-token', { storage });
    expect(third.hasOptedOutTracking()).toBe(true);
  });

  it('keeps unmarked legacy opt-out closed when the configured default changes', async () => {
    const values = new Map([['OURSPRIVACY_legacy-token_OPT_OUT', 'true']]);
    const storage = storageFor(values);
    const { OursPrivacy } = sdk();
    const op = new OursPrivacy();
    await op.init('legacy-token', { storage, optOutTrackingByDefault: true });
    await op.init('legacy-token', { storage, optOutTrackingByDefault: false });
    expect(op.hasOptedOutTracking()).toBe(true);
  });

  it('keeps a failed explicit opt-out closed when the same instance re-initializes', async () => {
    const values = new Map();
    const storage = storageFor(values);
    const write = storage.setItem;
    let failDecision = false;
    storage.setItem = async (key, value) => {
      if (failDecision && key.endsWith('_OPT_OUT_DECISION_V1')) {
        throw new Error('decision write failed');
      }
      return write(key, value);
    };
    const { OursPrivacy } = sdk();
    const op = new OursPrivacy();
    await op.init('failed-explicit-token', {
      storage,
      optOutTrackingByDefault: true,
    });
    await op.init('failed-explicit-token', { storage });
    expect(op.hasOptedOutTracking()).toBe(false);
    failDecision = true;
    await expect(op.optOutTracking()).rejects.toThrow('decision write failed');
    await op.init('failed-explicit-token', { storage });
    expect(op.hasOptedOutTracking()).toBe(true);
  });

  it('keeps a partial explicit opt-out closed after a process restart', async () => {
    const values = new Map();
    const storage = storageFor(values);
    let { OursPrivacy } = sdk();
    const first = new OursPrivacy();
    await first.init('partial-token', { storage });
    await first.optInTracking();
    await first.track('before-opt-out');
    const write = storage.setItem;
    storage.setItem = async (key, value) => {
      if (key.endsWith('_OPT_OUT_DECISION_V1')) {
        throw new Error('decision write failed');
      }
      return write(key, value);
    };
    await expect(first.optOutTracking()).rejects.toThrow(
      'decision write failed',
    );
    expect(values.get('OURSPRIVACY_partial-token_OPT_OUT')).toBe('true');
    expect(values.get('OURSPRIVACY_partial-token_OPT_OUT_DECISION_V1')).toBe(
      'false',
    );
    await first.oursprivacyImpl.dispose();
    storage.setItem = write;

    jest.resetModules();
    ({ OursPrivacy } = sdk());
    const second = new OursPrivacy();
    await second.init('partial-token', { storage });
    await second.flush();
    expect(second.hasOptedOutTracking()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores mobile tracking when the same instance changes its default to open', async () => {
    appState();
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    const options = {
      storage: storageFor(new Map()),
      trackAutomaticEvents: true,
    };
    await op.init('toggle-token', {
      ...options,
      optOutTrackingByDefault: true,
    });
    await op.init('toggle-token', {
      ...options,
      optOutTrackingByDefault: false,
    });
    await op.trackScreen('Home');
    await op.track('manual');
    expect(op.hasOptedOutTracking()).toBe(false);
    expect(queue('toggle-token').map((event) => event.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
      '$mobile_screen_view',
      'manual',
    ]);
    expect(queue('toggle-token').at(-1).defaultProperties).toEqual(
      expect.objectContaining({
        sid: expect.stringMatching(/^[1-9]\d{12}$/),
      }),
    );
    expect(queue('toggle-token').at(-1).eventProperties).toEqual(
      expect.objectContaining({ mobile_contract_version: 1 }),
    );
  });

  it('does not reuse an earlier foreground timestamp when consent reopens', async () => {
    const signal = appState('background');
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    const options = {
      storage: storageFor(new Map()),
      trackAutomaticEvents: true,
    };
    await op.init('reopen-token', options);
    op.setFlushOnBackground(false);
    await signal('active');
    await op.init('reopen-token', {
      ...options,
      optOutTrackingByDefault: true,
    });
    await jest.advanceTimersByTimeAsync(5_000);
    await op.init('reopen-token', {
      ...options,
      optOutTrackingByDefault: false,
    });
    op.setFlushOnBackground(false);
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('background');
    expect(
      queue('reopen-token')
        .filter((event) => event.event === '$mobile_session_engagement')
        .map((event) => event.eventProperties.engagement_duration_ms),
    ).toEqual([1_000]);
  });

  it('retains first-open eligibility after a fresh background initialization and restart', async () => {
    const values = new Map();
    const storage = storageFor(values);
    appState('background');
    let { OursPrivacy, queue } = sdk();
    const first = new OursPrivacy();
    await first.init('fresh-token', { storage, trackAutomaticEvents: true });
    expect(queue('fresh-token')).toEqual([]);
    await first.oursprivacyImpl.dispose();

    jest.resetModules();
    appState('active');
    ({ OursPrivacy, queue } = sdk());
    const second = new OursPrivacy();
    await second.init('fresh-token', { storage, trackAutomaticEvents: true });
    expect(queue('fresh-token').map((event) => event.event)).toEqual([
      '$mobile_first_open',
      '$mobile_app_open',
      '$mobile_session_start',
    ]);
  });

  it('preserves one foreground open and all screen engagement across re-init', async () => {
    const signal = appState();
    const storage = storageFor(new Map());
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    const options = { storage, trackAutomaticEvents: true };
    await op.init('repeat-token', options);
    op.setFlushOnBackground(false);
    await op.trackScreen('Schedule');
    await jest.advanceTimersByTimeAsync(3_000);
    await op.init('repeat-token', options);
    op.setFlushOnBackground(false);
    await op.trackScreen('Schedule');
    await jest.advanceTimersByTimeAsync(2_000);
    await signal('background');
    const events = queue('repeat-token');
    expect(
      events.filter((event) => event.event === '$mobile_app_open'),
    ).toHaveLength(1);
    expect(
      events.filter((event) => event.event === '$mobile_screen_view'),
    ).toHaveLength(1);
    expect(
      events
        .filter((event) => event.event === '$mobile_session_engagement')
        .map((event) => event.eventProperties),
    ).toEqual([
      expect.objectContaining({
        screen_name: 'Schedule',
        engagement_duration_ms: 5_000,
      }),
    ]);
    await signal('active');
    expect(
      queue('repeat-token').filter(
        (event) => event.event === '$mobile_app_open',
      ),
    ).toHaveLength(2);
  });

  it('does not count changing the source token as a physical foreground entry', async () => {
    appState();
    const storage = storageFor(new Map());
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    const options = { storage, trackAutomaticEvents: true };
    await op.init('before-token', options);
    await op.init('after-token', options);
    expect(
      queue('before-token').filter(
        (event) => event.event === '$mobile_app_open',
      ),
    ).toHaveLength(1);
    expect(queue('after-token').map((event) => event.event)).toEqual([
      '$mobile_first_open',
      '$mobile_session_start',
    ]);
  });

  it('counts foreground time from an active callback while re-init is waiting on storage', async () => {
    const signal = appState();
    const storage = storageFor(new Map());
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    const options = { storage, trackAutomaticEvents: true };
    await op.init('resume-token', options);
    op.setFlushOnBackground(false);
    await op.trackScreen('Home');
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('inactive');
    let release;
    let readStarted = false;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const read = storage.getItem;
    storage.getItem = async (key) => {
      if (key.endsWith('_DEVICE_ID')) {
        readStarted = true;
        await gate;
      }
      return read(key);
    };
    const initializing = op.init('resume-token', options);
    while (!readStarted) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('active');
    await jest.advanceTimersByTimeAsync(5_000);
    release();
    await initializing;
    op.setFlushOnBackground(false);
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('background');
    expect(
      queue('resume-token')
        .filter((event) => event.event === '$mobile_session_engagement')
        .map((event) => event.eventProperties.engagement_duration_ms),
    ).toEqual([1_000, 6_000]);
  });

  it('applies a queued background receipt when re-init disposes its original listener', async () => {
    const signal = appState();
    const storage = storageFor(new Map());
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    const options = { storage, trackAutomaticEvents: true };
    await op.init('queued-background-token', options);
    op.setFlushOnBackground(false);
    let release;
    let writeStarted = false;
    let hold = true;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const write = storage.setItem;
    storage.setItem = async (key, value) => {
      if (hold && key.endsWith('_MOBILE_SESSION_V1')) {
        hold = false;
        writeStarted = true;
        await gate;
      }
      return write(key, value);
    };
    const tracking = op.track('held');
    while (!writeStarted) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_000);
    const background = signal('background');
    const initializing = op.init('queued-background-token', options);
    await jest.advanceTimersByTimeAsync(5_000);
    release();
    await Promise.all([tracking, background, initializing]);
    expect(
      queue('queued-background-token')
        .filter((event) => event.event === '$mobile_session_engagement')
        .map((event) => event.eventProperties.engagement_duration_ms),
    ).toEqual([1_000]);
  });

  it('does not start engagement before a delayed initial-link session exists', async () => {
    const signal = appState('background');
    const storage = storageFor(new Map());
    const { OursPrivacy, queue } = sdk();
    let release;
    let readStarted = false;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const read = storage.getItem;
    storage.getItem = async (key) => {
      if (key.endsWith('_DEVICE_ID')) {
        readStarted = true;
        await gate;
      }
      return read(key);
    };
    const op = new OursPrivacy();
    const initializing = op.init('delayed-link-token', {
      storage,
      trackAutomaticEvents: true,
      initialURL: 'myapp://open?utm_source=demo',
    });
    while (!readStarted) await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('active');
    await jest.advanceTimersByTimeAsync(5_000);
    release();
    await initializing;
    op.setFlushOnBackground(false);
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('background');
    const engagement = queue('delayed-link-token').find(
      (event) => event.event === '$mobile_session_engagement',
    );
    expect(engagement.eventProperties.engagement_duration_ms).toBe(1_000);
    expect(
      Date.parse(engagement.eventProperties.mobile_occurred_at) -
        Number(engagement.defaultProperties.sid),
    ).toBe(1_000);
  });

  it('clears the foreground screen at background so a manual background view is recorded', async () => {
    const signal = appState();
    const { OursPrivacy, queue } = sdk();
    const op = new OursPrivacy();
    await op.init('screen-token', { trackAutomaticEvents: true });
    op.setFlushOnBackground(false);
    await op.trackScreen('Schedule');
    await jest.advanceTimersByTimeAsync(1_000);
    await signal('background');
    await op.trackScreen('Schedule');
    expect(
      queue('screen-token').filter(
        (event) => event.event === '$mobile_screen_view',
      ),
    ).toHaveLength(2);
    await signal('active');
    await op.trackScreen('Schedule');
    expect(
      queue('screen-token').filter(
        (event) => event.event === '$mobile_screen_view',
      ),
    ).toHaveLength(3);
  });
});
