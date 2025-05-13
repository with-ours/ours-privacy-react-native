'use strict';

module.exports = {
  dependencies: {
    'oursprivacy-react-native': {
      platforms: {
        android: {
          "sourceDir": "./android",
          "folder": "./",
          "packageImportPath": "import com.oursprivacy.reactnative.OursPrivacyReactNativePackage;",
          "packageInstance": "new OursPrivacyReactNativePackage()"
        },
        // ios: {
        //  project: '../ios/OursPrivacyReactNative.xcodeproj',
        // }
      }
    }
  }
};
