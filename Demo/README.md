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
```

## Manual demo

Copy `.env.example` to `.env` and set `OURSPRIVACY_TOKEN` for a test source. The default SDK source is the local `file:..` installation in `Demo/node_modules`. Set `OURSPRIVACY_SDK_SOURCE=local` to have Metro watch edits to the repository's SDK JavaScript files without reinstalling. Restart Metro after changing the source mode.

Run `npm run android` or `npm run ios` from `Demo/`. The app exposes buttons for tracking, identification, consent, deep links, opt-out, opt-in, and reset.

To verify a published release, install its exact version in `Demo/`, run the manual flow against a test source, and check captured `defaultProperties.version` plus the event shape.
