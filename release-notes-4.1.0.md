# React Native 4.1.0 release note draft

- Canonical mobile lifecycle and session events are available on iOS and Android when `trackAutomaticEvents: true`; automatic tracking remains off by default.
- Screen views require an explicit `trackScreen()` call from your navigator with a stable screen label. The SDK does not observe navigation routes.
- `$mobile_*` event names are reserved for SDK-generated facts and rejected by `track()`. Existing `$ae_*` names remain accepted as legacy custom events; they do not replace canonical mobile events.
