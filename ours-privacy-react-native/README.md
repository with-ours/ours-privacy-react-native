## Table of Contents

<!-- MarkdownTOC -->
- [Introduction](#introduction)
- [Quick Start Guide](#quick-start-guide)
    - [Install OursPrivacy](#1-install-oursprivacy)
    - [Initialize OursPrivacy](#2-initialize-oursprivacy)
    - [Send Data](#3-send-data)
    - [Check for Success](#4-check-for-success)
    - [Complete Code Example](#complete-code-example)
- [FAQ](#faq)
- [I want to know more!](#i-want-to-know-more)

<!-- /MarkdownTOC -->


## Introduction
Welcome to the official OursPrivacy React Native library.
The OursPrivacy React Native library is an open-source project, and we'd love to see your contributions!

## Quick Start Guide

OursPrivacy's React Native SDK is a wrapper around OursPrivacy’s native iOS and Android SDKs and it supports offline tracking.

<a name="installation"></a>
### 1. Install OursPrivacy
#### Prerequisites
- React Native v0.6+
- [Setup development environment for React Native](https://reactnative.dev/docs/environment-setup)
#### Steps
1. Under your app's root directory, install OursPrivacy React Native SDK.
```
npm install oursprivacy-react-native
```
2. Under your application's ios folder, run
```
pod install
```
Please note: You do not need to update your Podfile to add OursPrivacy.

### 2. Initialize OursPrivacy
To start tracking with the library you must first initialize with your project token. You can get your API token by creating a "Server to Server" source in the Ours Privacy portal.

```js
import { OursPrivacy } from 'oursprivacy-react-native';

const trackAutomaticEvents = false;
const oursprivacy = new OursPrivacy("Your API Token", trackAutomaticEvents);
oursprivacy.init();

```
Once you've called this method once, you can access `oursprivacy` throughout the rest of your application.

### 3. Identify the User
Once you know which user you're working with (i.e. after login), you can link the user's id to future tracking by calling identify with your user's id.
```js
let userId = "some-uuid-or-unique-id" // Note the data type of string
await oursprivacy.identify(token, userId)
```

### 3. Send Data
Let's get started by sending event data. You can send an event from anywhere in your application. Better understand user behavior by storing details that are specific to the event (properties). After initializing the library, OursPrivacy will automatically track some properties by default.

```js
// Track with event-name
await oursprivacy.track('Sent Message');
// Track with event-name and property
await oursprivacy.track('Plan Selected', {'Plan': 'Premium'});
```
> Note: you do not necessarily have to await the result of the track function, but it is asynchronous.

### 4. Check for Success
[Open up Recent Events](https://app.oursprivacy.com/recent-events) (under Reporting) in the Ours Privacy portal to view incoming events.
<a name="i-want-to-know-more"></a>

### Complete Code Example
```js

import React from 'react';
import { Button, SafeAreaView } from "react-native";
import { OursPrivacy } from 'oursprivacy-react-native';

const trackAutomaticEvents = false;
const oursprivacy = new OursPrivacy("Your Project Token", trackAutomaticEvents);
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
}

export default SampleApp;

```
### Expo and React Native for Web support (3.0.2 and above)
Starting from version 3.0.2, we have introduced support for Expo, React Native for Web, and other platforms utilizing React Native that do not support iOS and Android directly.
To enable this feature,
<br>Step 1:
```
npm install @react-native-async-storage/async-storage
```
When JavaScript mode is enabled, OursPrivacy utilizes [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) to persist data. If you prefer not to use it, or if AsyncStorage is unavailable in your target environment, you can import or define a different storage class. However, it must follow a subset (see: [`OursPrivacyAsyncStorage`](index.d.ts)) of the same interface as [AsyncStorage](https://react-native-async-storage.github.io/async-storage/) The following example demonstrates how to use a custom storage solution:

```
// Optional: if you do not want to use the default AsyncStorage
const MyAsyncStorage = require("@my-org/<library-path>/AsyncStorage");
const trackAutomaticEvents = false;
const useNative = false;
const oursprivacy = new OursPrivacy('YOUR_TOKEN', trackAutomaticEvents, useNative, MyAsyncStorage);
oursprivacy.init();
```

<br>Step 2:
Initialize OursPrivacy with an additional parameter, `useNative`, set to false.
```
const trackAutomaticEvents = false;
const useNative = false;
const oursprivacy = new OursPrivacy(
    "YOUR_MIXPANEL_TOKEN",
    trackAutomaticEvents,
    useNative
  );
```
This will activate JavaScript mode.


👋 👋  Tell us about the OursPrivacy developer experience! [https://www.oursprivacy.com/devnps](https://www.oursprivacy.com/devnps) 👍  👎


## FAQ
**I have a test user I would like to opt out of tracking. How do I do that?**
OursPrivacy’s client-side tracking library contains the  `optOutTracking()`  method, which will set the user’s local opt-out state to “true” and will prevent data from being sent from a user’s device.

**Why aren't my events showing up?**
First, make sure your test device has internet access. To preserve battery life and customer bandwidth, the OursPrivacy library doesn't send the events you record immediately. Instead, it sends batches to the OursPrivacy servers every 60 seconds while your application is running, as well as when the application transitions to the background. You can call  `flush()` manually if you want to force a flush at a particular moment.

```
oursprivacy.flush();
```

If your events are still not showing up after a reasonable amount of time, check if you have opted out of tracking. You can also enable OursPrivacy debugging and logging, it allows you to see the debug output from the OursPrivacy library. To enable it, call  `setLoggingEnabled` with true, then run your iOS project with Xcode or android project with Android Studio. The logs should be available in the console.

```
oursprivacy.setLoggingEnabled(true);
```

**Starting with iOS 14.5, do I need to request the user’s permission through the AppTrackingTransparency framework to use OursPrivacy?**
No, OursPrivacy does not use IDFA so it does not require user permission through the AppTrackingTransparency(ATT) framework.
