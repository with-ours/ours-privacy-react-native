# Ours Privacy React Native SDK

[![npm version](https://img.shields.io/npm/v/@oursprivacy/react-native.svg)](https://www.npmjs.com/package/@oursprivacy/react-native)
[![GitHub](https://img.shields.io/badge/GitHub-repo-blue)](https://github.com/with-ours/ours-privacy-react-native)

Privacy-first analytics for React Native. Wraps native iOS and Android SDKs with a pure JavaScript fallback for Expo and web.

- [npm](https://www.npmjs.com/package/@oursprivacy/react-native)
- [GitHub](https://github.com/with-ours/ours-privacy-react-native)
- [Docs](https://docs.oursprivacy.com/docs/react-native-sdk)

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

const op = await OursPrivacy.init('YOUR_API_TOKEN', false);
```

That's it. The SDK connects to `https://api.oursprivacy.com/api/v1` by default — no endpoint configuration needed.

### 3. Track Events

```js
op.track('Button Pressed');
op.track('Purchase', { value: 49.99, currency: 'USD' });
```

### 4. Identify Users

After login, link events to a user:

```js
await op.identify('user-123');
```

### 5. Flush

Events are batched and sent every 60 seconds or when the app backgrounds. To send immediately:

```js
op.flush();
```

## Complete Example

```js
import React from 'react';
import { Button, SafeAreaView } from 'react-native';
import { OursPrivacy } from '@oursprivacy/react-native';

let op;
async function getOursPrivacy() {
  if (!op) {
    op = await OursPrivacy.init('YOUR_API_TOKEN', false);
  }
  return op;
}

export default function App() {
  return (
    <SafeAreaView>
      <Button
        title="Track Event"
        onPress={async () => {
          const client = await getOursPrivacy();
          client.track('Button Pressed', { screen: 'Home' });
        }}
      />
    </SafeAreaView>
  );
}
```

## Expo / React Native Web

The SDK falls back to a pure JavaScript implementation when native modules aren't available.

```js
const trackAutomaticEvents = false;
const useNative = false;
const op = new OursPrivacy('YOUR_API_TOKEN', trackAutomaticEvents, useNative);
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

The storage must implement `getItem`, `setItem`, and `removeItem` (same interface as AsyncStorage).

## API Reference

### Initialization

| Method | Description |
|--------|-------------|
| `OursPrivacy.init(token, trackAutomaticEvents)` | Initialize and return an instance (recommended) |
| `new OursPrivacy(token, trackAutomaticEvents, useNative?, storage?)` | Constructor (call `.init()` after) |

### Core Methods

| Method | Description |
|--------|-------------|
| `track(event, properties?)` | Track an event with optional properties |
| `identify(distinctId, userProperties?)` | Link events to a user ID |
| `flush()` | Send queued events immediately |
| `reset()` | Clear stored user identity |

### Configuration

| Method | Description |
|--------|-------------|
| `setServerURL(url)` | Override API endpoint |
| `setLoggingEnabled(enabled)` | Enable/disable debug logging |
| `setFlushOnBackground(enabled)` | Flush when app backgrounds (default: true) |
| `setFlushBatchSize(size)` | Set batch size for flushing |
| `setUseIpAddressForGeolocation(enabled)` | Use IP for geolocation |

### Privacy

| Method | Description |
|--------|-------------|
| `optOutTracking()` | Stop all tracking |
| `optInTracking()` | Resume tracking |
| `hasOptedOutTracking()` | Check opt-out state |

### Identity

| Method | Description |
|--------|-------------|
| `alias(alias, distinctId)` | Create an alias for a user |
| `getDistinctId()` | Get current distinct ID |
| `getDeviceId()` | Get device ID |

### Timing

| Method | Description |
|--------|-------------|
| `timeEvent(event)` | Start timing an event |
| `eventElapsedTime(event)` | Get elapsed time for a timed event |

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

## Support

- [Documentation](https://docs.oursprivacy.com/docs/react-native-sdk)
- [GitHub Issues](https://github.com/with-ours/ours-privacy-react-native/issues)
- Email: support@oursprivacy.com
