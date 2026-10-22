import fetchMock from 'jest-fetch-mock';

jest.unmock('../javascript/oursprivacy-storage');

fetchMock.enableMocks();

const token = 'upload-token';
const type = '/ingest';
const queueKey = 'OURSPRIVACY_upload-token_/ingest_QUEUE';
const firstEvent = {
  event: 'appointment_booked',
  distinct_id: 'first-event',
  visitor_id: 'visitor-1',
  isManuallySetId: false,
  eventProperties: {
    mobile_contract_version: 1,
    mobile_occurred_at: '2026-10-05T12:00:00.000Z',
  },
  userProperties: null,
  defaultProperties: { sid: '1791201600000', os_name: 'iOS' },
};

const createStorage = () => {
  const values = new Map();
  const faults = { failQueueWrites: false };
  return {
    values,
    faults,
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      if (key === queueKey && faults.failQueueWrites) {
        throw new Error('Queue write failed');
      }
      values.set(key, value);
    },
    removeItem: async (key) => values.delete(key),
  };
};

const deferred = () => {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
};

const startCore = async (storage = createStorage(), items = [firstEvent]) => {
  const { OursPrivacyCore } = require('../javascript/oursprivacy-core');
  const { OursPrivacyConfig } = require('../javascript/oursprivacy-config');
  const {
    OursPrivacyPersistent,
  } = require('../javascript/oursprivacy-persistent');
  const {
    OursPrivacyQueueManager,
  } = require('../javascript/oursprivacy-queue');
  const core = OursPrivacyCore(storage);
  const persistent = OursPrivacyPersistent.getInstance();
  const config = OursPrivacyConfig.getInstance();
  const savedItems = () => JSON.parse(storage.values.get(queueKey) ?? '[]');
  const rejected = jest.fn();
  const removalSnapshots = [];
  config.setServerURL(token, 'https://upload.example.test');
  config.setOnIngestRejected(token, (result) => {
    removalSnapshots.push(savedItems());
    rejected(result);
  });
  await persistent.initializationCompletePromise(token);
  await core.initialize(token);
  for (const item of items) {
    await core.addToOursPrivacyQueue(token, type, item);
  }
  return {
    core,
    config,
    persistent,
    storage,
    savedItems,
    rejected,
    removalSnapshots,
    queuedItems: () => OursPrivacyQueueManager.getQueue(token, type),
    responseMode: () => OursPrivacyQueueManager.getResponseMode(token, type),
  };
};

