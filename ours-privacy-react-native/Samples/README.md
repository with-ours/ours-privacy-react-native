

# Sample React Native Applications for OursPrivacy Integration

This folder contains 3 sample applications demonstrating how you can use OursPrivacy in your React Native app.
- SimpleOursPrivacy: Integrate OursPrivacy with a minimalist approach
- OursPrivacyDemo: A full OursPrivacy API demo app
- ContextAPIOursPrivacy: Integrate OursPrivacy with Context API

# How to Run
## Prerequisites
- React Native v0.6+
- Prerequiste You need to set up the React Native development environment, follow the React Native CLI Quickstart section \
https://reactnative.dev/docs/environment-setup

## Getting Started
- Under the sample app's root directory, run `yarn install`
- Under the sample app's ios directory, run `pod install`
- To run the app in iOS, run `yarn ios`
- To run the app Android, run `yarn android`

## Add your OursPrivacy Token to app.json
There is "token" value in app.json that you'll need to update
before you can send data to OursPrivacy.

### For Your OursPrivacy Token

- Log in to your account at https://www.oursprivacy.com
- Select the project you'll be working with
- Click the gear link at the top right to show the project settings dialog
- Copy the "Token" string from the dialog

Change the value of "token" in app.json to the value you copied from the web page.

## Getting More Information

The OursPrivacy React Native integration API documentation is available on the OursPrivacy website.

https://developer.oursprivacy.com/docs/react-native
