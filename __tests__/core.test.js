import { OursPrivacyType } from '@oursprivacy/react-native/javascript/oursprivacy-constants';

jest.mock('@oursprivacy/react-native/javascript/oursprivacy-queue', () => ({
  OursPrivacyQueueManager: {
    initialize: jest.fn(),
    enqueue: jest.fn(),
    getQueue: jest.fn(),
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
    Platform.OS = 'ios';
    OursPrivacyConfig.getInstance().getOnIngestRejected.mockReturnValue(
      undefined,
    );
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
    OursPrivacyQueueManager.getQueue.mockImplementation(() => [...queued]);
    OursPrivacyQueueManager.removeByIds.mockImplementation(
      async (_token, _type, ids) => {
        queued = queued.filter((item) => !ids.includes(item.distinct_id));
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
    ['no-index mobile response', { success: true, visitor_id: 'v1' }],
  ])('retains the mobile batch for a %s response', async (_name, response) => {
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

  it('keeps a mobile batch on transport failure', async () => {
    const remaining = queueBatch([data]);
    OursPrivacyNetwork.sendRequest.mockRejectedValueOnce(new Error('offline'));

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([data]);
    expect(OursPrivacyQueueManager.removeByIds).not.toHaveBeenCalled();
  });

  it('does not drop a mobile event after HTTP 400 even if its name looks ordinary', async () => {
    const remaining = queueBatch([
      { event: 'appointment_booked', distinct_id: 'id-1' },
    ]);
    OursPrivacyNetwork.sendRequest.mockRejectedValueOnce({ code: 400 });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toHaveLength(1);
    expect(OursPrivacyQueueManager.removeByIds).not.toHaveBeenCalled();
  });

  it('preserves no-index acknowledgement and HTTP 400 behavior on web', async () => {
    Platform.OS = 'web';
    const remaining = queueBatch([
      { event: '$mobile_app_open', distinct_id: 'id-1' },
      { event: 'later', distinct_id: 'id-2' },
    ]);
    OursPrivacyConfig.getInstance().getFlushBatchSize.mockReturnValueOnce(1);
    OursPrivacyNetwork.sendRequest
      .mockRejectedValueOnce({ code: 400 })
      .mockResolvedValueOnce({ success: true, visitor_id: 'v1' });

    await OursPrivacyCore().flush(token);

    expect(remaining()).toEqual([]);
    expect(OursPrivacyQueueManager.removeByIds.mock.calls).toEqual([
      [token, type, ['id-1']],
      [token, type, ['id-2']],
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
