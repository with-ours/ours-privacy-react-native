import { OursPrivacyPersistent } from './oursprivacy-persistent';

export const OursPrivacyQueueManager = (() => {
  let _queues = {};
  let oursprivacyPersistent;
  const pending = new Map();

  const serialize = (token, type, action) => {
    const key = `${token}:${type}`;
    const result = (pending.get(key) || Promise.resolve()).then(action);
    pending.set(
      key,
      result.catch(() => {}),
    );
    return result;
  };

  const getPersistent = () => {
    if (!oursprivacyPersistent) {
      oursprivacyPersistent = OursPrivacyPersistent.getInstance();
    }
    return oursprivacyPersistent;
  };

  const initialize = (token, type) =>
    serialize(token, type, async () => {
      if (!_queues[token] || !_queues[token][type]) {
        const queue = await getPersistent().loadQueue(token, type);
        _queues[token] = {
          ..._queues[token],
          [type]: queue,
        };
      }
    });

  const save = async (token, type, queue) => {
    await getPersistent().saveQueue(token, type, queue);
    _queues[token] = { ..._queues[token], [type]: queue };
  };

  const enqueue = (token, type, data) =>
    serialize(token, type, async () => {
      const queue = _queues[token]?.[type] || [];
      if (
        data.distinct_id &&
        queue.some((item) => item.distinct_id === data.distinct_id)
      ) {
        return;
      }
      await save(token, type, [...queue, data]);
    });

  const getQueue = (token, type) => {
    if (!_queues[token] || !_queues[token][type]) {
      return [];
    }
    return [..._queues[token][type]];
  };

  const spliceQueue = (token, type, start, deleteCount) =>
    serialize(token, type, async () => {
      const queue = _queues[token]?.[type];
      if (!queue) return;
      const next = [...queue];
      next.splice(start, deleteCount);
      await save(token, type, next);
    });

  const clearQueue = (token, type) =>
    serialize(token, type, () => save(token, type, []));

  return {
    initialize,
    enqueue,
    getQueue,
    spliceQueue,
    clearQueue,
  };
})();
