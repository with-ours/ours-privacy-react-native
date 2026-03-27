export const OursPrivacyType = {
  EVENTS: "/ingest",
};

export const getQueueKey = (token, type) => `OURSPRIVACY_${token}_${type}_QUEUE`;

// Storage key string kept as-is for backwards compatibility with existing installs.
export const getVisitorIdKey = (token) => `OURSPRIVACY_${token}_DEVICE_ID`;

export const getOptedOutKey = (token) => `OURSPRIVACY_${token}_OPT_OUT`;
export const getSuperPropertiesKey = (token) =>
  `OURSPRIVACY_${token}_SUPER_PROPERTIES`;
export const getTimeEventsKey = (token) => `OURSPRIVACY_${token}_TIME_EVENTS`;
export const getAppHasOpenedBeforeKey = (token) =>
  `OURSPRIVACY_${token}_APP_HAS_OPENED_BEFORE`;

export const defaultServerURL = `https://cdn.oursprivacy.com`;
export const defaultBatchSize = 50;
export const defaultFlushInterval = 10 * 1000; // 10s
