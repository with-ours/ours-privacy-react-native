export const isSessionId = (value) =>
  typeof value === 'string' && /^[1-9]\d{12}$/.test(value);

const isoMilliseconds = (value) => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
  ) {
    return null;
  }
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) &&
    new Date(milliseconds).toISOString() === value
    ? milliseconds
    : null;
};

const metadataFields = [
  'mobile_contract_version',
  'mobile_occurred_at',
  'app_version',
  'app_build',
];

export function normalizeMobilePayload(payload, metadata) {
  const defaults = payload.defaultProperties || {};
  const properties = payload.eventProperties || {};
  if (
    !metadata &&
    !payload.event?.startsWith('$mobile_') &&
    ![
      'mobile_platform',
      'mobile_contract_version',
      'mobile_session_started_at',
      'mobile_occurred_at',
    ].some((key) => defaults[key] != null || properties[key] != null)
  ) {
    return payload;
  }

  const legacyMetadata =
    defaults.mobile_contract_version != null ||
    ['mobile_session_started_at', 'mobile_platform'].some(
      (key) => defaults[key] != null || properties[key] != null,
    );
  const sdkMetadata = metadata ?? (legacyMetadata ? defaults : null);
  const defaultProperties = { ...defaults };
  const eventProperties = { ...properties };
  const startMs = isoMilliseconds(defaults.mobile_session_started_at);
  if (!isSessionId(defaults.sid)) {
    if (startMs != null && isSessionId(String(startMs))) {
      defaultProperties.sid = String(startMs);
    } else {
      delete defaultProperties.sid;
    }
  }
  for (const key of ['mobile_session_started_at', 'mobile_platform']) {
    delete defaultProperties[key];
    delete eventProperties[key];
  }
  const commonMetadata = {};
  for (const key of metadataFields) {
    delete defaultProperties[key];
    delete eventProperties[key];
    const value = sdkMetadata
      ? sdkMetadata[key]
      : (defaults[key] ?? properties[key]);
    if (value != null) commonMetadata[key] = value;
  }
  commonMetadata.mobile_contract_version = 1;
  const mergedProperties = { ...eventProperties, ...commonMetadata };
  return {
    ...payload,
    defaultProperties,
    eventProperties:
      Object.keys(mergedProperties).length <= 200 &&
      JSON.stringify(mergedProperties).length < 1_048_576
        ? mergedProperties
        : eventProperties,
  };
}
