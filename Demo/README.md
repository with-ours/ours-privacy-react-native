# Demo App

This is the local React Native integration app used to test the packaged SDK on iOS and Android.

## What It Covers

The Demo exercises the main SDK flows exposed in `App.tsx`:

- `track()`
- `identify()`
- `updateDefaultEventProperties()`
- `updateDefaultUserConsentProperties()`
- `optOutTracking()`
- `optInTracking()`
- `reset()`

The `ios/` and `android/` folders are required. This Demo is a bare React Native app, so those native project shells are how `run-ios` and `run-android` work.

## Install the Packed SDK

From the repo root:

```sh
npm pack
```

Then from `Demo/`:

```sh
npm install ../oursprivacy-react-native-*.tgz
npm install
```

## Configure Environment

Set values in `Demo/.env`:

```sh
OURSPRIVACY_TOKEN=demo-token
OURSPRIVACY_SERVER_URL=http://127.0.0.1:4010
```

Use these server URLs:

- iOS simulator: `http://127.0.0.1:4010`
- Android emulator: `http://10.0.2.2:4010`
- Physical Android device with `adb reverse`: `http://127.0.0.1:4010`
- Physical iPhone on the same Wi-Fi: `http://<your-mac-lan-ip>:4010`

## Local Payload Capture

From the repo root, start the local capture server:

```sh
npm run qa:capture
```

After using the Demo app, validate captured payloads:

```sh
npm run qa:check-captures -- --require-event button_pressed --require-event '$identify'
```

## Run the Demo

Start Metro:

```sh
npm start
```

In a second terminal:

### iOS

```sh
cd ios
bundle install
bundle exec pod install
cd ..
npm run ios
```

### Android

```sh
npm run android
```

## Manual QA Checklist

Before merging SDK changes, verify:

- app launches without redboxes
- `Track Event` stores a captured `button_pressed` request
- `Identify User` stores a captured `$identify` request
- `Update Defaults + Track` changes the next payload
- `Opt Out` suppresses new events
- `Opt In` resumes tracking and sends `$opt_in`
- `Reset` changes `visitor_id`
- relaunch preserves `visitor_id` until `reset()`

## Notes

- The Demo installs `@react-native-async-storage/async-storage` directly so persistence works in bare React Native builds.
- Metro reconnect noise and inspector port warnings are not SDK failures by themselves.
