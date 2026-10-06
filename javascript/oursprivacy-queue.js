import { OursPrivacyPersistent } from './oursprivacy-persistent';

export const OursPrivacyQueueManager = (() => {
  let _queues = {};
  let oursprivacyPersistent;
  const pending = new Map();

  const isFirstOpen = (item) => item.event === '$mobile_first_open';

  const normalize = (stored) => {
    const items = Array.isArray(stored)
      ? stored
      : Array.isArray(stored?.items)
        ? stored.items
        : [];
    return {
      items,
      firstOpenAccepted:
        stored?.firstOpenAccepted === true || items.some(isFirstOpen),
      responseMode:
        stored?.responseMode === 'indexed' || stored?.responseMode === 'legacy'
          ? stored.responseMode
          : null,
    };
  };

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
        const queue = normalize(await getPersistent().loadQueue(token, type));
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
      const queue = _queues[token]?.[type] || normalize();
      const duplicate =
        data.distinct_id &&
        queue.items.some((item) => item.distinct_id === data.distinct_id);
      if (duplicate && (queue.firstOpenAccepted || !isFirstOpen(data))) return;
      await save(token, type, {
        ...queue,
        items: duplicate ? queue.items : [...queue.items, data],
        firstOpenAccepted: queue.firstOpenAccepted || isFirstOpen(data),
      });
    });

  const getQueue = (token, type) => {
    if (!_queues[token] || !_queues[token][type]) {
      return [];
    }
    return [..._queues[token][type].items];
  };

  const hasAcceptedFirstOpen = (token, type) =>
    _queues[token]?.[type]?.firstOpenAccepted === true;

  const getResponseMode = (token, type) =>
    _queues[token]?.[type]?.responseMode ?? null;

  const setResponseMode = (token, type, responseMode) =>
    serialize(token, type, async () => {
      const queue = _queues[token]?.[type];
      if (!queue || responseMode !== 'indexed') return;
      // Keep indexed mode in memory after a failed save so a later 400 cannot discard an event.
      queue.responseMode = 'indexed';
      await save(token, type, { ...queue });
    });

  const spliceQueue = (token, type, start, deleteCount) =>
    serialize(token, type, async () => {
      const queue = _queues[token]?.[type];
      if (!queue) return;
      const items = [...queue.items];
      items.splice(start, deleteCount);
      await save(token, type, { ...queue, items });
    });

  const removeByIds = (token, type, ids, responseMode) =>
    serialize(token, type, async () => {
      const queue = _queues[token]?.[type];
      if (!queue) return;
      const sentIds = new Set(ids);
      await save(token, type, {
        ...queue,
        items: queue.items.filter((item) => !sentIds.has(item.distinct_id)),
        responseMode:
          queue.responseMode === 'indexed' || responseMode === 'indexed'
            ? 'indexed'
            : responseMode || queue.responseMode,
      });
    });

  const clearQueue = (token, type) =>
    serialize(token, type, () =>
      save(token, type, {
        ...(_queues[token]?.[type] || normalize()),
        items: [],
      }),
    );

  return {
    initialize,
    enqueue,
    getQueue,
    hasAcceptedFirstOpen,
    getResponseMode,
    setResponseMode,
    spliceQueue,
    removeByIds,
    clearQueue,
  };
})();
