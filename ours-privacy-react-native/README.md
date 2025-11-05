# Ours Privacy React Native SDK

[![npm version](https://img.shields.io/npm/v/ours-privacy-react-native.svg)](https://www.npmjs.com/package/ours-privacy-react-native)
[![React Native](https://img.shields.io/badge/React%20Native-compatible-brightgreen.svg)](https://reactnative.dev/)
[![Documentation](https://img.shields.io/badge/Documentation-blue)](https://docs.oursprivacy.com/docs/overview)

# Table of Contents

<!-- MarkdownTOC -->

- [Overview](#overview)
- [Quick Start Guide](#quick-start-guide)
    - [Install Ours Privacy](#1-install-ours-privacy)
    - [Initialize Ours Privacy](#2-initialize-oursprivacy)
    - [Send Data](#3-send-data)
    - [Check for Success](#4-check-for-success)
    - [Complete Code Example](#complete-code-example)
- [FAQ](#faq)

<!-- /MarkdownTOC -->

## Overview

Welcome to the official Ours Privacy React Native library.

The Ours Privacy React Native SDK is a wrapper around Ours Privacy's native iOS and Android SDKs and supports offline tracking. This library is an open-source project, and we'd love to see your contributions!

## Quick Start Guide

## 1. Install Ours Privacy

### Prerequisites
- React Native v0.6+
- [Setup development environment for React Native](https://reactnative.dev/docs/environment-setup)

### Installation

You will need an API token for an Ours Privacy source for initializing your library. You can get your API token by creating a "Server to Server" source in the Ours Privacy portal.

1. Under your app's root directory, install Ours Privacy React Native SDK:

```bash
npm install ours-privacy-react-native
```

2. Under your application's iOS folder, run:

```bash
pod install
```

Note: You do not need to update your Podfile to add Ours Privacy.

## 2. Initialize Ours Privacy

To start tracking with the library you must first initialize with your project token:

```js
import { OursPrivacy } from 'ours-privacy-react-native';

const trackAutomaticEvents = false;
const oursprivacy = new OursPrivacy("YOUR_API_TOKEN", trackAutomaticEvents);
oursprivacy.init();
```

Once you've called this method once, you can access `oursprivacy` throughout the rest of your application.

### Identify the User

Once you know which user you're working with (i.e. after login), you can link the user's id to future tracking by calling identify with your user's id:

```js
const userId = "some-uuid-or-unique-id"; // Note the data type of string
await oursprivacy.identify(token, userId);
```

## 3. Send Data

Let's get started by sending event data. You can send an event from anywhere in your application. Better understand user behavior by storing details that are specific to the event (properties). After initializing the library, Ours Privacy will automatically track some properties by default.

```js
// Track with event-name
await oursprivacy.track('Sent Message');

// Track with event-name and property
await oursprivacy.track('Plan Selected', {'Plan': 'Premium'});
```

Note: you do not necessarily have to await the result of the track function, but it is asynchronous.

## 4. Check for Success

[Open up Recent Events](https://app.oursprivacy.com/recent-events) (under Reporting) in the Ours Privacy portal to view incoming events.

## Complete Code Example

Here's a runnable code example that covers everything in this quickstart guide:

```js
import React from 'react';
import { Button, SafeAreaView } from "react-native";
import { OursPrivacy } from 'ours-privacy-react-native';

const trackAutomaticEvents = false;
const oursprivacy = new OursPrivacy("YOUR_API_TOKEN", trackAutomaticEvents);
oursprivacy.init();

const SampleApp = () => {
  return (
    <SafeAreaView>
      <Button
        title="Select Premium Plan"
        onPress={() => oursprivacy.track("Plan Selected", {"Plan": "Premium"})}
      />
    </SafeAreaView>
  );
};

export default SampleApp;
```

## Expo and React Native for Web Support

Starting from version 3.0.2, we have introduced support for Expo, React Native for Web, and other platforms utilizing React Native that do not support iOS and Android directly.

To enable this feature:

**Step 1:** Install AsyncStorage
```bash
npm install @react-native-async-storage/async-storage
```

When JavaScript mode is enabled, Ours Privacy utilizes [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) to persist data. If you prefer not to use it, or if AsyncStorage is unavailable in your target environment, you can import or define a different storage class. However, it must follow a subset (see: [`OursPrivacyAsyncStorage`](index.d.ts)) of the same interface as [AsyncStorage](https://react-native-async-storage.github.io/async-storage/).

The following example demonstrates how to use a custom storage solution:

```js
// Optional: if you do not want to use the default AsyncStorage
const MyAsyncStorage = require("@my-org/<library-path>/AsyncStorage");
const trackAutomaticEvents = false;
const useNative = false;
const oursprivacy = new OursPrivacy('YOUR_TOKEN', trackAutomaticEvents, useNative, MyAsyncStorage);
oursprivacy.init();
```

**Step 2:** Initialize Ours Privacy with JavaScript mode
```js
const trackAutomaticEvents = false;
const useNative = false;
const oursprivacy = new OursPrivacy(
    "YOUR_API_TOKEN",
    trackAutomaticEvents,
    useNative
);
```

This will activate JavaScript mode.


## FAQ
## FAQ

**I have a test user I would like to opt out of tracking. How do I do that?**

Ours Privacy's client-side tracking library contains the `optOutTracking()` method, which will set the user's local opt-out state to "true" and will prevent data from being sent from a user's device.

**Why aren't my events showing up?**

First, make sure your test device has internet access. To preserve battery life and customer bandwidth, the Ours Privacy library doesn't send the events you record immediately. Instead, it sends batches to the Ours Privacy servers every 60 seconds while your application is running, as well as when the application transitions to the background. You can call `flush()` manually if you want to force a flush at a particular moment.

```js
oursprivacy.flush();
```

If your events are still not showing up after a reasonable amount of time, check if you have opted out of tracking. You can also enable Ours Privacy debugging and logging, it allows you to see the debug output from the Ours Privacy library. To enable it, call `setLoggingEnabled` with true, then run your iOS project with Xcode or android project with Android Studio. The logs should be available in the console.

```js
oursprivacy.setLoggingEnabled(true);
```

**Starting with iOS 14.5, do I need to request the user's permission through the AppTrackingTransparency framework to use Ours Privacy?**

No, Ours Privacy does not use IDFA so it does not require user permission through the AppTrackingTransparency(ATT) framework.

## Contributing

We welcome contributions! If you'd like to contribute to this SDK, please see our [publishing documentation](PUBLISHING.md) for development and publishing guidelines.

## Support

For help with this SDK, please:

- Check the [documentation](https://docs.oursprivacy.com)
- Open an issue on [GitHub](https://github.com/with-ours/ours-privacy-react-native/issues)
- Contact us at support@oursprivacy.com

## Related Links

- [Ours Privacy](https://oursprivacy.com)
- [npm Package](https://www.npmjs.com/package/ours-privacy-react-native)
