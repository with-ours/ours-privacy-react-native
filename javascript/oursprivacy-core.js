import { OursPrivacyQueueManager } from './oursprivacy-queue';
import { OursPrivacyNetwork } from './oursprivacy-network';
import { OursPrivacyType } from './oursprivacy-constants';
import { OursPrivacyConfig } from './oursprivacy-config';
import { OursPrivacyPersistent } from './oursprivacy-persistent';
import { OursPrivacyLogger } from './oursprivacy-logger';

const pendingFlushes = new Map();

const hasIndexedResult = (response) =>
  response !== null &&
  typeof response === 'object' &&
  (Object.prototype.hasOwnProperty.call(response, 'accepted') ||
    Object.prototype.hasOwnProperty.call(response, 'rejected'));

const rejectedFromMobileResponse = (response, batchSize) => {
  if (
    !response ||
    response.success !== true ||
    !Number.isSafeInteger(response.accepted) ||
    response.accepted < 0 ||
    !Array.isArray(response.rejected) ||
    response.accepted + response.rejected.length !== batchSize
  ) {
    throw new Error('Invalid mobile ingest response');
  }
  const indexes = new Set();
  for (const item of response.rejected) {
    if (
      !item ||
      !Number.isSafeInteger(item.index) ||
      item.index < 0 ||
      item.index >= batchSize ||
      typeof item.code !== 'string' ||
      item.code.trim().length === 0 ||
      indexes.has(item.index)
    ) {
      throw new Error('Invalid mobile ingest response');
    }
    indexes.add(item.index);
  }
  return response.rejected;
};

export const OursPrivacyCore = (storage) => {
  const oursprivacyPersistent = OursPrivacyPersistent.getInstance(storage);
  const config = OursPrivacyConfig.getInstance();
  let isProcessingQueue = false;
  let processQueueInterval = null;

  const initialize = async (token) => {
    await OursPrivacyQueueManager.initialize(token, OursPrivacyType.EVENTS);
  };

  const startProcessingQueue = (token) => {
    if (oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(
        token,
        `User has opted out of tracking, skipping processing queue.`,
      );
      return;
    }

    if (isProcessingQueue) {
      OursPrivacyLogger.log(
        token,
        `Queue is already being processed. Skipping new cycle.`,
      );
      return;
    }

    isProcessingQueue = true;

    processQueueInterval = setInterval(async () => {
      clearInterval(processQueueInterval);
      await processQueue(token, OursPrivacyType.EVENTS);

      isProcessingQueue = false;
      startProcessingQueue(token);
    }, config.getFlushInterval(token));
  };

  const isValidAndSerializable = (token, obj) => {
    try {
      JSON.stringify(obj);
    } catch (error) {
      OursPrivacyLogger.error(token, `Error in OursPrivacy payload: ${error}`);
      return false;
    }
    return true;
  };

  const addToOursPrivacyQueue = async (token, type, data) => {
    if (oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(
        token,
        `User has opted out of tracking, skipping tracking.`,
      );
      return false;
    }
    if (!isValidAndSerializable(token, data)) {
      OursPrivacyLogger.error(
        token,
        `The OursPrivacy payload is not valid or not serializable.`,
      );
      return false;
    }
    await OursPrivacyQueueManager.enqueue(token, type, data);
    OursPrivacyLogger.log(
      token,
      `Event added to queue. Payload: '${JSON.stringify(data)}'`,
    );
    return true;
  };

  const flush = async (token) => {
    if (oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(
        token,
        `User has opted out of tracking, do not flush queue.`,
      );
      return;
    }
    await processQueue(token, OursPrivacyType.EVENTS);
  };

  const processQueue = (token, type) => {
    const key = `${token}:${type}`;
    const result = (pendingFlushes.get(key) || Promise.resolve()).then(
      async () => {
        OursPrivacyLogger.log(token, `Processing queue for endpoint: ${type}`);
        while (!oursprivacyPersistent.getOptedOut(token)) {
          const queue = OursPrivacyQueueManager.getQueue(token, type);
          if (queue.length === 0) return;
          OursPrivacyLogger.log(token, `[Flushing queue] endpoint: ${type}`);
          OursPrivacyLogger.log(
            token,
            `[Flushing queue] queue: ${JSON.stringify(queue)}`,
          );
          const batchSize = config.getFlushBatchSize(token);
          const fallbackIdentityMode = config.getIsManuallySetId(token);
          const identityMode = (item) =>
            typeof item.isManuallySetId === 'boolean'
              ? item.isManuallySetId
              : fallbackIdentityMode;
          const isManuallySetId = identityMode(queue[0]);
          const batch = [];
          for (const item of queue.slice(0, batchSize)) {
            if (
              item.visitor_id !== queue[0].visitor_id ||
              identityMode(item) !== isManuallySetId
            ) {
              break;
            }
            batch.push(item);
          }
          try {
            const response = await OursPrivacyNetwork.sendRequest({
              token,
              data: batch.map(({ isManuallySetId: _mode, ...item }) => item),
              endpoint: type,
              serverURL: config.getServerURL(token),
              isManuallySetId,
            });
            if (oursprivacyPersistent.getOptedOut(token)) return;
            let rejected = [];
            let responseMode;
            if (hasIndexedResult(response)) {
              rejected = rejectedFromMobileResponse(response, batch.length);
              responseMode = 'indexed';
            } else if (
              !response ||
              typeof response !== 'object' ||
              Array.isArray(response) ||
              response.success !== true ||
              typeof response.visitor_id !== 'string' ||
              response.visitor_id.trim().length === 0
            ) {
              throw new Error('Invalid ingest response');
            } else {
              responseMode = 'legacy';
            }
            if (oursprivacyPersistent.getOptedOut(token)) return;
            await OursPrivacyQueueManager.removeByIds(
              token,
              type,
              batch.map((item) => item.distinct_id),
              responseMode,
            );
            const onIngestRejected = config.getOnIngestRejected(token);
            if (typeof onIngestRejected === 'function') {
              for (const { index, code } of rejected) {
                try {
                  onIngestRejected({
                    distinctId: batch[index].distinct_id,
                    code,
                  });
                } catch {
                  OursPrivacyLogger.error(
                    token,
                    'onIngestRejected callback failed',
                  );
                }
              }
            }
          } catch (error) {
            OursPrivacyLogger.error(
              token,
              `Error sending event batch from queue, error: ${error}`,
            );
            return;
          }
        }
      },
    );
    pendingFlushes.set(
      key,
      result.catch(() => {}),
    );
    return result;
  };

  return {
    initialize,
    cancelPendingUploads: OursPrivacyNetwork.cancelRequests,
    startProcessingQueue,
    addToOursPrivacyQueue,
    flush,
  };
};
