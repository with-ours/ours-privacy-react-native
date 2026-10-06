import { OursPrivacyType } from '@oursprivacy/react-native/javascript/oursprivacy-constants';

jest.mock('@oursprivacy/react-native/javascript/oursprivacy-queue', () => ({
  OursPrivacyQueueManager: {
    initialize: jest.fn(),
    enqueue: jest.fn(),
    getQueue: jest.fn(),
    getResponseMode: jest.fn(),
    setResponseMode: jest.fn(),
    spliceQueue: jest.fn(),
    removeByIds: jest.fn(),
    clearQueue: jest.fn(),
  },
}));

jest.mock(
  '@oursprivacy/react-native/javascript/oursprivacy-persistent',
  () => ({
    OursPrivacyPersistent: {
      getInstance: jest.fn().mockReturnValue({
        getOptedOut: jest.fn(),
      }),
    },
  }),
);

jest.mock('@oursprivacy/react-native/javascript/oursprivacy-network', () => ({
  OursPrivacyNetwork: {
    sendRequest: jest.fn(),
  },
}));

jest.mock('@oursprivacy/react-native/javascript/oursprivacy-config', () => ({
  OursPrivacyConfig: {
    getInstance: jest.fn().mockReturnValue({
      getFlushInterval: jest.fn().mockReturnValue(1000),
      getFlushBatchSize: jest.fn().mockReturnValue(50),
      getServerURL: jest.fn(),
      getIsManuallySetId: jest.fn().mockReturnValue(false),
      getOnIngestRejected: jest.fn(),
    }),
  },
}));

jest.mock('@oursprivacy/react-native/javascript/oursprivacy-logger', () => ({
  OursPrivacyLogger: {
    log: jest.fn(),
    error: jest.fn(),
  },
}));

const {
  OursPrivacyCore,
} = require('@oursprivacy/react-native/javascript/oursprivacy-core');

const {
  OursPrivacyQueueManager,
} = require('@oursprivacy/react-native/javascript/oursprivacy-queue');

const {
  OursPrivacyPersistent,
} = require('@oursprivacy/react-native/javascript/oursprivacy-persistent');

const {
  OursPrivacyNetwork,
} = require('@oursprivacy/react-native/javascript/oursprivacy-network');
const {
  OursPrivacyConfig,
} = require('@oursprivacy/react-native/javascript/oursprivacy-config');
const { Platform } = require('react-native');

