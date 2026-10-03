# Demo App

This bare React Native app exercises the packaged Ours Privacy SDK on Android and iOS. It installs the SDK from the repository through `file:..`, so a clean checkout needs no prebuilt tarball.

## Install

Use Node 22 or 24. From the repository root:

```sh
npm ci
cd Demo && npm ci
```

The native shells follow React Native 0.87.1. Android builds need JDK 17, Android SDK Platform 37, Build Tools 37, and Android Studio with an API 35 emulator image. iOS builds need Xcode and CocoaPods.

## Static checks

From `Demo/`:

```sh
npm run lint
npm run typecheck
npm test -- --runInBand
```

## One-command payload E2E

From the repository root, after installing the Android tooling and creating at least one Android Virtual Device:

```sh
npm run e2e:android
```

The command starts the first installed emulator if none is running, configures the demo with a temporary local token and capture URL, starts the local capture server and Metro, builds and launches the app, and validates the captured event payloads. It restores the previous `Demo/.env` when it exits. No Ours account or external ingest service is needed. CI runs this same command inside an Android emulator.

An optional iOS simulator run uses `npm run e2e:ios` from the root. Install the locked CocoaPods first with `cd Demo && bundle install && cd ios && bundle exec pod install --deployment`.

## Manual demo

Copy `.env.example` to `.env` and set `OURSPRIVACY_TOKEN` for a test source. The default SDK source is the local `file:..` installation in `Demo/node_modules`. Set `OURSPRIVACY_SDK_SOURCE=local` to have Metro watch edits to the repository's SDK JavaScript files without reinstalling. Restart Metro after changing the source mode.

For local payload capture, set `OURSPRIVACY_SERVER_URL` to `http://10.0.2.2:4010` for an Android emulator or `http://127.0.0.1:4010` for an iOS simulator, then run `npm run qa:capture` from the root. Android devices connected by USB can use `adb reverse tcp:4010 tcp:4010` and `http://127.0.0.1:4010`.

Run `npm run android` or `npm run ios` from `Demo/`. The app exposes buttons for tracking, identification, consent, deep links, opt-out, opt-in, and reset.

To verify a published release, install its exact version in `Demo/`, run the manual flow against a test source, and check captured `defaultProperties.version` plus the event shape.
