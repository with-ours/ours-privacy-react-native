# React Native 4.1.0 release note draft

- Canonical mobile lifecycle and session events are available on iOS and Android when `trackAutomaticEvents: true`; automatic tracking remains off by default.
- Screen views require an explicit `trackScreen()` call from your navigator with a stable screen label. The SDK does not observe navigation routes.
- `$mobile_*` names are reserved: `track()` warns and ignores them. Existing `$ae_*` names remain accepted as custom events; React Native does not automatically emit the legacy lifecycle stream.
- `track()`, `trackScreen()`, and `reset()` now return promises. Await them to handle storage failures. `hasOptedOutTracking()` is a synchronous boolean and remains `true` until `init()` loads consent.
- Explicit consent choices survive restart and override the configured default. Defaults written by 4.1 follow later `optOutTrackingByDefault` changes; unmarked legacy opt-outs remain closed. Fresh background initialization preserves first-open eligibility.
- Re-initialization does not count another foreground open. `reset()` and `setVisitorId()` end announced sessions while retaining queued events under their captured identity. Rapid rotations keep distinct numeric session IDs.
- Backgrounding clears the active screen; re-report it on resume when navigation does not fire. Screens and engagement require stable labels, never route parameters or patient details.
- Uploads tolerate unknown response fields and empty successful bodies. Permanent 4xx and nonretryable `success:false` drop the batch with `onIngestRejected`; 403, 408, 425, and 429 retry. Malformed nonempty bodies or invalid indexed responses drop after five malformed flushes for the same head. Callbacks run after durable removal and contain only event ID and code.
- Unreadable saved queues recover as empty. Caller app version/build values are preserved when SDK metadata is unavailable. Deep-link events no longer include raw URLs; use the allowlisted attribution defaults.