describe('OursPrivacyQueueManager', () => {
  const token = 'test-token';
  const type = OursPrivacyType.EVENTS;
  const data = { event: 'testEvent', distinct_id: 'event-1' };

  beforeEach(() => {
    jest.clearAllMocks();
    OursPrivacyNetwork.sendRequest.mockReset();
    OursPrivacyQueueManager.removeByIds.mockReset();
    OursPrivacyQueueManager.getQueue.mockReset();
    OursPrivacyQueueManager.getResponseMode.mockReset().mockReturnValue(null);
    OursPrivacyQueueManager.setResponseMode.mockReset();
    Platform.OS = 'ios';
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReset();
    OursPrivacyConfig.getInstance()
      .getFlushBatchSize.mockReset()
      .mockReturnValue(50);
    jest.isolateModules(() => {
      OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValue(false);
      OursPrivacyQueueManager.getQueue.mockReturnValue([]);
    });
  });

  it('initializes the OursPrivacy queue for events', async () => {
    await OursPrivacyCore().initialize(token);
    expect(OursPrivacyQueueManager.initialize).toHaveBeenCalledWith(
      token,
      expect.any(String),
    );
  });

  it('adds data to the OursPrivacy queue if not opted out and data is valid', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    await OursPrivacyCore().addToOursPrivacyQueue(token, type, data);
    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledWith(
      token,
      type,
      expect.any(Object),
    );
  });

  it('do not add data to the OursPrivacy queue if opted out', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(true);
    await OursPrivacyCore().addToOursPrivacyQueue(token, type, data);
    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledTimes(0);
  });

  it('do not add data to the OursPrivacy queue if data is not valid', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    // mock JSON.stringify to throw an error
    jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('mock error');
    });
    await OursPrivacyCore().addToOursPrivacyQueue(token, type, data);
    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledTimes(0);
  });

  it('flushes the queue', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    OursPrivacyQueueManager.getQueue
      .mockReturnValueOnce([data])
      .mockReturnValue([]);
    OursPrivacyNetwork.sendRequest.mockResolvedValue({
      success: true,
      accepted: 1,
      rejected: [],
    });
    await OursPrivacyCore().flush(token);
    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalled();
    expect(OursPrivacyQueueManager.removeByIds).toHaveBeenCalledWith(
      token,
      type,
      ['event-1'],
      'indexed',
    );
  });

  it('do not flush the queue if opted out', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(true);
    OursPrivacyQueueManager.getQueue.mockImplementation(() => {
      return [data];
    });
    await OursPrivacyCore().flush(token);
    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalledTimes(0);
  });

  it('not flushes the queue if there is no data', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    OursPrivacyQueueManager.getQueue.mockImplementation(() => {
      return [];
    });
    await OursPrivacyCore().flush(token);
    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalledTimes(0);
  });

  it('passes isManuallySetId from config to sendRequest', async () => {
    const {
      OursPrivacyConfig,
    } = require('@oursprivacy/react-native/javascript/oursprivacy-config');
    OursPrivacyConfig.getInstance().getIsManuallySetId.mockReturnValueOnce(
      true,
    );
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    OursPrivacyQueueManager.getQueue
      .mockReturnValueOnce([data])
      .mockReturnValue([]);
    OursPrivacyNetwork.sendRequest.mockResolvedValue({
      success: true,
      accepted: 1,
      rejected: [],
    });

    await OursPrivacyCore().flush(token);

    expect(OursPrivacyNetwork.sendRequest).toHaveBeenCalledWith(
      expect.objectContaining({ isManuallySetId: true }),
    );
  });

  it('enqueues event data without adding session metadata', async () => {
    OursPrivacyPersistent.getInstance().getOptedOut.mockReturnValueOnce(false);
    const eventData = {
      event: 'Purchase',
      visitor_id: 'uuid-123',
      distinct_id: 'per-event-uuid',
      eventProperties: { price: 99 },
      userProperties: null,
      defaultProperties: { device_type: 'mobile' },
    };

    await OursPrivacyCore().addToOursPrivacyQueue(token, type, eventData);

    expect(OursPrivacyQueueManager.enqueue).toHaveBeenCalledWith(
      token,
      type,
      eventData,
    );
  });

  const queueBatch = (items) => {
    let queued = [...items];
    let responseMode = null;
    OursPrivacyQueueManager.getQueue.mockImplementation(() => [...queued]);
    OursPrivacyQueueManager.getResponseMode.mockImplementation(
      () => responseMode,
    );
    OursPrivacyQueueManager.setResponseMode.mockImplementation(
      async (_token, _type, mode) => {
        if (mode === 'indexed') responseMode = 'indexed';
      },
    );
    OursPrivacyQueueManager.removeByIds.mockImplementation(
      async (_token, _type, ids, mode) => {
        queued = queued.filter((item) => !ids.includes(item.distinct_id));
        responseMode =
          responseMode === 'indexed' || mode === 'indexed'
            ? 'indexed'
            : mode || responseMode;
      },
    );
    return () => queued;
  };

  it('reports a mixed rejection once after removing only the sent IDs', async () => {
    const remaining = queueBatch([
      { event: 'appointment_booked', distinct_id: 'bad-event-id' },
      { event: 'purchase', distinct_id: 'good-event-id' },
      { event: 'later', distinct_id: 'later-event-id' },
    ]);
    OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValueOnce(2);
    const onIngestRejected = jest.fn();
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest
      .mockResolvedValueOnce({
        success: true,
        visitor_id: 'v1',
        accepted: 1,
        rejected: [{ index: 0, code: 'mobile_occurred_at_future' }],
      })
      .mockRejectedValueOnce(new Error('offline'));

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([
      { event: 'later', distinct_id: 'later-event-id' },
    ]);
    expect(onIngestRejected).toHaveBeenCalledTimes(1);
    expect(onIngestRejected).toHaveBeenCalledWith({
      distinctId: 'bad-event-id',
      code: 'mobile_occurred_at_future',
    });
    expect(OursPrivacyQueueManager.removeByIds).toHaveBeenCalledWith(
      token,
      type,
      ['bad-event-id', 'good-event-id'],
      'indexed',
    );

    await OursPrivacyCore().flush(token);
    expect(onIngestRejected).toHaveBeenCalledTimes(1);
  });

  it('reports every item in an all-rejected batch', async () => {
    const remaining = queueBatch([
      { event: 'first', distinct_id: 'id-1' },
      { event: 'second', distinct_id: 'id-2' },
    ]);
    const onIngestRejected = jest.fn();
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
      success: true,
      visitor_id: 'v1',
      accepted: 0,
      rejected: [
        { index: 1, code: 'invalid_session' },
        { index: 0, code: 'mobile_occurred_at_future' },
      ],
    });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([]);
    expect(onIngestRejected.mock.calls).toEqual([
      [{ distinctId: 'id-2', code: 'invalid_session' }],
      [{ distinctId: 'id-1', code: 'mobile_occurred_at_future' }],
    ]);
  });

  it.each([
    ['success false', { success: false, accepted: 1, rejected: [] }],
    ['missing success', { accepted: 1, rejected: [] }],
    ['missing accepted', { success: true, rejected: [] }],
    ['missing rejected', { success: true, accepted: 1 }],
    ['negative accepted', { success: true, accepted: -1, rejected: [] }],
    ['fractional accepted', { success: true, accepted: 0.5, rejected: [] }],
    [
      'duplicate index',
      {
        success: true,
        accepted: 0,
        rejected: [
          { index: 0, code: 'invalid' },
          { index: 0, code: 'invalid' },
        ],
      },
    ],
    [
      'out-of-range index',
      {
        success: true,
        accepted: 0,
        rejected: [{ index: 1, code: 'invalid' }],
      },
    ],
    [
      'fractional index',
      {
        success: true,
        accepted: 0,
        rejected: [{ index: 0.5, code: 'invalid' }],
      },
    ],
    [
      'missing code',
      {
        success: true,
        accepted: 0,
        rejected: [{ index: 0 }],
      },
    ],
    ['mismatched count', { success: true, accepted: 0, rejected: [] }],
  ])('retains the batch for a %s indexed response', async (_name, response) => {
    const remaining = queueBatch([
      { event: 'appointment_booked', distinct_id: 'id-1' },
    ]);
    const onIngestRejected = jest.fn();
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest.mockResolvedValue(response);

    await OursPrivacyCore().flush(token);

    expect(remaining()).toHaveLength(1);
    expect(OursPrivacyQueueManager.removeByIds).not.toHaveBeenCalled();
    expect(onIngestRejected).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'])(
    'acknowledges a legacy token response on %s',
    async (platform) => {
      Platform.OS = platform;
      const remaining = queueBatch([
        { event: 'appointment_booked', distinct_id: 'id-1' },
      ]);
      const onIngestRejected = jest.fn();
      OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
        onIngestRejected,
      );
      OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
        success: true,
        visitor_id: 'v1',
      });

      await OursPrivacyCore().flush(token);

      expect(remaining()).toEqual([]);
      expect(onIngestRejected).not.toHaveBeenCalled();
    },
  );

  it('reports an indexed rejection on web after queue removal', async () => {
    Platform.OS = 'web';
    const remaining = queueBatch([
      { event: 'appointment_booked', distinct_id: 'id-1' },
    ]);
    const onIngestRejected = jest.fn(() => expect(remaining()).toEqual([]));
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
      success: true,
      visitor_id: 'v1',
      accepted: 0,
      rejected: [{ index: 0, code: 'invalid_session' }],
    });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([]);
    expect(onIngestRejected).toHaveBeenCalledWith({
      distinctId: 'id-1',
      code: 'invalid_session',
    });
  });

  it('retains a partial indexed result on web', async () => {
    Platform.OS = 'web';
    const remaining = queueBatch([
      { event: 'appointment_booked', distinct_id: 'id-1' },
    ]);
    const onIngestRejected = jest.fn();
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
      success: true,
      accepted: 1,
    });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toHaveLength(1);
    expect(onIngestRejected).not.toHaveBeenCalled();
  });

  it('retains a no-index response with success false', async () => {
    Platform.OS = 'web';
    const remaining = queueBatch([data]);
    OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
      success: false,
    });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([data]);
  });

  it.each(['ios', 'android', 'web'])(
    'retains an incomplete legacy response on %s',
    async (platform) => {
      Platform.OS = platform;
      const remaining = queueBatch([
        { event: 'appointment_booked', distinct_id: 'id-1' },
      ]);
      OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({ success: true });

      await OursPrivacyCore().flush(token);

      expect(remaining()).toEqual([
        { event: 'appointment_booked', distinct_id: 'id-1' },
      ]);
      expect(OursPrivacyQueueManager.removeByIds).not.toHaveBeenCalled();
    },
  );

  it.each([null, 42])(
    'retains a legacy response with non-string visitor_id %s',
    async (visitor_id) => {
      Platform.OS = 'web';
      const remaining = queueBatch([data]);
      OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
        success: true,
        visitor_id,
      });

      await OursPrivacyCore().flush(token);

      expect(remaining()).toEqual([data]);
    },
  );

  it.each(['ios', 'web'])(
    'retains a no-index HTTP 200 after indexed mode on %s',
    async (platform) => {
      Platform.OS = platform;
      const remaining = queueBatch([
        { event: 'first', distinct_id: 'id-1' },
        { event: 'appointment_booked', distinct_id: 'id-2' },
      ]);
      OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValue(1);
      const onIngestRejected = jest.fn();
      OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
        onIngestRejected,
      );
      OursPrivacyNetwork.sendRequest
        .mockResolvedValueOnce({
          success: true,
          accepted: 1,
          rejected: [],
        })
        .mockResolvedValueOnce({ success: true, visitor_id: 'v1' });

      await OursPrivacyCore().flush(token);

      expect(remaining()).toEqual([
        { event: 'appointment_booked', distinct_id: 'id-2' },
      ]);
      expect(onIngestRejected).not.toHaveBeenCalled();
      expect(OursPrivacyQueueManager.removeByIds.mock.calls).toEqual([
        [token, type, ['id-1'], 'indexed'],
      ]);
    },
  );

  it('keeps a mobile batch on transport failure', async () => {
    const remaining = queueBatch([data]);
    OursPrivacyNetwork.sendRequest.mockRejectedValueOnce(new Error('offline'));

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([data]);
    expect(OursPrivacyQueueManager.removeByIds).not.toHaveBeenCalled();
  });

  it.each(['ios', 'web'])(
    'retains an event after HTTP 400 before source mode is known on %s',
    async (platform) => {
      Platform.OS = platform;
      const remaining = queueBatch([
        { event: 'appointment_booked', distinct_id: 'id-1' },
      ]);
      OursPrivacyNetwork.sendRequest.mockRejectedValueOnce({ code: 400 });

      await OursPrivacyCore().flush(token);

      expect(remaining()).toHaveLength(1);
      expect(OursPrivacyQueueManager.removeByIds).not.toHaveBeenCalled();
    },
  );

  it.each(['ios', 'web'])(
    'uses legacy HTTP 400 removal on %s only after a legacy response',
    async (platform) => {
      Platform.OS = platform;
      const remaining = queueBatch([
        { event: 'first', distinct_id: 'id-1' },
        { event: '$mobile_app_open', distinct_id: 'id-2' },
        { event: 'third', distinct_id: 'id-3' },
      ]);
      OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValue(1);
      OursPrivacyNetwork.sendRequest
        .mockResolvedValueOnce({ success: true, visitor_id: 'v1' })
        .mockRejectedValueOnce({ code: 400 })
        .mockResolvedValueOnce({ success: true, visitor_id: 'v1' });

      await OursPrivacyCore().flush(token);

      expect(remaining()).toEqual([]);
      expect(OursPrivacyQueueManager.removeByIds.mock.calls).toEqual([
        [token, type, ['id-1'], 'legacy'],
        [token, type, ['id-2']],
        [token, type, ['id-3'], 'legacy'],
      ]);
    },
  );

  it('retains HTTP 400 after a web token has produced an indexed result', async () => {
    Platform.OS = 'web';
    const remaining = queueBatch([
      { event: 'first', distinct_id: 'id-1' },
      { event: 'appointment_booked', distinct_id: 'id-2' },
    ]);
    OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValue(1);
    OursPrivacyNetwork.sendRequest
      .mockResolvedValueOnce({
        success: true,
        accepted: 1,
        rejected: [],
      })
      .mockRejectedValueOnce({ code: 400 });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([
      { event: 'appointment_booked', distinct_id: 'id-2' },
    ]);
    expect(OursPrivacyQueueManager.removeByIds.mock.calls).toEqual([
      [token, type, ['id-1'], 'indexed'],
    ]);
  });

  it('does not restore legacy HTTP 400 removal after an indexed response', async () => {
    const remaining = queueBatch([
      { event: 'first', distinct_id: 'id-1' },
      { event: 'second', distinct_id: 'id-2' },
      { event: 'third', distinct_id: 'id-3' },
      { event: 'appointment_booked', distinct_id: 'id-4' },
    ]);
    OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValue(1);
    OursPrivacyNetwork.sendRequest
      .mockResolvedValueOnce({ success: true, visitor_id: 'v1' })
      .mockResolvedValueOnce({ success: true, accepted: 1, rejected: [] })
      .mockResolvedValueOnce({ success: true, visitor_id: 'v1' });
    const core = OursPrivacyCore();

    await core.flush(token);
    expect(remaining()).toEqual([
      { event: 'third', distinct_id: 'id-3' },
      { event: 'appointment_booked', distinct_id: 'id-4' },
    ]);
    OursPrivacyNetwork.sendRequest.mockRejectedValueOnce({ code: 400 });
    await core.flush(token);

    expect(remaining()).toEqual([
      { event: 'third', distinct_id: 'id-3' },
      { event: 'appointment_booked', distinct_id: 'id-4' },
    ]);
  });

  it('retains HTTP 400 after a partial indexed response follows legacy mode', async () => {
    Platform.OS = 'web';
    const remaining = queueBatch([
      { event: 'first', distinct_id: 'id-1' },
      { event: 'appointment_booked', distinct_id: 'id-2' },
    ]);
    OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValue(1);
    OursPrivacyNetwork.sendRequest
      .mockResolvedValueOnce({ success: true, visitor_id: 'v1' })
      .mockResolvedValueOnce({ success: true, accepted: 1 })
      .mockRejectedValueOnce({ code: 400 });
    const core = OursPrivacyCore();

    await core.flush(token);
    expect(remaining()).toEqual([
      { event: 'appointment_booked', distinct_id: 'id-2' },
    ]);

    await core.flush(token);
    expect(remaining()).toEqual([
      { event: 'appointment_booked', distinct_id: 'id-2' },
    ]);
    expect(OursPrivacyQueueManager.removeByIds).toHaveBeenCalledTimes(1);
  });

  it('does not apply one token’s legacy HTTP 400 behavior to another token', async () => {
    Platform.OS = 'web';
    const queues = new Map([
      ['legacy-token', [{ event: 'first', distinct_id: 'id-1' }]],
      ['unknown-token', [{ event: 'appointment_booked', distinct_id: 'id-2' }]],
    ]);
    OursPrivacyQueueManager.getQueue.mockImplementation((queueToken) => [
      ...queues.get(queueToken),
    ]);
    OursPrivacyQueueManager.removeByIds.mockImplementation(
      async (queueToken, _type, ids) => {
        queues.set(
          queueToken,
          queues
            .get(queueToken)
            .filter((item) => !ids.includes(item.distinct_id)),
        );
      },
    );
    OursPrivacyNetwork.sendRequest
      .mockResolvedValueOnce({ success: true, visitor_id: 'v1' })
      .mockRejectedValueOnce({ code: 400 });
    const core = OursPrivacyCore();

    await core.flush('legacy-token');
    await core.flush('unknown-token');

    expect(queues.get('legacy-token')).toEqual([]);
    expect(queues.get('unknown-token')).toEqual([
      { event: 'appointment_booked', distinct_id: 'id-2' },
    ]);
  });

  it('waits for durable removal before reporting a rejection', async () => {
    const remaining = queueBatch([data]);
    const onIngestRejected = jest.fn();
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest.mockResolvedValue({
      success: true,
      accepted: 0,
      rejected: [{ index: 0, code: 'invalid_session' }],
    });
    OursPrivacyQueueManager.removeByIds.mockRejectedValueOnce(
      new Error('write failed'),
    );

    await OursPrivacyCore().flush(token);
    expect(remaining()).toEqual([data]);
    expect(onIngestRejected).not.toHaveBeenCalled();

    await OursPrivacyCore().flush(token);
    expect(remaining()).toEqual([]);
    expect(onIngestRejected).toHaveBeenCalledTimes(1);
    expect(onIngestRejected).toHaveBeenCalledWith({
      distinctId: 'event-1',
      code: 'invalid_session',
    });
  });

  it('continues reporting acknowledged rejections when a callback throws', async () => {
    const remaining = queueBatch([
      { event: 'first', distinct_id: 'id-1' },
      { event: 'second', distinct_id: 'id-2' },
    ]);
    const onIngestRejected = jest.fn().mockImplementationOnce(() => {
      throw new Error('host callback failed');
    });
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      onIngestRejected,
    );
    OursPrivacyNetwork.sendRequest.mockResolvedValueOnce({
      success: true,
      accepted: 0,
      rejected: [
        { index: 0, code: 'invalid_session' },
        { index: 1, code: 'invalid_timestamp' },
      ],
    });

    await OursPrivacyCore().flush(token);
    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([]);
    expect(onIngestRejected.mock.calls).toEqual([
      [{ distinctId: 'id-1', code: 'invalid_session' }],
      [{ distinctId: 'id-2', code: 'invalid_timestamp' }],
    ]);
  });
});
