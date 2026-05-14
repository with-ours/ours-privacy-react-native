# Ours Privacy React Native SDK

[![npm version](https://img.shields.io/npm/v/@oursprivacy/react-native.svg)](https://www.npmjs.com/package/@oursprivacy/react-native)
[![GitHub](https://img.shields.io/badge/GitHub-repo-blue)](https://github.com/with-ours/ours-privacy-react-native)

Privacy-first analytics for React Native.

This SDK is pure JavaScript. It does not ship native iOS or Android modules.

- [npm](https://www.npmjs.com/package/@oursprivacy/react-native)
- [GitHub](https://github.com/with-ours/ours-privacy-react-native)
- [Docs](https://docs.oursprivacy.com/docs/react-native-sdk)

---

## Table of Contents

- [Quick Start](#quick-start)
- [Complete Example](#complete-example)
- [API Reference](#api-reference)
  - [Initialization](#initialization)
  - [Core Tracking](#core-tracking)
  - [Default Properties](#default-properties)
  - [Configuration](#configuration)
  - [Identity](#identity)
  - [Privacy Controls](#privacy-controls)
- [Payload Structure](#payload-structure)
- [FAQ](#faq)
- [Support](#support)

---

## Quick Start

### 1. Install

```bash
npm install @oursprivacy/react-native
npm install @react-native-async-storage/async-storage
```

Install `@react-native-async-storage/async-storage` directly in your app if you want persistent storage in bare React Native projects. Without it, the SDK falls back to in-memory storage.

### 2. Initialize

```js
import { OursPrivacy } from '@oursprivacy/react-native';

const op = new OursPrivacy();
await op.init('YOUR_API_TOKEN');
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
await op.identify({
  externalId: 'user-123',
  email: 'user@example.com',
  firstName: 'Jane',
});
```

### 5. Flush

Events are batched and sent every 10 seconds by default. To send immediately:

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
    op = new OursPrivacy();
    await op.init('YOUR_API_TOKEN', {
      defaultEventProperties: { app_version: '2.0.0' },
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

## API Reference

### Initialization

#### `new OursPrivacy()`

Creates an OursPrivacy instance. The instance is unconfigured until you call `.init()`. All configuration (token, default properties, storage, etc.) is passed to `init()`.

**Returns:** `OursPrivacy` instance.

```js
const op = new OursPrivacy();
```

---

#### `op.init(token, options?)`

Initialize the SDK. Must be called before any tracking method.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | `string` | Yes | Your project token |
| `options` | `OursPrivacyInitOptions` | No | Initialization options (see below) |

**`OursPrivacyInitOptions` shape (all camelCase):**

| Field | Type | Description |
|-------|------|-------------|
| `trackAutomaticEvents` | `boolean` | Reserved for future automatic event tracking |
| `optOutTrackingByDefault` | `boolean` | If `true`, tracking starts opted out (default: `false`) |
| `visitorId` | `string` | Pre-set the visitor ID; sets `is_manually_set_id: true` on all events |
| `defaultEventProperties` | `object` | Properties merged into `eventProperties` on every `track()` call |
| `defaultUserCustomProperties` | `object` | Properties merged into `userProperties.custom_properties` on every event |
| `defaultUserConsentProperties` | `object` | Properties merged into `userProperties.consent` on every event |
| `serverURL` | `string` | Override the base URL used for requests, for example a local QA capture server |
| `initialURL` | `string` | Deep link URL to parse on init — extracts UTM params, click IDs, and `ours_visitor_id` (see [Deep Link Attribution](#deep-link-attribution)) |
| `storage` | `OursPrivacyAsyncStorage` | Custom AsyncStorage adapter |

**Returns:** `Promise<void>`

```js
// Minimal init
await op.init('YOUR_API_TOKEN');

// With options
await op.init('YOUR_API_TOKEN', {
  visitorId: 'pre-known-id',
  defaultEventProperties: { platform: 'mobile', app_version: '2.0.0' },
  defaultUserCustomProperties: { tier: 'pro' },
  defaultUserConsentProperties: { marketing: true },
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

#### `op.identify(userProperties?)`

Associate all future `track()` calls with the given user identity. Call this after a user logs in.

Pass identifying fields inside the `userProperties` bag — most commonly `externalId` (your system's user ID). Any default custom or consent properties registered via `updateDefault*` are merged in automatically.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userProperties` | `OursPrivacyUserProperties` | No | User properties to attach to this identity |

**`OursPrivacyUserProperties` shape (all camelCase):**

| Field | Type | Description |
|-------|------|-------------|
| `email` | `string` | User's email address |
| `externalId` | `string` | ID from your own system |
| `phoneNumber` | `string` | User's phone number |
| `firstName` | `string` | First name |
| `lastName` | `string` | Last name |
| `gender` | `string` | Gender |
| `dateOfBirth` | `string` | Date of birth (ISO 8601, e.g. `1990-04-12`) |
| `city` | `string` | City |
| `state` | `string` | State / region |
| `zip` | `string` | Postal / ZIP code |
| `country` | `string` | Country (ISO 3166-1 alpha-2 preferred) |
| `companyName` | `string` | Company name |
| `jobTitle` | `string` | Job title |
| `ip` | `string` | Client IP (only set this if you have a reliable source — the server will infer otherwise) |
| `customProperties` | `object` | Arbitrary custom user attributes |
| `consent` | `object` | Consent flags (e.g. `{ marketing: true }`) |

The SDK converts these camelCase fields to the snake_case wire format (`externalId` → `external_id`, `dateOfBirth` → `date_of_birth`, etc.) before sending.

**Returns:** `Promise<void>`

```js
await op.identify({
  email: 'jane@example.com',
  externalId: 'db-user-456',
  firstName: 'Jane',
  customProperties: { tier: 'pro' },
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
await op.init('YOUR_API_TOKEN', {
  defaultEventProperties: { app_version: '2.0.0', environment: 'production' },
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
await op.init('YOUR_API_TOKEN', {
  defaultUserCustomProperties: { tier: 'pro' },
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
await op.init('YOUR_API_TOKEN', {
  defaultUserConsentProperties: { marketing: false, analytics: true },
});

// Or when the user updates their preferences:
op.updateDefaultUserConsentProperties({ marketing: true });
```

---

### Configuration

#### `op.setServerURL(serverURL)`

Override the base URL after initialization.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serverURL` | `string` | Yes | Base URL for API requests |

**Returns:** `void`

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

Toggle automatic flushing when the app moves to the background. Enabled by default.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `flushOnBackground` | `boolean` | Yes | `true` to flush on background (default), `false` to disable. |

**Returns:** `void`

```js
op.setFlushOnBackground(false);
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

Returns the stable visitor UUID for this install. Synchronous. No prefix.

**Returns:** `string | null`

```js
const visitorId = op.getVisitorId();
console.log(visitorId); // e.g. "550e8400-e29b-41d4-a716-446655440000"
```

---

#### `op.setVisitorId(visitorId)`

Update the visitor ID after initialization. Use this for web-to-app identity stitching when the visitor ID arrives outside of a deep link (e.g. via a native bridge or async lookup).

Sets `is_manually_set_id: true` on all subsequent events.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `visitorId` | `string` | Yes | The Ours Privacy visitor ID to adopt |

**Returns:** `Promise<void>`

```js
await op.setVisitorId('550e8400-e29b-41d4-a716-446655440000');
```

---

### Deep Link Attribution

#### `op.trackDeepLink(url)`

Parse a deep link URL for marketing attribution data and fire a `$deep_link_opened` event. Extracts UTM parameters, ad network click IDs, and `ours_visitor_id` for cross-platform identity stitching.

Parsed attribution params are merged into defaultProperties, so they appear on all subsequent `track()` calls.

Await the returned promise before calling `track()` to ensure attribution and visitor identity are fully applied.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | The deep link or initial URL to parse |

**Returns:** `Promise<void>`

```js
import { Linking } from 'react-native';

// On cold start — await to ensure attribution is applied before tracking
const initialURL = await Linking.getInitialURL();
if (initialURL) {
  await op.trackDeepLink(initialURL);
}

// On warm start (app in background)
Linking.addEventListener('url', async ({ url }) => {
  await op.trackDeepLink(url);
});
```

Alternatively, pass the URL at init time:

```js
const initialURL = await Linking.getInitialURL();
await op.init('YOUR_API_TOKEN', {
  initialURL: initialURL || undefined,
});
```

**Supported parameters:**

| Category | Parameters |
|----------|-----------|
| UTM | `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` |
| Google | `gclid`, `gad_source`, `dclid`, `gbraid`, `wbraid` |
| Meta | `fbclid`, `fbc`, `fbp` |
| Microsoft | `msclkid` |
| TikTok | `ttclid` |
| Twitter/X | `twclid` |
| LinkedIn | `li_fat_id` |
| Reddit | `rdt_cid` |
| Snapchat | `sccid` |
| Pinterest | `epik` |
| Quora | `qclid` |
| AppLovin | `aleid`, `alart`, `axwrt` |
| Other | `clickid`, `clid`, `ndclid`, `irclickid`, `im_ref`, `sacid`, `basis_cid` |
| Identity | `ours_visitor_id` — cross-platform visitor stitching |

**AppLovin example:**

When a user clicks an AppLovin ad, the deep link will contain `aleid` (click ID) and `alart` (app user ID):

```js
// Deep link: myapp://open?aleid=click_abc&alart=user_xyz&utm_source=applovin
await op.trackDeepLink('myapp://open?aleid=click_abc&alart=user_xyz&utm_source=applovin');

// All subsequent events will include aleid, alart, and utm_source in defaultProperties
```

> **Note:** `esi` (Event Source Indicator) is configured in the AppLovin destination mapping in the Ours Privacy dashboard, not in the SDK. Set it to `"app"` for mobile events in your destination settings.

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

## Payload Structure

The SDK sends a JSON body to `POST /ingest` on the configured `serverURL`. Understanding this structure is useful if you are building a proxy, using the local QA capture server, or verifying your data in the Ours Privacy dashboard.

```json
{
  "token": "your-project-token",
  "is_manually_set_id": false,
  "data": [
    {
      "event": "Purchase",
      "visitor_id": "550e8400-e29b-41d4-a716-446655440000",
      "distinct_id": "ecff9f0e-d4f8-4d9e-b2f8-8d9b2fcdf7b2",
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
        "version": "1.2.0"
      }
    }
  ]
}
```

**Key fields:**

| Field | Description |
|-------|-------------|
| `token` | Your project token |
| `is_manually_set_id` | `true` when visitor ID was set via `init()` options, `setVisitorId()`, or `ours_visitor_id` in a deep link |
| `data` | Array of event objects in this batch |
| `event` | Event name |
| `visitor_id` | Stable visitor UUID for this install (no prefix) |
| `distinct_id` | Per-event UUID generated for this event occurrence |
| `eventProperties` | Properties from `track()` merged with default event properties |
| `userProperties.custom_properties` | From `identify()` and `updateDefaultUserCustomProperties()` |
| `userProperties.consent` | From `identify()` and `updateDefaultUserConsentProperties()` |
| `defaultProperties` | Automatically collected device/SDK metadata |

---

## FAQ

**Do I need to request permission through AppTrackingTransparency?**

No. Ours Privacy does not use IDFA, so no ATT permission is required.

**Why aren't my events showing up?**

Events are batched and sent every 10 seconds by default. Call `flush()` to send immediately. Enable debug logging with `setLoggingEnabled(true)` to see what's happening.

**What platforms are supported?**

- React Native >= 0.60
- iOS and Android apps using React Native
- Expo and other JavaScript-mode environments

---

## Support

- [Documentation](https://docs.oursprivacy.com/docs/react-native-sdk)
- [GitHub Issues](https://github.com/with-ours/ours-privacy-react-native/issues)
- Email: support@oursprivacy.com
