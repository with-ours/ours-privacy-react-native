# Ours Privacy React Native SDK

[![npm version](https://img.shields.io/npm/v/@oursprivacy/react-native.svg)](https://www.npmjs.com/package/@oursprivacy/react-native)
[![GitHub](https://img.shields.io/badge/GitHub-repo-blue)](https://github.com/with-ours/ours-privacy-react-native)

Privacy-first analytics for React Native. Wraps native iOS and Android SDKs with a pure JavaScript fallback for Expo and web.

- [npm](https://www.npmjs.com/package/@oursprivacy/react-native)
- [GitHub](https://github.com/with-ours/ours-privacy-react-native)
- [Docs](https://docs.oursprivacy.com/docs/react-native-sdk)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Complete Example](#complete-example)
- [Expo / React Native Web](#expo--react-native-web)
- [API Reference](#api-reference)
  - [Initialization](#initialization)
  - [Core Tracking](#core-tracking)
  - [Default Properties](#default-properties)
  - [Configuration](#configuration)
  - [Identity](#identity)
  - [Timing](#timing)
  - [Privacy Controls](#privacy-controls)
  - [Deprecated Methods](#deprecated-methods)
- [Payload Structure](#payload-structure)
- [Migration from Mixpanel](#migration-from-mixpanel)
- [FAQ](#faq)
- [Support](#support)

---

## Quick Start

### 1. Install

```bash
npm install @oursprivacy/react-native
```

For iOS, run `pod install` in your `ios/` directory:

```bash
cd ios && pod install
```

### 2. Initialize

```js
import { OursPrivacy } from '@oursprivacy/react-native';

const op = new OursPrivacy('YOUR_API_TOKEN', false);
await op.init();
```

That's it. The SDK connects to `https://cdn.oursprivacy.com` by default — no endpoint configuration needed.

### 3. Track Events

```js
op.track('Button Pressed');
op.track('Purchase', { value: 49.99, currency: 'USD' });
```

### 4. Identify Users

After login, link events to a user:

```js
await op.identify('user-123', {
  email: 'user@example.com',
  first_name: 'Jane',
});
```

### 5. Flush

Events are batched and sent every 60 seconds or when the app backgrounds. To send immediately:

```js
op.flush();
```

---

## Complete Example

```js
import React from 'react';
import { Button, SafeAreaView } from 'react-native';
import { OursPrivacy } from '@oursprivacy/react-native';

let op;

async function getClient() {
  if (!op) {
    op = new OursPrivacy('YOUR_API_TOKEN', false);
    await op.init(false, {
      default_event_properties: { app_version: '2.0.0' },
    });
  }
  return op;
}

export default function App() {
  return (
    <SafeAreaView>
      <Button
        title="Track Event"
        onPress={async () => {
          const client = await getClient();
          client.track('Button Pressed', { screen: 'Home' });
        }}
      />
    </SafeAreaView>
  );
}
```

---

## Expo / React Native Web

The SDK falls back to a pure JavaScript implementation when native modules aren't available.

```js
const op = new OursPrivacy('YOUR_API_TOKEN', false, false);
await op.init();
```

This requires `@react-native-async-storage/async-storage`:

```bash
npm install @react-native-async-storage/async-storage
```

You can also provide a custom storage implementation:

```js
const op = new OursPrivacy('YOUR_API_TOKEN', false, false, MyCustomStorage);
await op.init();
```

The storage adapter must implement `getItem`, `setItem`, and `removeItem` (same interface as AsyncStorage).

---

## API Reference

### Initialization

#### `new OursPrivacy(token, useNative?, storage?)`

Creates an OursPrivacy instance. You must call `.init()` before tracking.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | `string` | Yes | Your project token |
| `useNative` | `boolean` | No | Use native iOS/Android modules (default: `true`). Set to `false` for Expo/web |
| `storage` | `OursPrivacyAsyncStorage` | No | Custom storage adapter (only used when `useNative` is `false`) |

**Returns:** `OursPrivacy` instance (call `.init()` to complete setup)

```js
const op = new OursPrivacy('YOUR_API_TOKEN');
```

---

#### `op.init(optOutTrackingDefault?, options?)`

Initializes the SDK. Must be called before tracking.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `optOutTrackingDefault` | `boolean` | No | If `true`, tracking is opted out by default (default: `false`) |
| `options` | `OursPrivacyInitOptions` | No | Additional initialization options (see below) |

**`OursPrivacyInitOptions` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `serverURL` | `string` | Override the default API endpoint |
| `user_id` | `string` | Pre-set a visitor ID; sets `is_manually_set_id: true` on all events |
| `default_event_properties` | `object` | Properties merged into `eventProperties` on every `track()` call |
| `default_user_custom_properties` | `object` | Properties merged into `userProperties.custom_properties` on every event |
| `default_user_consent_properties` | `object` | Properties merged into `userProperties.consent` on every event |

**Returns:** `Promise<void>`

```js
// Minimal init
await op.init();

// With options
await op.init(false, {
  serverURL: 'https://api-eu.oursprivacy.com',
  user_id: 'pre-known-id',
  default_event_properties: { platform: 'mobile', app_version: '2.0.0' },
  default_user_custom_properties: { tier: 'pro' },
  default_user_consent_properties: { marketing: true },
});
```

---

### Core Tracking

#### `op.track(eventName, properties?)`

Track an event with optional properties.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventName` | `string` | Yes | Name of the event |
| `properties` | `object` | No | Key/value pairs to attach to the event |

**Returns:** `void`

```js
op.track('Page View', { page: '/home', referrer: 'google' });
```

---

#### `op.identify(distinctId, userProperties?)`

Associate all future `track()` calls with the given user ID. Call this after a user logs in.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `distinctId` | `string` | Yes | A string uniquely identifying this user |
| `userProperties` | `OursPrivacyUserProperties` | No | User properties to attach |

**`OursPrivacyUserProperties` shape:**

| Field | Type | Description |
|-------|------|-------------|
| `email` | `string` | User's email address |
| `external_id` | `string` | ID from your own system |
| `phone_number` | `string` | User's phone number |
| `first_name` | `string` | First name |
| `last_name` | `string` | Last name |
| `custom_properties` | `object` | Arbitrary custom user attributes |
| `consent` | `object` | Consent flags (e.g. `{ marketing: true }`) |

**Returns:** `Promise<void>`

```js
await op.identify('user-123', {
  email: 'jane@example.com',
  external_id: 'db-user-456',
  first_name: 'Jane',
  custom_properties: { tier: 'pro' },
  consent: { marketing: true },
});
```

---

#### `op.flush()`

Push all queued events to the server immediately. Useful before app close or logout.

**Returns:** `void`

```js
op.flush();
```

---

#### `op.reset()`

Clear the current user identity and all default properties. Generates a new random visitor ID. Call this when a user logs out.

**Returns:** `void`

```js
op.reset();
```

---

### Default Properties

Default properties are automatically merged into every event the SDK sends. They are the primary way to attach persistent, per-user or per-session context without repeating it on every `track()` call.

These methods can be called at init time via `options`, or at any point afterwards.

---

#### `op.updateDefaultEventProperties(properties)`

Merge properties into `eventProperties` on every future `track()` call. Properties are merged shallowly — later calls overwrite earlier ones for the same key.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `properties` | `object` | Yes | Key/value pairs to merge into default event properties |

**Returns:** `void`

```js
// At init time:
await op.init(false, {
  default_event_properties: { app_version: '2.0.0', environment: 'production' },
});

// Or post-init (e.g. after fetching user data):
op.updateDefaultEventProperties({ experiment_group: 'variant_b' });

// Every subsequent track() will include these automatically:
op.track('Button Pressed'); // eventProperties includes app_version, environment, experiment_group
```

---

#### `op.updateDefaultUserCustomProperties(properties)`

Merge properties into `userProperties.custom_properties` on every future event. Useful for attaching user attributes that should travel with every event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `properties` | `object` | Yes | Key/value pairs to merge into default user custom properties |

**Returns:** `void`

```js
// At init time:
await op.init(false, {
  default_user_custom_properties: { tier: 'pro' },
});

// Or post-init (e.g. after subscription status loads):
op.updateDefaultUserCustomProperties({ tier: 'enterprise', seats: 50 });
```

---

#### `op.updateDefaultUserConsentProperties(properties)`

Merge properties into `userProperties.consent` on every future event. Use this to send the user's consent state alongside all analytics events.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `properties` | `object` | Yes | Key/value pairs to merge into default user consent properties |

**Returns:** `void`

```js
// At init time:
await op.init(false, {
  default_user_consent_properties: { marketing: false, analytics: true },
});

// Or when the user updates their preferences:
op.updateDefaultUserConsentProperties({ marketing: true });
```

---

### Configuration

#### `op.setServerURL(serverURL)`

Override the API endpoint after initialization. Use this to route to Ours Privacy's EU servers or a proxy.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverURL` | `string` | Yes | Base URL for API requests |

**Returns:** `void`

```js
// EU data residency
op.setServerURL('https://api-eu.oursprivacy.com');
```

---

#### `op.setLoggingEnabled(loggingEnabled)`

Enable or disable debug logging. All logging is disabled by default.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `loggingEnabled` | `boolean` | Yes | Whether to enable SDK logging |

**Returns:** `void`

```js
op.setLoggingEnabled(true);
```

---

#### `op.setFlushOnBackground(flushOnBackground)`

Control whether the SDK flushes events when the app enters the background. Enabled by default. **iOS only** — calling this on Android is a no-op with a console warning.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `flushOnBackground` | `boolean` | Yes | Whether to flush on app background |

**Returns:** `void`

```js
op.setFlushOnBackground(false);
```

---

#### `op.setUseIpAddressForGeolocation(useIpAddressForGeolocation)`

Control whether the client IP address is sent with events for geolocation. Enabled by default.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `useIpAddressForGeolocation` | `boolean` | Yes | Whether to include IP for geolocation |

**Returns:** `void`

```js
op.setUseIpAddressForGeolocation(false);
```

---

#### `op.setFlushBatchSize(flushBatchSize)`

Set the maximum number of events sent in a single network request. Maximum value is 50; values above 50 are clamped to 50.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `flushBatchSize` | `number` | Yes | Number of events per batch (max 50) |

**Returns:** `void`

```js
op.setFlushBatchSize(25);
```

---

### Identity

#### `op.getVisitorId()`

Returns the stable visitor UUID for this device. This is the preferred method for retrieving a user identifier — it returns a clean UUID with no prefix.

**Returns:** `string | null`

```js
const visitorId = op.getVisitorId();
console.log(visitorId); // e.g. "550e8400-e29b-41d4-a716-446655440000"
```

---

#### `op.getDistinctId()`

⚠️ **Deprecated** — Use `getVisitorId()` instead.

Returns the current distinct ID. For anonymous users, this is the same as the visitor ID.

**Returns:** `Promise<string>`

```js
const id = await op.getDistinctId();
```

---

#### `op.getDeviceId()`

⚠️ **Deprecated** — Use `getVisitorId()` instead.

Returns the device ID.

**Returns:** `Promise<string>`

```js
const deviceId = await op.getDeviceId();
```

---

### Timing

#### `op.timeEvent(eventName)`

Begin timing an event. When you later call `track()` with the same event name, the event will include a `$duration` property (in seconds).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventName` | `string` | Yes | Name of the event to time |

**Returns:** `void`

```js
op.timeEvent('Video Watched');

// ... later:
op.track('Video Watched', { video_id: 'abc123' }); // includes $duration
```

---

#### `op.eventElapsedTime(eventName)`

Get the elapsed time in seconds since `timeEvent()` was called for the given event, without sending the event.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `eventName` | `string` | Yes | Name of the previously timed event |

**Returns:** `Promise<number>` — elapsed seconds

```js
op.timeEvent('Checkout');
// ... later:
const elapsed = await op.eventElapsedTime('Checkout');
console.log(`Checkout has been open for ${elapsed}s`);
```

---

### Privacy Controls

#### `op.optOutTracking()`

Stop all tracking immediately. Any queued events that have not been flushed will be discarded. Call `flush()` first if you want to preserve queued events.

**Returns:** `void`

```js
// Flush first to preserve any pending events
op.flush();
op.optOutTracking();
```

---

#### `op.optInTracking()`

Resume tracking after a previous call to `optOutTracking()`. This also sends an `$opt_in` event to the server.

**Returns:** `void`

```js
op.optInTracking();
```

---

#### `op.hasOptedOutTracking()`

Check whether the current user has opted out of tracking.

**Returns:** `Promise<boolean>`

```js
const hasOptedOut = await op.hasOptedOutTracking();
if (hasOptedOut) {
  console.log('User has opted out');
}
```

---

### Deprecated Methods

The following methods are kept for backwards compatibility but should not be used in new code.

#### ⚠️ `op.registerSuperProperties(properties)`

**Deprecated** — Use `updateDefaultEventProperties()` instead.

Register properties that will be sent with every future `track()` call.

```js
// Deprecated
op.registerSuperProperties({ plan: 'pro' });

// Use instead
op.updateDefaultEventProperties({ plan: 'pro' });
```

---

#### ⚠️ `op.registerSuperPropertiesOnce(properties)`

**Deprecated** — Use `updateDefaultEventProperties()` instead.

Register super properties only if those keys have not already been registered.

```js
// Deprecated
op.registerSuperPropertiesOnce({ first_open: true });
```

---

#### ⚠️ `op.getSuperProperties()`

**Deprecated** — Use `updateDefaultEventProperties()` instead.

Returns the currently registered super properties.

**Returns:** `Promise<object>`

```js
// Deprecated
const props = await op.getSuperProperties();
```

---

#### ⚠️ `op.unregisterSuperProperty(propertyName)`

**Deprecated** — Use `updateDefaultEventProperties()` instead.

Remove a single super property so it is no longer sent with future events.

```js
// Deprecated
op.unregisterSuperProperty('experiment_group');
```

---

#### ⚠️ `op.clearSuperProperties()`

**Deprecated** — Use `updateDefaultEventProperties()` instead.

Remove all registered super properties.

```js
// Deprecated
op.clearSuperProperties();
```

---

#### ⚠️ `op.alias(alias, distinctId)`

**Deprecated.** Creates an alias mapping one ID to another.

| Parameter | Type | Description |
|-----------|------|-------------|
| `alias` | `string` | The new alias identifier |
| `distinctId` | `string` | The existing distinct ID to map to |

**Returns:** `void`

```js
// Deprecated
op.alias('user-123', op.getVisitorId());
```

---

#### ⚠️ `OursPrivacy.init(token, trackAutomaticEvents, optOutTrackingDefault?)` (static)

**Deprecated** — Use `new OursPrivacy(...).init()` instead.

The static `init` method was the original initialization pattern. It bypasses the JavaScript fallback path and only works with native modules.

```js
// Deprecated (static form)
const op = await OursPrivacy.init('YOUR_API_TOKEN', false);

// Use instead (instance form)
const op = new OursPrivacy('YOUR_API_TOKEN', false);
await op.init();
```

---

## Payload Structure

The SDK sends a JSON body to `POST /api/v1/track`. Understanding this structure is useful if you are building a proxy, debugging with a network inspector, or verifying your data in the Ours Privacy dashboard.

```json
{
  "token": "your-project-token",
  "is_manually_set_id": false,
  "data": [
    {
      "event": "Purchase",
      "visitor_id": "550e8400-e29b-41d4-a716-446655440000",
      "distinct_id": "550e8400-e29b-41d4-a716-446655440000",
      "eventProperties": {
        "price": 99
      },
      "userProperties": {
        "custom_properties": {
          "tier": "pro"
        },
        "consent": {
          "marketing": true
        }
      },
      "defaultProperties": {
        "device_type": "mobile",
        "os_name": "iOS",
        "os_version": "17.0",
        "device_vendor": "Apple",
        "device_model": "iPhone 16 Pro",
        "screen_width": 390,
        "screen_height": 844,
        "version": "1.1.0"
      }
    }
  ]
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `token` | Your project token |
| `is_manually_set_id` | `true` when `user_id` was passed in `init()` options |
| `data` | Array of event objects in this batch |
| `event` | Event name |
| `visitor_id` | Stable device UUID (no prefix) |
| `distinct_id` | Per-event UUID, same as `visitor_id` for anonymous users |
| `eventProperties` | Properties from `track()` merged with default event properties |
| `userProperties.custom_properties` | From `identify()` and `updateDefaultUserCustomProperties()` |
| `userProperties.consent` | From `identify()` and `updateDefaultUserConsentProperties()` |
| `defaultProperties` | Automatically collected device/SDK metadata |

---

## Migration from Mixpanel

This SDK was originally forked from the Mixpanel React Native SDK. If you are migrating from Mixpanel or from an earlier version of this SDK, note the following:

### Removed features

The following Mixpanel-specific features have been removed and are not planned:

- **People / Profiles** — `mixpanel.getPeople()`, `people.set()`, `people.increment()`, etc.
- **Groups** — `mixpanel.getGroup()`, `setGroup()`, `addGroup()`, etc.

These APIs do not exist in `@oursprivacy/react-native` and will throw if called.

### Renamed package

```bash
# Remove Mixpanel
npm uninstall @mixpanel/react-native

# Install Ours Privacy
npm install @oursprivacy/react-native
```

```js
// Before
import { Mixpanel } from '@mixpanel/react-native';
const mp = await Mixpanel.init('TOKEN', false);

// After
import { OursPrivacy } from '@oursprivacy/react-native';
const op = new OursPrivacy('TOKEN', false);
await op.init();
```

### Super properties → Default properties

The `registerSuperProperties` family of methods is deprecated in favor of the new default properties API, which maps directly to the Ours Privacy event schema:

```js
// Before (Mixpanel-style super properties)
op.registerSuperProperties({ plan: 'pro', environment: 'production' });

// After (Ours Privacy default event properties)
op.updateDefaultEventProperties({ plan: 'pro', environment: 'production' });

// New: per-user custom properties sent on every event
op.updateDefaultUserCustomProperties({ tier: 'enterprise' });

// New: consent state sent on every event
op.updateDefaultUserConsentProperties({ marketing: true, analytics: true });
```

### Distinct ID

Mixpanel's distinct ID could include a device-prefix (e.g. `$device:uuid`). Ours Privacy uses a clean UUID with no prefix:

```js
// Before (may return "$device:uuid" string)
const id = await op.getDistinctId();

// After (returns clean UUID)
const id = op.getVisitorId();
```

---

## FAQ

**Do I need to request permission through AppTrackingTransparency?**

No. Ours Privacy does not use IDFA, so no ATT permission is required.

**Why aren't my events showing up?**

Events are batched and sent every 60 seconds or when the app backgrounds. Call `flush()` to send immediately. Enable debug logging with `setLoggingEnabled(true)` to see what's happening.

**What platforms are supported?**

- React Native >= 0.60
- iOS 10+
- Android API 21+
- Expo (JavaScript mode)

**How do I route data to EU servers?**

Pass `serverURL` in the `init` options or call `setServerURL()` after initialization:

```js
await op.init(false, { serverURL: 'https://api-eu.oursprivacy.com' });

// or
op.setServerURL('https://api-eu.oursprivacy.com');
```

**What is the difference between `getVisitorId()` and `getDistinctId()`?**

`getVisitorId()` returns a clean UUID with no prefix and is synchronous. `getDistinctId()` is asynchronous and may return a prefixed string on older SDK versions. Use `getVisitorId()` for all new code.

---

## Support

- [Documentation](https://docs.oursprivacy.com/docs/react-native-sdk)
- [GitHub Issues](https://github.com/with-ours/ours-privacy-react-native/issues)
- Email: support@oursprivacy.com
