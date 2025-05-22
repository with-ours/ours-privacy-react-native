## Packing

Pack the ours-privacy-react-native folder.

1. Navigate to ours-privacy-react-native
1. Run `npm install`
1. Run `npm pack`

## Installing

Install the ours-privacy-react-native module into a react native project

1. Navigate to the react native app folder
1. Install the pack from the previous section
    1. Run `npm install <ours-privacy-react-native-pack>`
1. Navigate to ios
1. Run `pod install`
1. Go back to app root and run `npx react-native run-ios` or `npx react-native run-android` to test the changes

```
cd ours-privacy-react-native
npm pack
cd ../example
npm install ../ours-privacy-react-native/ours-privacy-react-native-0.1.0.tgz
npm install
cd ios
pod install
cd ..
npx react-native run-ios
cd ..
```