'use strict';

module.exports = {
  dependencies: {
    'oursprivacy-react-native': {
      platforms: {
        android: {
          "sourceDir": "./android",
          "packageImportPath": "import com.oursprivacy.reactnative.OursPrivacyReactNativePackage;",
          "packageInstance": "new OursPrivacyReactNativePackage()"
        },
        // ios: {
        //   project: './ios/OursPrivacyReactNative.xcodeproj',
        //   scheme: 'OursPrivacyReactNative',
        // },
      }
    }
  }
};
