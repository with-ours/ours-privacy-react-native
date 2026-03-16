import {OursPrivacyQueueManager} from "./oursprivacy-queue";
import {OursPrivacyNetwork} from "./oursprivacy-network";
import {OursPrivacyType} from "./oursprivacy-constants";
import {OursPrivacyConfig} from "./oursprivacy-config";
import {OursPrivacyPersistent} from "./oursprivacy-persistent";
import {OursPrivacyLogger} from "./oursprivacy-logger";

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
        `User has opted out of tracking, skipping processing queue.`
      );
      return;
    }

    if (isProcessingQueue) {
      OursPrivacyLogger.log(
        token,
        `Queue is already being processed. Skipping new cycle.`
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

  const isValidAndSerializable = (token, obj, depth = 1) => {
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
        `User has opted out of tracking, skipping tracking.`
      );
      return;
    }
    if (!isValidAndSerializable(token, data)) {
      OursPrivacyLogger.error(
        token,
        `The OursPrivacy payload is not valid or not serializable.`
      );
      return;
    }
    await OursPrivacyQueueManager.enqueue(token, type, data);
    OursPrivacyLogger.log(
      token,
      `Event added to queue. Payload: '${JSON.stringify(data)}'`
    );
  };

  const flush = async (token) => {
    if (oursprivacyPersistent.getOptedOut(token)) {
      OursPrivacyLogger.log(
        token,
        `User has opted out of tracking, do not flush queue.`
      );
      return;
    }
    await processQueue(token, OursPrivacyType.EVENTS);
  };

  const processQueue = async (token, type) => {
    OursPrivacyLogger.log(token, `Processing queue for endpoint: ${type}`);
    const processBatch = async () => {
      const queue = OursPrivacyQueueManager.getQueue(token, type);
      if (queue.length > 0) {
        OursPrivacyLogger.log(token, `[Flushing queue] endpoint: ${type}`);
        OursPrivacyLogger.log(
          token,
          `[Flushing queue] queue: ${JSON.stringify(queue)}`
        );
        const batchSize = config.getFlushBatchSize(token);
        const batch = queue.slice(0, batchSize);
        try {
          await OursPrivacyNetwork.sendRequest({
            token,
            data: batch,
            endpoint: type,
            serverURL: config.getServerURL(token),
            isManuallySetId: config.getIsManuallySetId(token),
          });
          await OursPrivacyQueueManager.spliceQueue(token, type, 0, batch.length);
          // Process the next batch if there are more events in the queue
          const queue = OursPrivacyQueueManager.getQueue(token, type);
          if (queue.length > 0) {
            setTimeout(processBatch, 0);
          }
        } catch (error) {
          handleBatchError(token, error, type, processBatch);
        }
      }
    };

    processBatch();
  };

  const handleBatchError = (token, error, type, callback) => {
    if (error.code === 400) {
      OursPrivacyLogger.error(
        token,
        `Bad request received due to corrupted data within the batch. The corrupted data is now being removed from the queue...`
      );
      // Remove the corrupted data from the queue, to avoid the data loss, only remove one event at a time
      OursPrivacyQueueManager.spliceQueue(token, type, 0, 1).then(() => {
        setTimeout(callback, 0);
      });
    } else {
      OursPrivacyLogger.error(
        token,
        `Error sending event batch from queue, error: ${error}`
      );
    }
  };

  return {
    initialize,
    startProcessingQueue,
    addToOursPrivacyQueue,
    flush,
  };
};
