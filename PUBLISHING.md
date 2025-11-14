# Publishing Guide - React Native SDK

This document describes how to build, version, and publish the OursPrivacy React Native SDK to npm.

## Overview

- **Package Name**: `@oursprivacy/react-native`
- **Target Registry**: npm (https://www.npmjs.com/)
- **Current Status**: ❌ Not yet published to npm
- **Build System**: React Native with native iOS/Android modules
- **Publishing**: Manual npm publishing (to be automated)

## Prerequisites

### Tools Required
- Node.js 16+ and npm/yarn
- React Native CLI
- Xcode (for iOS development)
- Android Studio (for Android development)
- Access to npm account with publishing permissions

### Authentication Setup
1. **npm Login**:
   ```bash
   npm login
   # Use developers@zeytech.com account or authorized account
   ```

2. **Verify access**:
   ```bash
   npm whoami
   
   # Check if you can publish (may need to be added as collaborator)
   npm access list packages @oursprivacy/react-native
   ```

## Version Management

### Current Version
Check current version in `package.json`:
```json
{
  "name": "@oursprivacy/react-native",
  "version": "0.1.0"
}
```

### Update Version
Manually update version in `package.json`:
```json
{
  "name": "@oursprivacy/react-native",
  "version": "0.1.1"
}
```

Or use npm version commands:
```bash
npm version patch  # 0.1.0 -> 0.1.1
npm version minor  # 0.1.0 -> 0.2.0
npm version major  # 0.1.0 -> 1.0.0
```

## Building the Package

### Development Build
```bash
# Install dependencies
npm install

# Run tests
npm test

# Build native modules (if applicable)
# iOS
cd ios && pod install && cd ..

# Android - build happens automatically with React Native
```

### Package Preparation
```bash
# Clean node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Test packaging locally
npm pack

# This creates: ours-privacy-react-native-0.1.0.tgz
```

## Publishing Process

### Initial Publication (First Time)

Since this package hasn't been published yet:

1. **Prepare Package**:
   ```bash
   # Ensure package.json is correct
   cat package.json
   
   # Verify files to be included
   cat .npmignore  # or check "files" in package.json
   ```

2. **Test Local Installation**:
   ```bash
   # Create test package
   npm pack
   
   # Test in demo project
   cd Demo
   npm install ../oursprivacy-react-native-0.1.0.tgz
   ```

3. **Publish to npm**:
   ```bash
   npm publish
   ```

### Subsequent Releases

1. **Update Version**:
   ```bash
   npm version patch  # or minor/major
   ```

2. **Test and Publish**:
   ```bash
   npm test
   npm pack  # Test packaging
   npm publish
   ```

## Package Configuration

### Current package.json
```json
{
  "name": "ours-privacy-react-native",
  "version": "0.1.0",
  "description": "Official React Native Tracking Library for OursPrivacy Analytics",
  "main": "index.js",
  "types": "index.d.ts",
  "react-native": "index.js",
  "scripts": {
    "test": "jest"
  },
  "author": "OursPrivacy",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/oursprivacy/oursprivacy-react-native.git"
  },
  "keywords": [
    "oursprivacy",
    "react",
    "native",
    "ios",
    "android",
    "analytics",
    "tracking",
    "sdk"
  ],
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "^1.21.0",
    "uuid": "3.3.2"
  }
}
```

### TODO: Updates Before Publishing
1. **Fix Repository URL**:
   ```json
   "repository": {
     "type": "git",
     "url": "git+https://github.com/with-ours/ours-privacy-react-native.git"
   },
   "homepage": "https://github.com/with-ours/ours-privacy-react-native#readme"
   ```

2. **Add Files Configuration**:
   ```json
   "files": [
     "index.js",
     "index.d.ts",
     "android/",
     "ios/",
     "javascript/",
     "README.md",
     "LICENSE.md",
     "OursPrivacyReactNative.podspec",
     "react-native.config.js"
   ]
   ```

3. **Update Dependencies**:
   ```json
   "engines": {
     "node": ">=16.0.0"
   },
   "peerDependencies": {
     "react": ">=16.0.0",
     "react-native": ">=0.60.0"
   }
   ```

## Native Module Structure

### iOS Configuration
- **Podspec**: `OursPrivacyReactNative.podspec`
- **Source**: `ios/` directory
- **Installation**: Automatic via CocoaPods

### Android Configuration  
- **Gradle**: `android/build.gradle`
- **Source**: `android/src/` directory
- **Installation**: Automatic via React Native auto-linking

## Testing

### JavaScript Tests
```bash
npm test
```

### Integration Testing
```bash
# Test in demo app
cd Demo
npm install
npx react-native run-ios
npx react-native run-android
```

### Manual Testing Steps
1. Create new React Native project
2. Install the package
3. Import and initialize OursPrivacy
4. Test basic tracking functionality
5. Verify on both iOS and Android

## Release Workflow

### Standard Release Process

1. **Prepare Release**:
   ```bash
   git checkout main  # or dev
   git pull origin main
   
   # Update version
   npm version patch
   
   # Update CHANGELOG.md
   vim CHANGELOG.md
   ```

2. **Test Build**:
   ```bash
   npm install
   npm test
   npm pack
   
   # Test in demo app
   cd Demo
   npm install ../oursprivacy-react-native-*.tgz
   npx react-native run-ios  # Test iOS
   npx react-native run-android  # Test Android
   ```

3. **Publish**:
   ```bash
   cd ..
   npm publish
   ```

4. **Tag and Push**:
   ```bash
   git add .
   git commit -m "chore: release v0.1.1"
   git tag -a v0.1.1 -m "Release v0.1.1 - Description"
   git push origin main  # or dev
   git push origin v0.1.1
   ```

## TODO Automated Release Setup

### Create Release Script
Create `scripts/release.sh`:
```bash
#!/usr/bin/env bash
set -e

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Current version: $CURRENT_VERSION"

# Prompt for new version
read -p "Enter new version: " NEW_VERSION

# Update package.json
npm version $NEW_VERSION --no-git-tag-version

# Update CHANGELOG
echo "## [$NEW_VERSION] - $(date +%Y-%m-%d)" >> CHANGELOG.md
echo "" >> CHANGELOG.md
read -p "Enter release notes: " RELEASE_NOTES
echo "$RELEASE_NOTES" >> CHANGELOG.md
echo "" >> CHANGELOG.md

# Test build
npm install
npm test
npm pack

echo "Testing in demo app..."
cd Demo
npm install ../oursprivacy-react-native-*.tgz

echo "Ready to publish? (y/n)"
read -p "" CONFIRM
if [ "$CONFIRM" = "y" ]; then
  cd ..
  npm publish
  
  # Git operations
  git add .
  git commit -m "chore: release v$NEW_VERSION"
  git tag -a v$NEW_VERSION -m "Release v$NEW_VERSION"
  git push origin main
  git push origin v$NEW_VERSION
  
  echo "Published v$NEW_VERSION successfully!"
else
  echo "Publication cancelled"
fi
```

Make it executable:
```bash
chmod +x scripts/release.sh
```

## TypeScript Support

### Type Definitions
The package includes `index.d.ts` for TypeScript support:
```typescript
export interface OursPrivacyConfig {
  trackAutomaticEvents?: boolean;
  useNative?: boolean;
  storage?: any;
}

export class OursPrivacy {
  constructor(token: string, trackAutomaticEvents?: boolean, useNative?: boolean, storage?: any);
  init(): Promise<void>;
  track(eventName: string, properties?: object): Promise<void>;
  identify(token: string, userId: string, userProperties?: object): Promise<void>;
  // ... other methods
}
```

## Platform-Specific Notes

### iOS
- Uses CocoaPods for dependency management
- Requires `pod install` after npm installation
- Native iOS SDK integration

### Android
- Uses Gradle for dependency management
- Auto-linking handles integration
- Native Android SDK integration

### Web/Expo Support
- Supports JavaScript mode for Expo
- Falls back to AsyncStorage for persistence
- Cross-platform compatibility

## Troubleshooting

### Common Issues

1. **"Package name not available"**: Package name might be taken
2. **"Authentication failed"**: Check npm login credentials
3. **"Native module not found"**: Ensure proper linking setup
4. **"Metro bundler issues"**: Clear Metro cache

### Validation Steps
```bash
# Check npm authentication
npm whoami

# Validate package.json
npm run lint  # if configured

# Test packaging
npm pack
tar -tf oursprivacy-react-native-*.tgz

# Test installation
npm install @oursprivacy/react-native
```

### React Native Specific
```bash
# Clear caches
npx react-native start --reset-cache
cd ios && rm -rf Pods && pod install

# Rebuild
npx react-native run-ios --clean
npx react-native run-android --clean
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Publish React Native Package
on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
          
      - name: Install dependencies
        run: npm ci
          
      - name: Run tests
        run: npm test
          
      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Support

- **Documentation**: https://docs.oursprivacy.com/docs/react-native-sdk#/
- **npm Package**: https://www.npmjs.com/package/@oursprivacy/react-native (once published)
- **Issues**: https://github.com/with-ours/ours-privacy-react-native/issues
- **Repository**: https://github.com/with-ours/ours-privacy-react-native

## Resources

- [React Native Library Publishing](https://reactnative.dev/docs/libraries)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [React Native Auto-linking](https://github.com/react-native-community/cli/blob/master/docs/autolinking.md)
- [Semantic Versioning](https://semver.org/)