describe('upload response recovery through the real core and fetch boundary', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    fetchMock.resetMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    fetchMock.resetMocks();
  });

  it('retains HTML 200 until the fifth flush, then durably rejects the head', async () => {
    const harness = await startCore();
    fetchMock.mockResponse('<html>upstream error</html>', { status: 200 });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await harness.core.flush(token);
      expect(fetchMock).toHaveBeenCalledTimes(attempt);
      expect(harness.queuedItems()).toEqual([firstEvent]);
      expect(harness.savedItems()).toEqual([firstEvent]);
      expect(harness.rejected).not.toHaveBeenCalled();
    }

    await harness.core.flush(token);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(
      fetchMock.mock.calls.map(([, options]) =>
        JSON.parse(options.body).data.map((item) => item.distinct_id),
      ),
    ).toEqual(Array(5).fill(['first-event']));
    expect(harness.queuedItems()).toEqual([]);
    expect(harness.savedItems()).toEqual([]);
    expect(harness.rejected.mock.calls).toEqual([
      [{ distinctId: 'first-event', code: 'invalid_acknowledgment' }],
    ]);
    expect(harness.removalSnapshots).toEqual([[]]);
  });

  it('retains HTTP 403 beyond five flushes while using the existing network backoff', async () => {
    const harness = await startCore();
    fetchMock.mockResponse('<html>forbidden</html>', { status: 403 });

    for (let flush = 1; flush <= 6; flush += 1) {
      const pending = harness.core.flush(token);
      await jest.advanceTimersByTimeAsync(62000);
      await pending;

      expect(harness.queuedItems()).toEqual([firstEvent]);
      expect(harness.savedItems()).toEqual([firstEvent]);
      expect(harness.rejected).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(flush * 6);
    }
  });

  it.each([
    ['truncated JSON', '{"success":'],
    ['null', 'null'],
    ['array', '[]'],
    ['string', '"accepted"'],
    ['number', '42'],
    ['boolean', 'true'],
    ['whitespace', ' \n\t'],
    ['incomplete indexed object', '{"success":true,"accepted":1}'],
  ])('caps invalid acknowledgment for a %s body', async (_name, body) => {
    const harness = await startCore();
    fetchMock.mockResponse(body, { status: 200 });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await harness.core.flush(token);
      expect(harness.savedItems()).toEqual([firstEvent]);
      expect(harness.queuedItems()).toEqual([firstEvent]);
      expect(harness.rejected).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(attempt);
    }
    await harness.core.flush(token);

    expect(harness.savedItems()).toEqual([]);
    expect(harness.queuedItems()).toEqual([]);
    expect(harness.rejected.mock.calls).toEqual([
      [{ distinctId: 'first-event', code: 'invalid_acknowledgment' }],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it.each([
    ['empty HTTP 200', '', 200],
    ['empty HTTP 204', null, 204],
    ['empty object', '{}', 200],
    ['unknown keys without visitor acknowledgment', '{"future_field":42}', 200],
    ['success without visitor acknowledgment', '{"success":true}', 200],
  ])(
    'durably acknowledges a compatible %s response',
    async (_name, body, status) => {
      const harness = await startCore();
      fetchMock.mockResponseOnce(body, { status });

      await harness.core.flush(token);

      expect(harness.savedItems()).toEqual([]);
      expect(harness.queuedItems()).toEqual([]);
      expect(harness.responseMode()).toBe('legacy');
      expect(harness.rejected).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves indexed acknowledgments and reports only rejected IDs after durable removal', async () => {
    const secondEvent = { ...firstEvent, distinct_id: 'second-event' };
    const harness = await startCore(createStorage(), [firstEvent, secondEvent]);
    fetchMock.mockResponseOnce(
      '{"success":true,"accepted":1,"rejected":[{"index":1,"code":"invalid_session"}],"future_field":42}',
      { status: 200 },
    );

    await harness.core.flush(token);

    expect(harness.savedItems()).toEqual([]);
    expect(harness.queuedItems()).toEqual([]);
    expect(harness.responseMode()).toBe('indexed');
    expect(harness.rejected.mock.calls).toEqual([
      [{ distinctId: 'second-event', code: 'invalid_session' }],
    ]);
    expect(harness.removalSnapshots).toEqual([[]]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the malformed cap on the same head as its batch grows and gives the next head five attempts', async () => {
    const appendedEvent = { ...firstEvent, distinct_id: 'appended-event' };
    const nextEvent = {
      ...firstEvent,
      distinct_id: 'next-event',
      visitor_id: 'visitor-2',
    };
    const harness = await startCore();
    fetchMock.mockResponse('<html>upstream error</html>', { status: 200 });
    await harness.core.flush(token);
    await harness.core.addToOursPrivacyQueue(token, type, appendedEvent);
    await harness.core.addToOursPrivacyQueue(token, type, nextEvent);

    for (let attempt = 2; attempt <= 4; attempt += 1) {
      await harness.core.flush(token);
      expect(harness.savedItems()).toEqual([
        firstEvent,
        appendedEvent,
        nextEvent,
      ]);
      expect(harness.rejected).not.toHaveBeenCalled();
    }
    await harness.core.flush(token);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(harness.savedItems()).toEqual([nextEvent]);
    expect(harness.queuedItems()).toEqual([nextEvent]);
    expect(harness.rejected.mock.calls).toEqual([
      [{ distinctId: 'first-event', code: 'invalid_acknowledgment' }],
      [{ distinctId: 'appended-event', code: 'invalid_acknowledgment' }],
    ]);
    expect(harness.removalSnapshots).toEqual([[nextEvent], [nextEvent]]);

    for (let attempt = 2; attempt <= 4; attempt += 1) {
      await harness.core.flush(token);
      expect(harness.savedItems()).toEqual([nextEvent]);
      expect(harness.rejected).toHaveBeenCalledTimes(2);
    }
    await harness.core.flush(token);

    expect(harness.savedItems()).toEqual([]);
    expect(harness.queuedItems()).toEqual([]);
    expect(harness.rejected.mock.calls).toEqual([
      [{ distinctId: 'first-event', code: 'invalid_acknowledgment' }],
      [{ distinctId: 'appended-event', code: 'invalid_acknowledgment' }],
      [{ distinctId: 'next-event', code: 'invalid_acknowledgment' }],
    ]);
    expect(
      fetchMock.mock.calls.map(([, options]) =>
        JSON.parse(options.body).data.map((item) => item.distinct_id),
      ),
    ).toEqual([
      ['first-event'],
      ...Array(4).fill(['first-event', 'appended-event']),
      ...Array(5).fill(['next-event']),
    ]);
  });

  it('retains rows without callbacks when capped removal fails and recovers them after restart', async () => {
    const harness = await startCore();
    fetchMock.mockResponse('<html>upstream error</html>', { status: 200 });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await harness.core.flush(token);
    }
    harness.storage.faults.failQueueWrites = true;
    await harness.core.flush(token);
    await harness.core.flush(token);

    expect(harness.savedItems()).toEqual([firstEvent]);
    expect(harness.queuedItems()).toEqual([firstEvent]);
    expect(harness.rejected).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(6);

    harness.core.stopProcessingQueue();
    jest.resetModules();
    harness.storage.faults.failQueueWrites = false;
    const restarted = await startCore(harness.storage, []);
    expect(restarted.queuedItems()).toEqual([firstEvent]);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await restarted.core.flush(token);
      expect(restarted.savedItems()).toEqual([firstEvent]);
      expect(restarted.rejected).not.toHaveBeenCalled();
    }
    await restarted.core.flush(token);

    expect(restarted.savedItems()).toEqual([]);
    expect(restarted.queuedItems()).toEqual([]);
    expect(restarted.rejected.mock.calls).toEqual([
      [{ distinctId: 'first-event', code: 'invalid_acknowledgment' }],
    ]);
    expect(restarted.removalSnapshots).toEqual([[]]);
    expect(harness.rejected).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('does not charge HTTP 403 backoff attempts against a nearly capped malformed head', async () => {
    const harness = await startCore();
    fetchMock.mockResponse('<html>upstream error</html>', { status: 200 });
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await harness.core.flush(token);
    }
    fetchMock.mockResponse('<html>forbidden</html>', { status: 403 });
    const pending = harness.core.flush(token);
    await jest.advanceTimersByTimeAsync(62000);
    await pending;

    expect(harness.savedItems()).toEqual([firstEvent]);
    expect(harness.queuedItems()).toEqual([firstEvent]);
    expect(harness.rejected).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(10);

    fetchMock.mockResponse('<html>upstream error</html>', { status: 200 });
    await harness.core.flush(token);

    expect(harness.savedItems()).toEqual([]);
    expect(harness.rejected.mock.calls).toEqual([
      [{ distinctId: 'first-event', code: 'invalid_acknowledgment' }],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it.each([
    [
      'indexed rejection',
      '{"success":true,"accepted":0,"rejected":[{"index":0,"code":"invalid_session"}]}',
    ],
    ['malformed acknowledgment', '<html>upstream error</html>'],
  ])(
    'cancels a pending %s body on opt-out without removal or callbacks',
    async (_name, body) => {
      const harness = await startCore();
      const readingBody = deferred();
      const releaseBody = deferred();
      let signal;
      fetchMock.mockImplementationOnce(async (_url, options) => {
        signal = options.signal;
        const response = new fetchMock.Response(body, { status: 200 });
        const readText = response.text.bind(response);
        response.text = async () => {
          readingBody.resolve();
          await releaseBody.promise;
          return readText();
        };
        return response;
      });
      const pending = harness.core.flush(token);
      await readingBody.promise;
      harness.persistent.updateOptedOut(token, true);
      harness.core.cancelPendingUploads(token);
      await harness.persistent.persistOptedOut(token);
      releaseBody.resolve();
      await pending;
      await harness.core.flush(token);

      expect(signal.aborted).toBe(true);
      expect(harness.savedItems()).toEqual([firstEvent]);
      expect(harness.queuedItems()).toEqual([firstEvent]);
      expect(harness.rejected).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('cancels HTTP 403 backoff on opt-out without retrying or reporting rejection', async () => {
    const harness = await startCore();
    fetchMock.mockResponse('<html>forbidden</html>', { status: 403 });
    const pending = harness.core.flush(token);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];

    harness.persistent.updateOptedOut(token, true);
    harness.core.cancelPendingUploads(token);
    await harness.persistent.persistOptedOut(token);
    await pending;
    await jest.advanceTimersByTimeAsync(62000);
    await harness.core.flush(token);

    expect(options.signal.aborted).toBe(true);
    expect(harness.savedItems()).toEqual([firstEvent]);
    expect(harness.queuedItems()).toEqual([firstEvent]);
    expect(harness.rejected).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
