'use strict';

// This package is JS-only. Disable autolinking for both platforms so RN
// tooling does not attempt to wire up native modules that no longer exist.
module.exports = {
  dependencies: {
    'oursprivacy-react-native': {
      platforms: {
        android: null,
        ios: null,
      }
    }
  }
};
