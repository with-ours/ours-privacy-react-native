# OursPrivacy React Native SDK

OursPrivacy React Native library. The OursPrivacy React Native library is an open-source project.

## Installation

### Prerequisites
- React Native v0.6+
- [Setup development environment for React Native](https://reactnative.dev/docs/environment-setup)

### Install the Package

```bash
npm install ours-privacy-react-native
```

> **Note**: This package is not yet published to npm. See [PUBLISHING.md](PUBLISHING.md) for information on how to publish it.

### iOS Setup
Under your application's ios folder, run:
```bash
cd ios && pod install
```

> **Note**: You do not need to update your Podfile to add OursPrivacy.

## Quick Start

### 1. Initialize OursPrivacy

To start tracking with the library you must first initialize with your project token. You can get your API token by creating a "Server to Server" source in the Ours Privacy portal.

```js
import { OursPrivacy } from 'ours-privacy-react-native';

const trackAutomaticEvents = false;
const oursprivacy = new OursPrivacy("Your API Token", trackAutomaticEvents);
oursprivacy.init();
```

### 2. Identify the User

Once you know which user you're working with (i.e. after login), you can link the user's id to future tracking by calling identify with your user's id.

```js
let userId = "some-uuid-or-unique-id"; // Note the data type of string
await oursprivacy.identify(token, userId);
```

### 3. Track Events

Send event data from anywhere in your application. Better understand user behavior by storing details that are specific to the event (properties).

```js
// Track with event-name
await oursprivacy.track('Sent Message');

// Track with event-name and properties
await oursprivacy.track('Plan Selected', {'Plan': 'Premium'});
```

> **Note**: You do not necessarily have to await the result of the track function, but it is asynchronous.

### 4. Check for Success

[Open up Recent Events](https://app.oursprivacy.com/recent-events) (under Reporting) in the Ours Privacy portal to view incoming events.

## Complete Code Example

```js
import React from 'react';
import { Button, SafeAreaView } from "react-native";
import { OursPrivacy } from 'ours-privacy-react-native';

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

## Contributing

For information on how to contribute to this project, including how to build and publish releases, see [PUBLISHING.md](PUBLISHING.md).

## Support

- **Documentation**: https://docs.oursprivacy.com/docs/react-native-sdk#/
- **npm Package**: https://www.npmjs.com/package/ours-privacy-react-native (once published)
- **Issues**: https://github.com/with-ours/ours-privacy-react-native/issues
- **Repository**: https://github.com/with-ours/ours-privacy-react-native
