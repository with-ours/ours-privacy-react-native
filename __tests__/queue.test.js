import { OursPrivacyType } from '@oursprivacy/react-native/javascript/oursprivacy-constants';

jest.mock(
  '@oursprivacy/react-native/javascript/oursprivacy-persistent',
  () => ({
    OursPrivacyPersistent: {
      getInstance: jest.fn().mockReturnValue({
        loadQueue: jest.fn().mockResolvedValue([]),
        saveQueue: jest.fn(),
      }),
    },
  }),
);

describe('OursPrivacyQueueManager', () => {
  let OursPrivacyQueueManager;
  let oursprivacyPersistent;
  let token = 'testToken';
  let type = OursPrivacyType.EVENTS;

  beforeEach(() => {
    jest.isolateModules(async () => {
      OursPrivacyQueueManager =
        require('@oursprivacy/react-native/javascript/oursprivacy-queue').OursPrivacyQueueManager;
      const OursPrivacyPersistent =
        require('@oursprivacy/react-native/javascript/oursprivacy-persistent').OursPrivacyPersistent;
      oursprivacyPersistent = OursPrivacyPersistent.getInstance();
      await OursPrivacyQueueManager.clearQueue(token, type);
    });
  });

  it('initializes the queue correctly', async () => {
    await OursPrivacyQueueManager.initialize(token, type);
    expect(OursPrivacyQueueManager.getQueue(token, type)).toEqual([]);
  });

  it('enqueue adds data to the queue and updates storage', async () => {
    const data = { test: 'data' };

    await OursPrivacyQueueManager.initialize(token, type);
    await OursPrivacyQueueManager.enqueue(token, type, data);

    expect(oursprivacyPersistent.saveQueue).toHaveBeenCalledWith(
      token,
      type,
      expect.objectContaining({ items: expect.any(Array) }),
    );
  });

  it('splices the queue correctly', async () => {
    await OursPrivacyQueueManager.enqueue(token, type, { data: 'sample1' });
    await OursPrivacyQueueManager.enqueue(token, type, { data: 'sample2' });

    await OursPrivacyQueueManager.spliceQueue(token, type, 0, 1);

    const queue = OursPrivacyQueueManager.getQueue(token, type);
    expect(queue.length).toBe(1);
    expect(queue).toEqual([{ data: 'sample2' }]);
  });

  it('clears the queue correctly', async () => {
    await OursPrivacyQueueManager.enqueue(token, type, { data: 'sample' });
    await OursPrivacyQueueManager.clearQueue(token, type);

    const queue = OursPrivacyQueueManager.getQueue(token, type);
    expect(queue).toEqual([]);
  });

  it('keeps indexed response mode with acknowledged removal and reload', async () => {
    await OursPrivacyQueueManager.initialize(token, type);
    await OursPrivacyQueueManager.enqueue(token, type, {
      event: 'appointment_booked',
      distinct_id: 'booked-id',
    });

    await OursPrivacyQueueManager.removeByIds(
      token,
      type,
      ['booked-id'],
      'indexed',
    );
    expect(OursPrivacyQueueManager.getQueue(token, type)).toEqual([]);
    expect(OursPrivacyQueueManager.getResponseMode(token, type)).toBe(
      'indexed',
    );
    expect(oursprivacyPersistent.saveQueue).toHaveBeenLastCalledWith(
      token,
      type,
      expect.objectContaining({ items: [], responseMode: 'indexed' }),
    );

    await OursPrivacyQueueManager.clearQueue(token, type);
    expect(OursPrivacyQueueManager.getResponseMode(token, type)).toBe(
      'indexed',
    );
  });
});
